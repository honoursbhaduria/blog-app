from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify

class Category(models.Model):
    category_name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.category_name

class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

STATUS_CHOICES = (
    ("Draft", "Draft"),
    ("Published", "Published")
)

DIFFICULTY_CHOICES = (
    ("Beginner", "Beginner"),
    ("Intermediate", "Intermediate"),
    ("Advanced", "Advanced")
)

SOURCE_CHOICES = (
    ("User Generated", "User Generated"),
    ("Wikipedia", "Wikipedia"),
    ("External Article", "External Article")
)

VISIBILITY_CHOICES = (
    ("Public", "Public"),
    ("Unlisted", "Unlisted"),
    ("Private", "Private"),
)

class Blog(models.Model):
    title = models.CharField(max_length=100)
    subtitle = models.CharField(max_length=300, blank=True, default='')
    slug = models.SlugField(max_length=150, unique=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    featured_image = models.ImageField(upload_to='uploads/%Y/%m/%d', blank=True, null=True)
    short_description = models.TextField(max_length=500)
    blog_body = models.TextField(max_length=50000)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Draft")
    is_featured = models.BooleanField(default=False)
    
    # Tech Blog Extensions
    tags = models.ManyToManyField(Tag, blank=True, related_name='blogs')
    difficulty_level = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default="Beginner")
    reference_links = models.TextField(blank=True, help_text="Comma separated or markdown links")
    source_type = models.CharField(max_length=30, choices=SOURCE_CHOICES, default="User Generated")
    source_url = models.URLField(max_length=500, blank=True, null=True)
    view_count = models.PositiveIntegerField(default=0)
    
    # AI Reference System
    is_ai_reference = models.BooleanField(default=False)
    topic_category = models.CharField(max_length=100, blank=True)
    reference_priority = models.IntegerField(default=0, help_text="Higher number = higher priority for AI")

    # Publishing Settings
    allow_comments = models.BooleanField(default=True)
    allow_likes = models.BooleanField(default=True)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default="Public")
    scheduled_publish_at = models.DateTimeField(blank=True, null=True)
    citation = models.TextField(blank=True, default='', help_text="Attribution or citation for the content")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title)[:140] or 'blog'
            candidate = base_slug
            counter = 1
            while Blog.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                suffix = f"-{counter}"
                candidate = f"{base_slug[:150 - len(suffix)]}{suffix}"
                counter += 1
            self.slug = candidate
        super().save(*args, **kwargs)

class Cluster(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(max_length=500, blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='clusters')
    tags = models.ManyToManyField(Tag, blank=True)
    blogs = models.ManyToManyField(Blog, blank=True, related_name='clusters')
    wiki_articles = models.ManyToManyField('SavedWikiArticle', blank=True, related_name='clusters')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('owner', 'name')

    def __str__(self):
        return self.name

class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'blog')

    def __str__(self):
        return f"{self.user.username} favorited {self.blog.title}"

class Comment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE)
    comment = models.TextField(max_length=250)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.comment


class Like(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'blog')

    def __str__(self):
        return f"{self.user.username} likes {self.blog.title}"


WIKI_BOARD_COLUMN_CHOICES = (
    ("Inbox", "Inbox"),
    ("Reading", "Reading"),
    ("Completed", "Completed"),
)

class SavedWikiArticle(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_wiki_articles')
    title = models.CharField(max_length=300)
    extract = models.TextField(blank=True, default='')
    thumbnail = models.URLField(max_length=500, blank=True, default='')
    original_url = models.URLField(max_length=500, blank=True, default='')
    html_content = models.TextField(blank=True, default='')
    liked = models.BooleanField(default=False)
    board_column = models.CharField(max_length=20, choices=WIKI_BOARD_COLUMN_CHOICES, default="Inbox")
    board_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['board_order']
        unique_together = ('user', 'title')

    def __str__(self):
        return f"{self.user.username} saved: {self.title}"

