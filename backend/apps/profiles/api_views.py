from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count
from django.utils import timezone
from django.core.cache import cache
from .models import UserProfile, FriendRequest
from .serializers import (
    UserProfileSerializer,
    UserSearchSerializer,
    FriendRequestSerializer,
    get_friend_state_map_for_user,
)
from django.contrib.auth.models import User
from apps.blogs.models import Blog, Favorite
from apps.blogs.serializers import BlogSerializer


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

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=6)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')

    def create(self, validated_data):
        try:
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data.get('email', ''),
                password=validated_data['password']
            )
            return user
        except Exception as e:
            raise serializers.ValidationError({"error": str(e)})

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

class EditProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        return profile

    def retrieve(self, request, *args, **kwargs):
        version = get_cache_version('api:profiles:edit:version')
        cache_key = f"api:profiles:edit:v{version}:u{request.user.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().retrieve(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 60)
        return response

    def perform_update(self, serializer):
        user_data = self.request.data.get('user', {})
        if not isinstance(user_data, dict):
            user_data = {}

        first_name = user_data.get('first_name', self.request.data.get('first_name'))
        last_name = user_data.get('last_name', self.request.data.get('last_name'))

        if first_name is not None or last_name is not None:
            user = self.request.user
            if first_name is not None:
                user.first_name = first_name
            if last_name is not None:
                user.last_name = last_name
            user.save(update_fields=['first_name', 'last_name'])

        serializer.save()
        bump_cache_version('api:profiles:edit:version')

class ViewProfileView(generics.RetrieveAPIView):
    serializer_class = UserProfileSerializer

    def get_object(self):
        username = self.kwargs.get('username')
        user = get_object_or_404(User, username=username)
        profile, created = UserProfile.objects.get_or_create(user=user)
        return profile

    def retrieve(self, request, *args, **kwargs):
        username = self.kwargs.get('username')
        version = get_cache_version('api:profiles:view:version')
        viewer = request.user.id if request.user.is_authenticated else 'anon'
        cache_key = f"api:profiles:view:v{version}:viewer:{viewer}:target:{username}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().retrieve(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 60)
        return response

class ProfileBlogsView(generics.ListAPIView):
    serializer_class = BlogSerializer

    def get_queryset(self):
        username = self.kwargs.get('username')
        user = get_object_or_404(User, username=username)
        return Blog.objects.filter(author=user, status='Published')\
            .select_related('category', 'author')\
            .prefetch_related('tags')\
            .annotate(like_count_annotated=Count('likes', distinct=True),
                      favorite_count_annotated=Count('favorited_by', distinct=True),
                      comment_count_annotated=Count('comment', distinct=True))\
            .order_by('-created_at')

    def list(self, request, *args, **kwargs):
        username = self.kwargs.get('username')
        version = get_cache_version('api:profiles:blogs:version')
        cache_key = f"api:profiles:blogs:v{version}:{username}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 60)
        return response

class ProfileFavoritesView(generics.ListAPIView):
    serializer_class = BlogSerializer

    def get_queryset(self):
        username = self.kwargs.get('username')
        user = get_object_or_404(User, username=username)
        favorite_blogs_ids = Favorite.objects.filter(user=user).values_list('blog_id', flat=True)
        return Blog.objects.filter(id__in=favorite_blogs_ids, status='Published')\
            .select_related('category', 'author')\
            .prefetch_related('tags')\
            .annotate(like_count_annotated=Count('likes', distinct=True),
                      favorite_count_annotated=Count('favorited_by', distinct=True),
                      comment_count_annotated=Count('comment', distinct=True))\
            .order_by('-created_at')

    def list(self, request, *args, **kwargs):
        username = self.kwargs.get('username')
        version = get_cache_version('api:profiles:favorites:version')
        cache_key = f"api:profiles:favorites:v{version}:{username}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 60)
        return response


def get_friend_ids_for_user(user):
    accepted = FriendRequest.objects.filter(
        Q(sender=user, status=FriendRequest.STATUS_ACCEPTED)
        | Q(receiver=user, status=FriendRequest.STATUS_ACCEPTED)
    ).values('sender_id', 'receiver_id')

    friend_ids = set()
    for row in accepted:
        if row['sender_id'] != user.id:
            friend_ids.add(row['sender_id'])
        if row['receiver_id'] != user.id:
            friend_ids.add(row['receiver_id'])
    return friend_ids


