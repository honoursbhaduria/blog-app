from rest_framework import serializers
from .models import Category, Blog, Comment, Like, Tag, Cluster, Favorite, SavedWikiArticle
from .constants import PREDEFINED_TECH_CATEGORIES_LOWER
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name')

class CategorySerializer(serializers.ModelSerializer):
    is_predefined = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'category_name', 'created_at', 'updated_at', 'is_predefined')

    def get_is_predefined(self, obj):
        return obj.category_name.lower() in PREDEFINED_TECH_CATEGORIES_LOWER

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = '__all__'

class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Comment
        fields = ('id', 'user', 'blog', 'comment', 'created_at', 'updated_at')
        read_only_fields = ('user', 'blog')

class BlogSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(source='category', queryset=Category.objects.all(), write_only=True)
    author = UserSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(source='tags', queryset=Tag.objects.all(), many=True, write_only=True, required=False)
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    favorite_count = serializers.SerializerMethodField()
    read_time = serializers.SerializerMethodField()

    class Meta:
        model = Blog
        fields = '__all__'

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_comment_count(self, obj):
        return Comment.objects.filter(blog=obj).count()

    def get_favorite_count(self, obj):
        return obj.favorited_by.count()

    def get_read_time(self, obj):
        words = len(obj.blog_body.split())
        return max(1, round(words / 200)) # Approx 200 words per minute

class FavoriteSerializer(serializers.ModelSerializer):
    blog = BlogSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ('id', 'user', 'blog', 'created_at')

class SavedWikiArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedWikiArticle
        fields = ('id', 'title', 'extract', 'thumbnail', 'original_url', 'html_content', 'liked', 'board_column', 'board_order', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

class ClusterSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(source='tags', queryset=Tag.objects.all(), many=True, write_only=True, required=False)
    selectedTags = serializers.PrimaryKeyRelatedField(source='tags', queryset=Tag.objects.all(), many=True, write_only=True, required=False)
    blogs = BlogSerializer(many=True, read_only=True)
    blog_ids = serializers.PrimaryKeyRelatedField(source='blogs', queryset=Blog.objects.all(), many=True, write_only=True, required=False)
    selectedBlogs = serializers.PrimaryKeyRelatedField(source='blogs', queryset=Blog.objects.all(), many=True, write_only=True, required=False)
    wiki_articles = SavedWikiArticleSerializer(many=True, read_only=True)
    wiki_article_ids = serializers.PrimaryKeyRelatedField(source='wiki_articles', queryset=SavedWikiArticle.objects.all(), many=True, write_only=True, required=False)
    selectedWikiArticles = serializers.PrimaryKeyRelatedField(source='wiki_articles', queryset=SavedWikiArticle.objects.all(), many=True, write_only=True, required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request') if hasattr(self, 'context') else None
        if request and request.user and request.user.is_authenticated:
            self.fields['blog_ids'].queryset = Blog.objects.filter(author=request.user)
            self.fields['selectedBlogs'].queryset = Blog.objects.filter(author=request.user)
            self.fields['wiki_article_ids'].queryset = SavedWikiArticle.objects.filter(user=request.user)
            self.fields['selectedWikiArticles'].queryset = SavedWikiArticle.objects.filter(user=request.user)

    class Meta:
        model = Cluster
        fields = '__all__'
