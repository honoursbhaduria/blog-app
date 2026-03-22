from rest_framework import generics, views, status, viewsets, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated, IsAdminUser
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.db.models import Q, F, Count
from django.shortcuts import get_object_or_404
from django.utils.html import strip_tags
from django.utils.text import slugify
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.cache import cache
from groq import Groq
import requests
import random
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

from .models import Category, Blog, Comment, Like, Tag, Favorite, Cluster, SavedWikiArticle
from .constants import PREDEFINED_TECH_CATEGORIES_LOWER
from .serializers import (
    CategorySerializer, BlogSerializer, CommentSerializer, 
    TagSerializer, FavoriteSerializer, ClusterSerializer, SavedWikiArticleSerializer
)
from .ai_views import fetch_wikipedia_results, sanitize_wikipedia_html, WIKI_HEADERS, wiki_en, WIKI_SESSION


def build_auto_cover_image(title, subtitle=''):
    width, height = 1280, 720
    background = Image.new('RGB', (width, height), '#1C1C1C')
    drawer = ImageDraw.Draw(background)

    accent_left = int(width * 0.08)
    accent_top = int(height * 0.12)
    drawer.rectangle([accent_left, accent_top, accent_left + 24, height - accent_top], fill='#E06A59')

    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()

    max_chars = 56
    words = (title or '').split()
    lines = []
    current_line = ''
    for word in words:
        candidate = f"{current_line} {word}".strip()
        if len(candidate) <= max_chars:
            current_line = candidate
        else:
            if current_line:
                lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    lines = lines[:6] or ['Untitled Draft']

    text_x = accent_left + 54
    text_y = accent_top + 8
    for line in lines:
        drawer.text((text_x, text_y), line.upper(), fill='#FFFFFF', font=title_font)
        text_y += 26

    if subtitle:
        drawer.text((text_x, min(text_y + 12, height - 70)), subtitle[:90], fill='#D9D9D9', font=subtitle_font)

    footer_text = 'AI GENERATED COVER'
    drawer.text((text_x, height - 52), footer_text, fill='#E06A59', font=subtitle_font)

    image_bytes = BytesIO()
    background.save(image_bytes, format='PNG', optimize=True)
    image_bytes.seek(0)
    return ContentFile(image_bytes.read())


def get_cache_version(key, default=1):
    version = cache.get(key)
    if version is None:
        cache.set(key, default, None)
        return default
    return version


def bump_cache_version(key):
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 2, None)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('category_name')
    serializer_class = CategorySerializer
    pagination_class = None
    permission_classes = [IsAuthenticatedOrReadOnly] # List is public, Create/Update/Delete should check permissions in perform_* if needed or via specific permission class

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.category_name.lower() in PREDEFINED_TECH_CATEGORIES_LOWER:
            raise ValidationError({'category_name': 'Predefined categories are locked and cannot be renamed.'})
        serializer.save()
        bump_cache_version('api:blogs:categories:version')

    def perform_create(self, serializer):
        serializer.save()
        bump_cache_version('api:blogs:categories:version')

    def perform_destroy(self, instance):
        if instance.category_name.lower() in PREDEFINED_TECH_CATEGORIES_LOWER:
            raise ValidationError({'category_name': 'Predefined categories are locked and cannot be deleted.'})
        instance.delete()
        bump_cache_version('api:blogs:categories:version')

    def list(self, request, *args, **kwargs):
        version = get_cache_version('api:blogs:categories:version')
        cache_key = f"api:blogs:categories:list:v{version}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 120)
        return response

class TagListView(generics.ListAPIView):
    queryset = Tag.objects.all().order_by('name')
    serializer_class = TagSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        version = get_cache_version('api:blogs:tags:version')
        cache_key = f"api:blogs:tags:list:v{version}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 120)
        return response