class UserSearchView(generics.ListAPIView):
    serializer_class = UserSearchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get('q', '').strip()
        queryset = User.objects.select_related('profile').only(
            'id',
            'username',
            'first_name',
            'last_name',
            'profile__profile_image',
            'profile__about',
            'profile__current_role',
        ).exclude(id=self.request.user.id).order_by('username')
        if not query:
            return queryset[:25]

        prefix_matches = list(queryset.filter(
            Q(username__istartswith=query)
            | Q(first_name__istartswith=query)
            | Q(last_name__istartswith=query)
        )[:25])

        if len(prefix_matches) >= 25:
            return prefix_matches

        missing = 25 - len(prefix_matches)
        existing_ids = [user.id for user in prefix_matches]
        contains_fallback = list(
            queryset.exclude(id__in=existing_ids).filter(
                Q(username__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )[:missing]
        )
        return prefix_matches + contains_fallback

    def list(self, request, *args, **kwargs):
        query = request.query_params.get('q', '').strip().lower()
        cache_key = f"api:profiles:user-search:v2:{request.user.id}:{query}"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        queryset = self.filter_queryset(self.get_queryset())
        if hasattr(queryset, 'values_list'):
            user_ids = list(queryset.values_list('id', flat=True))
        else:
            user_ids = [user.id for user in queryset]
        friend_state_map = get_friend_state_map_for_user(request.user, user_ids)

        serializer = self.get_serializer(queryset, many=True, context={
            **self.get_serializer_context(),
            'friend_state_map': friend_state_map,
        })
        data = serializer.data
        cache.set(cache_key, data, 60)
        return Response(data)


class FriendsListView(generics.ListAPIView):
    serializer_class = UserSearchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        friend_ids = get_friend_ids_for_user(self.request.user)
        return User.objects.select_related('profile').only(
            'id',
            'username',
            'first_name',
            'last_name',
            'profile__profile_image',
            'profile__about',
            'profile__current_role',
        ).filter(id__in=friend_ids).order_by('username')

    def list(self, request, *args, **kwargs):
        cache_key = f"api:profiles:friends-list:v1:{request.user.id}"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        queryset = self.filter_queryset(self.get_queryset())
        user_ids = list(queryset.values_list('id', flat=True))
        friend_state_map = get_friend_state_map_for_user(request.user, user_ids)

        serializer = self.get_serializer(queryset, many=True, context={
            **self.get_serializer_context(),
            'friend_state_map': friend_state_map,
        })
        data = serializer.data
        cache.set(cache_key, data, 30)
        return Response(data)


class FriendRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cache_key = f"api:profiles:friend-requests:v1:{request.user.id}"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        incoming = FriendRequest.objects.filter(
            receiver=request.user,
            status=FriendRequest.STATUS_PENDING,
        ).select_related('sender', 'receiver').order_by('-created_at')
        outgoing = FriendRequest.objects.filter(
            sender=request.user,
            status=FriendRequest.STATUS_PENDING,
        ).select_related('sender', 'receiver').order_by('-created_at')

        payload = {
            'incoming': FriendRequestSerializer(incoming, many=True).data,
            'outgoing': FriendRequestSerializer(outgoing, many=True).data,
        }
        cache.set(cache_key, payload, 20)
        return Response(payload)


class FriendActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username, action):
        target = get_object_or_404(User, username=username)
        user = request.user

        def invalidate_social_caches():
            bump_cache_version('api:profiles:view:version')
            bump_cache_version('api:profiles:favorites:version')
            bump_cache_version('api:profiles:blogs:version')
            cache.delete(f"api:profiles:friends-list:v1:{user.id}")
            cache.delete(f"api:profiles:friends-list:v1:{target.id}")
            cache.delete(f"api:profiles:friend-requests:v1:{user.id}")
            cache.delete(f"api:profiles:friend-requests:v1:{target.id}")

        if target.id == user.id:
            raise serializers.ValidationError({'detail': 'You cannot perform this action on yourself.'})

        if action == 'invite':
            if FriendRequest.objects.filter(
                Q(sender=user, receiver=target, status=FriendRequest.STATUS_ACCEPTED)
                | Q(sender=target, receiver=user, status=FriendRequest.STATUS_ACCEPTED)
            ).exists():
                return Response({'detail': 'You are already friends.'}, status=status.HTTP_200_OK)

            outgoing = FriendRequest.objects.filter(sender=user, receiver=target).first()
            incoming = FriendRequest.objects.filter(sender=target, receiver=user).first()

            if outgoing and outgoing.status == FriendRequest.STATUS_PENDING:
                outgoing.delete()
                invalidate_social_caches()
                return Response({'detail': 'Friend request canceled.', 'state': 'none'}, status=status.HTTP_200_OK)

            if incoming and incoming.status == FriendRequest.STATUS_PENDING:
                incoming.status = FriendRequest.STATUS_ACCEPTED
                incoming.responded_at = timezone.now()
                incoming.save(update_fields=['status', 'responded_at', 'updated_at'])
                invalidate_social_caches()
                return Response({'detail': 'Friend request accepted.', 'state': 'friends'}, status=status.HTTP_200_OK)

            friend_request, _ = FriendRequest.objects.update_or_create(
                sender=user,
                receiver=target,
                defaults={'status': FriendRequest.STATUS_PENDING, 'responded_at': None},
            )
            invalidate_social_caches()
            return Response(FriendRequestSerializer(friend_request).data, status=status.HTTP_201_CREATED)

        if action == 'accept':
            incoming = get_object_or_404(
                FriendRequest,
                sender=target,
                receiver=user,
                status=FriendRequest.STATUS_PENDING,
            )
            incoming.status = FriendRequest.STATUS_ACCEPTED
            incoming.responded_at = timezone.now()
            incoming.save(update_fields=['status', 'responded_at', 'updated_at'])
            invalidate_social_caches()
            return Response({'detail': 'Friend request accepted.', 'state': 'friends'}, status=status.HTTP_200_OK)

        if action == 'reject':
            incoming = get_object_or_404(
                FriendRequest,
                sender=target,
                receiver=user,
                status=FriendRequest.STATUS_PENDING,
            )
            incoming.status = FriendRequest.STATUS_REJECTED
            incoming.responded_at = timezone.now()
            incoming.save(update_fields=['status', 'responded_at', 'updated_at'])
            invalidate_social_caches()
            return Response({'detail': 'Friend request rejected.', 'state': 'none'}, status=status.HTTP_200_OK)

        if action == 'remove':
            FriendRequest.objects.filter(
                Q(sender=user, receiver=target, status=FriendRequest.STATUS_ACCEPTED)
                | Q(sender=target, receiver=user, status=FriendRequest.STATUS_ACCEPTED)
            ).delete()
            invalidate_social_caches()
            return Response({'detail': 'Friend removed.', 'state': 'none'}, status=status.HTTP_200_OK)

        raise serializers.ValidationError({'detail': 'Unsupported friend action.'})
