from django.urls import path
from . import views
from . import ai_views

urlpatterns = [
    path('<int:category_id>/', views.posts_by_category, name='posts_by_category'),
    # AI API endpoints
    path('api/ai-explain/', ai_views.ai_explain, name='ai_explain'),
    path('api/wiki-search/', ai_views.wiki_search, name='wiki_search'),
    path('api/ai-write/', ai_views.ai_writing_assist, name='ai_writing_assist'),
    path('api/ai-rag-chat/', ai_views.ai_rag_chat, name='ai_rag_chat'),
    # Wikipedia article reader
    path('wiki/<str:title>/', ai_views.wiki_article, name='wiki_article'),
]