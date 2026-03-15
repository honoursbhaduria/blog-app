from rest_framework import serializers
from .models import UserProfile, FriendRequest
from django.contrib.auth.models import User
from django.db.models import Q


def get_friend_state_for_user(request_user, target_user):
    if not request_user or not request_user.is_authenticated:
        return 'none'
    if request_user.id == target_user.id:
        return 'self'

    is_friend = FriendRequest.objects.filter(
        Q(sender=request_user, receiver=target_user, status=FriendRequest.STATUS_ACCEPTED)
        | Q(sender=target_user, receiver=request_user, status=FriendRequest.STATUS_ACCEPTED)
    ).exists()
    if is_friend:
        return 'friends'

    has_outgoing = FriendRequest.objects.filter(
        sender=request_user,
        receiver=target_user,
        status=FriendRequest.STATUS_PENDING,
    ).exists()
    if has_outgoing:
        return 'outgoing_pending'

    has_incoming = FriendRequest.objects.filter(
        sender=target_user,
        receiver=request_user,
        status=FriendRequest.STATUS_PENDING,
    ).exists()
    if has_incoming:
        return 'incoming_pending'

    return 'none'

class ProfileUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')
        read_only_fields = ('username', 'email')

class UserProfileSerializer(serializers.ModelSerializer):
    user = ProfileUserSerializer(read_only=True)
    friend_state = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()
    friends_count = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = (
            'id', 'user', 'profile_image', 'profile_banner', 'about',
            'phone', 'github_handle', 'linkedin_handle',
            'current_role', 'company', 'university', 'degree',
            'field_of_study', 'years_of_experience', 'open_to_opportunities',
            'location', 'website',
            'facebook_link', 'twitter_link', 'instagram_link', 'youtube_link',
            'public_email', 'friend_state', 'is_self', 'friends_count'
        )

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

    def get_friend_state(self, obj):
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)
        return get_friend_state_for_user(request_user, obj.user)

    def get_is_self(self, obj):
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)
        return bool(request_user and request_user.is_authenticated and request_user.id == obj.user_id)

    def get_friends_count(self, obj):
        return FriendRequest.objects.filter(
            Q(sender=obj.user, status=FriendRequest.STATUS_ACCEPTED)
            | Q(receiver=obj.user, status=FriendRequest.STATUS_ACCEPTED)
        ).count()


class UserSearchSerializer(serializers.ModelSerializer):
    profile_image = serializers.ImageField(source='profile.profile_image', read_only=True)
    about = serializers.CharField(source='profile.about', read_only=True)
    current_role = serializers.CharField(source='profile.current_role', read_only=True)
    friend_state = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'first_name', 'last_name',
            'profile_image', 'about', 'current_role', 'friend_state'
        )

    def get_friend_state(self, obj):
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)
        return get_friend_state_for_user(request_user, obj)


class FriendRequestSerializer(serializers.ModelSerializer):
    sender = ProfileUserSerializer(read_only=True)
    receiver = ProfileUserSerializer(read_only=True)

    class Meta:
        model = FriendRequest
        fields = (
            'id', 'sender', 'receiver', 'status',
            'created_at', 'updated_at', 'responded_at'
        )
