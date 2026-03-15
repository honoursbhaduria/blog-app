from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import api_views, ai_views

router = DefaultRouter()
router.register(r'clusters', api_views.ClusterViewSet, basename='cluster')
router.register(r'saved-wiki', api_views.SavedWikiArticleViewSet, basename='saved-wiki')
router.register(r'comments/(?P<blog_slug>[-\w]+)', api_views.CommentViewSet, basename='comment')
router.register(r'users', api_views.UserViewSet, basename='user')
router.register(r'categories', api_views.CategoryViewSet, basename='category')
router.register(r'posts', api_views.BlogViewSet, basename='blog')

urlpatterns = [
    path('ai/explain/', ai_views.ai_explain, name='api_ai_explain'),
    path('ai/write/', ai_views.ai_writing_assist, name='api_ai_write'),
    path('tags/', api_views.TagListView.as_view(), name='api_tags_list'),
    path('trending/', api_views.TrendingBlogView.as_view(), name='api_blogs_trending'),
    path('stats/', api_views.GlobalStatsView.as_view(), name='api_global_stats'),
    path('search-wiki/', api_views.WikipediaSearchView.as_view(), name='api_search_wiki'),
    path('random-wiki/', api_views.WikipediaRandomFeedView.as_view(), name='api_random_wiki'),
    path('wiki/<str:title>/', api_views.ApiWikiArticleView.as_view(), name='api_wiki_detail'),
    path('', include(router.urls)),
]