class BlogViewSet(viewsets.ModelViewSet):
    """
    Unified ViewSet for all Blog related operations.
    Replaces separate Dashboard and Public views.
    """
    serializer_class = BlogSerializer
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'short_description', 'blog_body']

    def _list_cache_version(self):
        return get_cache_version('api:blogs:posts:list:version')

    def _bump_list_cache(self):
        bump_cache_version('api:blogs:posts:list:version')

    def list(self, request, *args, **kwargs):
        version = self._list_cache_version()
        query_string = request.query_params.urlencode()
        user_marker = request.user.id if request.user.is_authenticated else 'anon'
        cache_key = f"api:blogs:posts:list:v{version}:u{user_marker}:s{int(request.user.is_staff)}:q:{query_string}"

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 30)
        return response

    def get_queryset(self):
        # Base optimized queryset
        queryset = Blog.objects.select_related('category', 'author')\
                               .prefetch_related('tags')\
                               .annotate(like_count_annotated=Count('likes', distinct=True),
                                         favorite_count_annotated=Count('favorited_by', distinct=True),
                                         comment_count_annotated=Count('comment', distinct=True))

        source_type = self.request.query_params.get('source_type', '').strip()

        # Staff/Superuser sees everything
        if not self.request.user.is_staff:
            is_authenticated = self.request.user.is_authenticated
            action = getattr(self, 'action', None)

            if self.request.query_params.get('mine') == 'true' and is_authenticated:
                # Dashboard list for the author
                queryset = queryset.filter(author=self.request.user)
            elif is_authenticated and action in {
                'retrieve', 'update', 'partial_update', 'destroy',
                'toggle_like', 'check_like', 'toggle_favorite', 'check_favorite'
            }:
                # Author can access own drafts by slug; everyone can access published posts
                queryset = queryset.filter(Q(status='Published') | Q(author=self.request.user))
            else:
                # Public list and anonymous access stay published-only,
                # except Wikipedia-source listing which is allowed to surface wiki drafts.
                if source_type.lower() == 'wikipedia':
                    queryset = queryset.filter(Q(status='Published') | Q(source_type__iexact='Wikipedia'))
                else:
                    queryset = queryset.filter(status='Published')

        # Additional filters
        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
            
        tag_id = self.request.query_params.get('tag')
        if tag_id:
            queryset = queryset.filter(tags__id=tag_id)
            
        difficulty = self.request.query_params.get('difficulty')
        if difficulty:
            queryset = queryset.filter(difficulty_level__iexact=difficulty)

        if source_type:
            queryset = queryset.filter(source_type__iexact=source_type)
            
        is_featured = self.request.query_params.get('featured')
        if is_featured:
            queryset = queryset.filter(is_featured=is_featured.lower() == 'true')
            
        return queryset.order_by('-created_at').distinct()

    def perform_create(self, serializer):
        instance = serializer.save(author=self.request.user)
        # Pre-set annotated counts to 0 to save 3 queries in the response serialization
        instance.like_count_annotated = 0
        instance.favorite_count_annotated = 0
        instance.comment_count_annotated = 0
        self._bump_list_cache()

    def perform_update(self, serializer):
        serializer.save()
        self._bump_list_cache()

    def perform_destroy(self, instance):
        instance.delete()
        self._bump_list_cache()

    def retrieve(self, request, *args, **kwargs):
        # Optimized retrieve: use the same queryset as list to get annotations (like/comment counts)
        queryset = self.get_queryset()
        instance = get_object_or_404(queryset, slug=self.kwargs.get('slug'))
        
        # Increment view count atomically without refreshing everything
        Blog.objects.filter(pk=instance.pk).update(view_count=F('view_count') + 1)
        
        # Manually update the in-memory object so we don't need refresh_from_db()
        instance.view_count += 1
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def toggle_like(self, request, slug=None):
        blog = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, blog=blog)
        if not created:
            like.delete()
            user_has_liked = False
        else:
            user_has_liked = True
        self._bump_list_cache()
        return Response({'user_has_liked': user_has_liked, 'like_count': blog.likes.count()})

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def check_like(self, request, slug=None):
        blog = self.get_object()
        exists = Like.objects.filter(user=request.user, blog=blog).exists()
        return Response({'user_has_liked': exists})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def toggle_favorite(self, request, slug=None):
        blog = self.get_object()
        fav, created = Favorite.objects.get_or_create(user=request.user, blog=blog)
        if not created:
            fav.delete()
            is_favorited = False
        else:
            is_favorited = True
        self._bump_list_cache()
        return Response({'is_favorited': is_favorited, 'favorite_count': blog.favorited_by.count()})

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def check_favorite(self, request, slug=None):
        blog = self.get_object()
        exists = Favorite.objects.filter(user=request.user, blog=blog).exists()
        return Response({'is_favorited': exists})

class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Comment.objects.filter(blog__slug=self.kwargs['blog_slug']).select_related('user')

    def perform_create(self, serializer):
        blog = get_object_or_404(Blog, slug=self.kwargs['blog_slug'])
        serializer.save(user=self.request.user, blog=blog)
        bump_cache_version('api:blogs:posts:list:version')

    def perform_update(self, serializer):
        serializer.save()
        bump_cache_version('api:blogs:posts:list:version')

    def perform_destroy(self, instance):
        instance.delete()
        bump_cache_version('api:blogs:posts:list:version')

