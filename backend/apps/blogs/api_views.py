from rest_framework import generics, views, status, viewsets, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.db.models import Q, F, Count
from django.shortcuts import get_object_or_404
from django.utils.html import strip_tags
from django.utils.text import slugify
from django.conf import settings
from django.core.files.base import ContentFile
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
from .ai_views import fetch_wikipedia_results, sanitize_wikipedia_html, WIKI_HEADERS


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

    def perform_destroy(self, instance):
        if instance.category_name.lower() in PREDEFINED_TECH_CATEGORIES_LOWER:
            raise ValidationError({'category_name': 'Predefined categories are locked and cannot be deleted.'})
        instance.delete()

class TagListView(generics.ListAPIView):
    queryset = Tag.objects.all().order_by('name')
    serializer_class = TagSerializer
    pagination_class = None

class BlogViewSet(viewsets.ModelViewSet):
    """
    Unified ViewSet for all Blog related operations.
    Replaces separate Dashboard and Public views.
    """
    serializer_class = BlogSerializer
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'short_description', 'blog_body']

    def get_queryset(self):
        # Base optimized queryset
        queryset = Blog.objects.select_related('category', 'author')\
                               .prefetch_related('tags')\
                               .annotate(like_count_annotated=Count('likes', distinct=True),
                                         favorite_count_annotated=Count('favorited_by', distinct=True))

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
                if action == 'list' and source_type.lower() == 'wikipedia':
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
        serializer.save(author=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Increment view count atomically
        Blog.objects.filter(pk=instance.pk).update(view_count=F('view_count') + 1)
        instance.refresh_from_db()
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
        return Response({
            'category_count': Category.objects.count(),
            'blogs_count': Blog.objects.filter(status='Published').count(),
            'total_comments': Comment.objects.count(),
            'total_likes': Like.objects.count(),
        })

from django.contrib.auth.models import User
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
        read_only_fields = ('date_joined',)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated] # Dashboard logic will restrict staff actions in frontend or via specific checks

    def get_queryset(self):
        if not self.request.user.is_staff:
            return User.objects.filter(id=self.request.user.id)
        return super().get_queryset()

class TrendingBlogView(views.APIView):
    def get(self, request):
        blogs = Blog.objects.filter(status='Published')\
            .select_related('category', 'author')\
            .annotate(like_count=Count('likes'))\
            .order_by('-like_count', '-created_at')[:6]
        
        serializer = BlogSerializer(blogs, many=True)
        
        wiki_trending = []
        try:
            summary_url = f'https://en.wikipedia.org/api/rest_v1/page/summary/Main_Page'
            resp = requests.get(summary_url, timeout=5, headers=WIKI_HEADERS)
            if resp.status_code == 200:
                data = resp.json()
                wiki_trending = [{
                    'title': data.get('title'),
                    'extract': data.get('extract'),
                    'thumbnail': data.get('thumbnail', {}).get('source', ''),
                    'page_url': data.get('content_urls', {}).get('desktop', {}).get('page', '')
                }]
        except: pass

        return Response({'blogs': serializer.data, 'wiki_trending': wiki_trending})

class WikipediaSearchView(views.APIView):
    def get(self, request):
        keyword = request.query_params.get('keyword', '').strip()
        keyword = keyword or 'technology'
        return Response(fetch_wikipedia_results(keyword, limit=12))

class WikipediaRandomFeedView(views.APIView):
    def get(self, request):
        try:
            limit = int(request.query_params.get('limit', 20))
        except (TypeError, ValueError):
            limit = 20

        limit = max(1, min(limit, 40))
        random_feed = []
        seen_titles = set()
        fallback_topics = [
            'technology', 'science', 'programming', 'internet', 'artificial intelligence',
            'history', 'mathematics', 'space', 'engineering', 'philosophy',
        ]

        attempts = 0
        max_attempts = limit * 3

        while len(random_feed) < limit and attempts < max_attempts:
            attempts += 1
            try:
                summary_resp = requests.get(
                    'https://en.wikipedia.org/api/rest_v1/page/random/summary',
                    timeout=8,
                    headers=WIKI_HEADERS,
                )
                if summary_resp.status_code == 200:
                    data = summary_resp.json()
                    title = (data.get('title') or '').strip()
                    if title and title.lower() not in seen_titles:
                        seen_titles.add(title.lower())
                        random_feed.append({
                            'title': title,
                            'extract': data.get('extract', ''),
                            'thumbnail': data.get('thumbnail', {}).get('source', ''),
                            'page_url': data.get('content_urls', {}).get('desktop', {}).get('page', ''),
                        })
            except requests.RequestException:
                continue

        if len(random_feed) < limit:
            random.shuffle(fallback_topics)
            for topic in fallback_topics:
                if len(random_feed) >= limit:
                    break
                for item in fetch_wikipedia_results(topic, limit=6):
                    title = (item.get('title') or '').strip()
                    if title and title.lower() not in seen_titles:
                        seen_titles.add(title.lower())
                        random_feed.append(item)
                        if len(random_feed) >= limit:
                            break

        return Response(random_feed[:limit])

class ApiWikiArticleView(views.APIView):
    def get(self, request, title):
        encoded_title = requests.utils.quote(title)
        article_data = {'title': title, 'html_content': '', 'extract': '', 'thumbnail': '', 'original_image': '', 'original_url': '', 'description': '', 'related': []}
        try:
            s_resp = requests.get(f'https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_title}', timeout=10, headers=WIKI_HEADERS)
            if s_resp.status_code == 200:
                sd = s_resp.json()
                article_data.update({'title': sd.get('title', title), 'extract': sd.get('extract', ''), 'description': sd.get('description', ''), 'thumbnail': sd.get('thumbnail', {}).get('source', ''), 'original_image': sd.get('originalimage', {}).get('source', ''), 'original_url': sd.get('content_urls', {}).get('desktop', {}).get('page', '')})
            p_resp = requests.get('https://en.wikipedia.org/w/api.php', params={'action': 'parse', 'page': title, 'prop': 'text', 'format': 'json', 'formatversion': 2, 'redirects': 1}, timeout=15, headers=WIKI_HEADERS)
            if p_resp.status_code == 200:
                article_data['html_content'] = sanitize_wikipedia_html(p_resp.json().get('parse', {}).get('text', ''))
            r_resp = requests.get('https://en.wikipedia.org/w/api.php', params={'action': 'query', 'titles': title, 'prop': 'links', 'pllimit': 10, 'plnamespace': 0, 'format': 'json'}, timeout=10, headers=WIKI_HEADERS)
            if r_resp.status_code == 200:
                pages = r_resp.json().get('query', {}).get('pages', {})
                for _, pd in pages.items():
                    article_data['related'].extend([l['title'] for l in pd.get('links', [])])
        except: pass
        return Response(article_data)
