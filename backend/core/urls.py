from django.contrib import admin
from django.urls import include, path
from django.conf.urls.static import static
from django.conf import settings
from .api_views import health_check

urlpatterns = [
    path('', health_check, name='root_health_check'),
    path('admin/', admin.site.urls),
    
    # API endpoints
    path('api/v1/', include('core.api_urls')),
    path('api/v1/blogs/', include('apps.blogs.api_urls')),
    path('api/v1/profiles/', include('apps.profiles.api_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