class ClusterViewSet(viewsets.ModelViewSet):
    serializer_class = ClusterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Cluster.objects.filter(owner=self.request.user).prefetch_related('blogs', 'tags', 'wiki_articles')

    def perform_create(self, serializer):
        name = serializer.validated_data.get('name', '').strip()
        if Cluster.objects.filter(owner=self.request.user, name__iexact=name).exists():
            raise ValidationError({'name': 'You already have a cluster with this name.'})
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        name = serializer.validated_data.get('name', '').strip()
        cluster = self.get_object()
        if Cluster.objects.filter(owner=self.request.user, name__iexact=name).exclude(pk=cluster.pk).exists():
            raise ValidationError({'name': 'You already have a cluster with this name.'})
        serializer.save()

    def _build_cluster_context(self, cluster):
        blog_context = []
        for blog in cluster.blogs.all()[:12]:
            blog_context.append(
                f"- Blog: {blog.title}\n"
                f"  Summary: {blog.short_description[:240]}\n"
                f"  Body Snippet: {strip_tags(blog.blog_body)[:400]}"
            )

        wiki_context = []
        for article in cluster.wiki_articles.all()[:20]:
            wiki_context.append(
                f"- Wiki: {article.title}\n"
                f"  Extract: {strip_tags(article.extract or '')[:320]}\n"
                f"  URL: {article.original_url or ''}"
            )

        return "\n".join([
            f"Cluster Name: {cluster.name}",
            f"Cluster Description: {cluster.description}",
            "", "Blogs in Cluster:",
            "\n".join(blog_context) or "- None",
            "", "Wikipedia References in Cluster:",
            "\n".join(wiki_context) or "- None",
        ])

    @action(detail=True, methods=['post'])
    def cluster_chat(self, request, pk=None):
        cluster = self.get_object()
        message = (request.data.get('message') or '').strip()
        if not message:
            raise ValidationError({'message': 'Message is required.'})

        if not settings.GROQ_API_KEY:
            raise ValidationError({'detail': 'GROQ_API_KEY is not configured.'})

        context = self._build_cluster_context(cluster)
        client = Groq(api_key=settings.GROQ_API_KEY)

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "You are a technical writing and research assistant. Answer using only the provided cluster context when possible, and clearly state assumptions when needed."
                },
                {
                    "role": "user",
                    "content": f"Cluster context:\n{context}\n\nUser question:\n{message}"
                }
            ],
            temperature=0.6,
            max_tokens=700,
        )

        return Response({'answer': completion.choices[0].message.content})

    @action(detail=True, methods=['post'])
    def create_blog_draft(self, request, pk=None):
        cluster = self.get_object()
        prompt = (request.data.get('prompt') or '').strip()
        title = (request.data.get('title') or f"{cluster.name} Draft").strip()

        category = Category.objects.filter(category_name__iexact='Misc Tech').first() or Category.objects.first()
        if not category:
            category = Category.objects.create(category_name='Misc Tech')

        context = self._build_cluster_context(cluster)

        blog_body = (
            f"## {title}\n\n"
            f"Cluster: {cluster.name}\n\n"
            f"{prompt or 'Draft generated from cluster references. Expand this into a full article.'}\n\n"
            f"### Cluster Context Snapshot\n\n{context}"
        )

        if settings.GROQ_API_KEY:
            try:
                client = Groq(api_key=settings.GROQ_API_KEY)
                completion = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an expert technical blog writer. Build a structured markdown draft using the provided context."
                        },
                        {
                            "role": "user",
                            "content": f"Create a technical blog draft titled '{title}'.\n\nPrompt: {prompt or 'Use the cluster context to create a comprehensive draft.'}\n\nCluster context:\n{context}"
                        },
                    ],
                    temperature=0.7,
                    max_tokens=1100,
                )
                blog_body = completion.choices[0].message.content or blog_body
            except Exception:
                pass

        draft = Blog.objects.create(
            title=title,
            subtitle=f"Generated from cluster: {cluster.name}",
            category=category,
            author=request.user,
            short_description=(prompt or f"Draft generated from cluster {cluster.name}")[:500],
            blog_body=blog_body,
            status='Draft',
            source_type='External Article',
            citation='Generated using cluster references and AI assistance.',
            visibility='Private',
            allow_comments=False,
        )

        try:
            cover_file = build_auto_cover_image(draft.title, draft.subtitle or cluster.name)
            filename = f"auto-cover-{slugify(draft.title)[:64] or draft.id}.png"
            draft.featured_image.save(filename, cover_file, save=True)
        except Exception:
            pass

        for tag in cluster.tags.all()[:10]:
            draft.tags.add(tag)

        serializer = BlogSerializer(draft)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class SavedWikiArticleViewSet(viewsets.ModelViewSet):
    serializer_class = SavedWikiArticleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = SavedWikiArticle.objects.filter(user=self.request.user)

        query = self.request.query_params.get('q', '').strip()
        if query:
            queryset = queryset.filter(Q(title__icontains=query) | Q(extract__icontains=query))

        liked = self.request.query_params.get('liked', '').strip().lower()
        if liked in {'true', 'false'}:
            queryset = queryset.filter(liked=(liked == 'true'))

        return queryset

    def perform_create(self, serializer):
        # Prevent duplicates for the same user and title
        title = serializer.validated_data.get('title')
        if SavedWikiArticle.objects.filter(user=self.request.user, title=title).exists():
            raise ValidationError({'title': 'This Wikipedia article is already saved in your library.'})
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def toggle_like(self, request, pk=None):
        article = self.get_object()
        article.liked = not article.liked
        article.save(update_fields=['liked', 'updated_at'])
        return Response({'liked': article.liked})

    @action(detail=True, methods=['post'])
    def create_blog_draft(self, request, pk=None):
        article = self.get_object()

        category = Category.objects.filter(category_name__iexact='Misc Tech').first() or Category.objects.first()
        if not category:
            category = Category.objects.create(category_name='Misc Tech')

        clean_extract = strip_tags(article.extract or '').strip()
        short_description = clean_extract[:500] if clean_extract else f'Draft imported from Wikipedia: {article.title}'
        source_url = article.original_url or ''
        blog_body = (
            f"## {article.title}\n\n"
            f"{clean_extract or 'Draft content imported from Wikipedia. Expand and refine this draft.'}\n\n"
            f"Source: {source_url or 'Wikipedia'}"
        )

        draft = Blog.objects.create(
            title=article.title,
            subtitle='Imported from Wikipedia draft',
            category=category,
            author=request.user,
            short_description=short_description,
            blog_body=blog_body,
            status='Draft',
            source_type='Wikipedia',
            source_url=source_url,
            reference_links=source_url,
            citation='Wikipedia content is available under CC BY-SA 3.0.',
            visibility='Private',
            allow_comments=False,
        )

        try:
            cover_file = build_auto_cover_image(draft.title, draft.subtitle or 'Wikipedia draft')
            filename = f"auto-cover-{slugify(draft.title)[:64] or draft.id}.png"
            draft.featured_image.save(filename, cover_file, save=True)
        except Exception:
            pass

        serializer = BlogSerializer(draft)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        entries = request.data.get('entries')
        article_ids = request.data.get('article_ids', [])

        if isinstance(entries, list):
            for item in entries:
                article_id = item.get('id')
                if not article_id:
                    continue
                SavedWikiArticle.objects.filter(id=article_id, user=request.user).update(
                    board_column=item.get('board_column', 'Inbox'),
                    board_order=item.get('board_order', 0),
                )
        else:
            for index, article_id in enumerate(article_ids):
                SavedWikiArticle.objects.filter(id=article_id, user=request.user).update(board_order=index)

        return Response({'status': 'reordered'})

class GlobalStatsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache
        
        # Cache stats for 5 minutes
        cache_key = 'global_platform_stats'
        stats = cache.get(cache_key)
        
        if stats:
            return Response(stats)

        from django.db import connection
        # Optimize with a single query for all counts to reduce round-trips to Neon DB
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM blogs_category),
                    (SELECT COUNT(*) FROM blogs_blog WHERE status = 'Published'),
                    (SELECT COUNT(*) FROM blogs_comment),
                    (SELECT COUNT(*) FROM blogs_like)
            """)
            row = cursor.fetchone()
            
        stats = {
            'category_count': row[0] or 0,
            'blogs_count': row[1] or 0,
            'total_comments': row[2] or 0,
            'total_likes': row[3] or 0,
        }
        
        cache.set(cache_key, stats, 300)
        return Response(stats)

from django.contrib.auth.models import User
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
        read_only_fields = ('is_superuser', 'date_joined',)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in {'create', 'update', 'partial_update', 'destroy'}:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if not self.request.user.is_staff:
            return User.objects.filter(id=self.request.user.id)
        return super().get_queryset()

class TrendingBlogView(views.APIView):
    def get(self, request):
        cache_key = 'api:blogs:trending:v1'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        blogs = Blog.objects.filter(status='Published')\
            .select_related('category', 'author')\
            .annotate(like_count=Count('likes'))\
            .order_by('-view_count', '-like_count', '-created_at')[:6]
        
        serializer = BlogSerializer(blogs, many=True)
        
        wiki_trending = []
        try:
            technical_topics = [
                'artificial intelligence',
                'machine learning',
                'python programming',
                'cloud computing',
                'cybersecurity',
                'data science',
                'software engineering',
            ]

            from concurrent.futures import ThreadPoolExecutor
            # Fetch all topics in parallel to hit < 400ms
            with ThreadPoolExecutor(max_workers=len(technical_topics)) as executor:
                # Limit each topic to 1 result for the trending marquee to be extra fast
                topic_results = list(executor.map(lambda t: fetch_wikipedia_results(t, limit=1), technical_topics))
            
            seen = set()
            for results in topic_results:
                for item in results:
                    title = (item.get('title') or '').strip()
                    if title and title.lower() not in seen:
                        seen.add(title.lower())
                        wiki_trending.append(item)
                        if len(wiki_trending) >= 6: break
                if len(wiki_trending) >= 6: break
        except Exception:
            pass

        payload = {'blogs': serializer.data, 'wiki_trending': wiki_trending}
        cache.set(cache_key, payload, 180)
        return Response(payload)

class WikipediaSearchView(views.APIView):
    def get(self, request):
        keyword = request.query_params.get('keyword', '').strip()
        keyword = keyword or 'technology'

        cache_key = f"api:wikipedia:search:{keyword.lower()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        results = fetch_wikipedia_results(keyword, limit=12)
        cache.set(cache_key, results, 300)
        return Response(results)

class WikipediaRandomFeedView(views.APIView):
    def get(self, request):
        try:
            limit = int(request.query_params.get('limit', 20))
        except (TypeError, ValueError):
            limit = 20

        limit = max(1, min(limit, 40))

        cache_key = f"api:wikipedia:random:{limit}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        
        # Parallelize random summary fetching
        from concurrent.futures import ThreadPoolExecutor
        def get_one_random():
            try:
                resp = WIKI_SESSION.get(
                    'https://en.wikipedia.org/api/rest_v1/page/random/summary',
                    timeout=1.8,
                    headers=WIKI_HEADERS,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        'title': data.get('title', ''),
                        'extract': data.get('extract', '')[:500],
                        'thumbnail': data.get('thumbnail', {}).get('source', ''),
                        'page_url': data.get('content_urls', {}).get('desktop', {}).get('page', ''),
                    }
            except: pass
            return None

        with ThreadPoolExecutor(max_workers=10) as executor:
            # We fetch a bit more than limit to account for failures
            results = list(filter(None, executor.map(lambda _: get_one_random(), range(limit + 5))))

        payload = results[:limit]
        cache.set(cache_key, payload, 120)
        return Response(payload)

class ApiWikiArticleView(views.APIView):
    def get(self, request, title):
        cache_key = f"api:wikipedia:article:{title.lower()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        page = wiki_en.page(title)
        
        article_data = {
            'title': title,
            'html_content': '',
            'extract': '',
            'thumbnail': '',
            'original_image': '',
            'original_url': '',
            'description': '',
            'related': []
        }

        if not page.exists():
            return Response(article_data)

        article_data['title'] = page.title
        article_data['extract'] = page.summary
        article_data['original_url'] = page.fullurl
        article_data['related'] = list(page.links.keys())[:10]

        try:
            # We still need to fetch some extra info (HTML, images) that wikipedia-api doesn't provide
            encoded_title = requests.utils.quote(title)
            s_resp = WIKI_SESSION.get(f'https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_title}', timeout=3, headers=WIKI_HEADERS)
            if s_resp.status_code == 200:
                sd = s_resp.json()
                article_data['thumbnail'] = sd.get('thumbnail', {}).get('source', '')
                article_data['original_image'] = sd.get('originalimage', {}).get('source', '')
                article_data['description'] = sd.get('description', '')
                
            p_resp = WIKI_SESSION.get('https://en.wikipedia.org/w/api.php', params={'action': 'parse', 'page': title, 'prop': 'text', 'format': 'json', 'formatversion': 2, 'redirects': 1}, timeout=5, headers=WIKI_HEADERS)
            if p_resp.status_code == 200:
                article_data['html_content'] = sanitize_wikipedia_html(p_resp.json().get('parse', {}).get('text', ''))
        except: 
            pass

        cache.set(cache_key, article_data, 600)
        return Response(article_data)
