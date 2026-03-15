from django.contrib import admin
from .models import UserProfile, FriendRequest


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone', 'github_handle', 'linkedin_handle', 'created_at')
    search_fields = ('user__username', 'github_handle', 'linkedin_handle')


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = ('sender', 'receiver', 'status', 'created_at', 'responded_at')
    list_filter = ('status', 'created_at')
    search_fields = ('sender__username', 'receiver__username')
