from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone', 'github_handle', 'linkedin_handle', 'created_at')
    search_fields = ('user__username', 'github_handle', 'linkedin_handle')
