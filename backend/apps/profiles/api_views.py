from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
from .models import UserProfile, FriendRequest
from .serializers import (
    UserProfileSerializer,
    UserSearchSerializer,
    FriendRequestSerializer,
)
from django.contrib.auth.models import User
from apps.blogs.models import Blog, Favorite
from apps.blogs.serializers import BlogSerializer

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

    def perform_update(self, serializer):
        user_data = self.request.data.get('user', {})
        if user_data:
            user = self.request.user
            user.first_name = user_data.get('first_name', user.first_name)
            user.last_name = user_data.get('last_name', user.last_name)
            user.save()
        serializer.save()

class ViewProfileView(generics.RetrieveAPIView):
    serializer_class = UserProfileSerializer

    def get_object(self):
        username = self.kwargs.get('username')
        user = get_object_or_404(User, username=username)
        profile, created = UserProfile.objects.get_or_create(user=user)
        return profile

class ProfileBlogsView(generics.ListAPIView):
    serializer_class = BlogSerializer

    def get_queryset(self):
        username = self.kwargs.get('username')
        user = get_object_or_404(User, username=username)
        return Blog.objects.filter(author=user, status='Published').order_by('-created_at')

class ProfileFavoritesView(generics.ListAPIView):
    serializer_class = BlogSerializer

    def get_queryset(self):
        username = self.kwargs.get('username')
        user = get_object_or_404(User, username=username)
        favorite_blogs_ids = Favorite.objects.filter(user=user).values_list('blog_id', flat=True)
        return Blog.objects.filter(id__in=favorite_blogs_ids, status='Published').order_by('-created_at')


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
        queryset = User.objects.select_related('profile').exclude(id=self.request.user.id).order_by('username')
        if not query:
            return queryset[:25]
        return queryset.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )[:25]


class FriendsListView(generics.ListAPIView):
    serializer_class = UserSearchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        friend_ids = get_friend_ids_for_user(self.request.user)
        return User.objects.select_related('profile').filter(id__in=friend_ids).order_by('username')


class FriendRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        incoming = FriendRequest.objects.filter(
            receiver=request.user,
            status=FriendRequest.STATUS_PENDING,
        ).select_related('sender', 'receiver').order_by('-created_at')
        outgoing = FriendRequest.objects.filter(
            sender=request.user,
            status=FriendRequest.STATUS_PENDING,
        ).select_related('sender', 'receiver').order_by('-created_at')

        return Response({
            'incoming': FriendRequestSerializer(incoming, many=True).data,
            'outgoing': FriendRequestSerializer(outgoing, many=True).data,
        })


class FriendActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username, action):
        target = get_object_or_404(User, username=username)
        user = request.user

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
                return Response({'detail': 'Friend request canceled.', 'state': 'none'}, status=status.HTTP_200_OK)

            if incoming and incoming.status == FriendRequest.STATUS_PENDING:
                incoming.status = FriendRequest.STATUS_ACCEPTED
                incoming.responded_at = timezone.now()
                incoming.save(update_fields=['status', 'responded_at', 'updated_at'])
                return Response({'detail': 'Friend request accepted.', 'state': 'friends'}, status=status.HTTP_200_OK)

            friend_request, _ = FriendRequest.objects.update_or_create(
                sender=user,
                receiver=target,
                defaults={'status': FriendRequest.STATUS_PENDING, 'responded_at': None},
            )
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
            return Response({'detail': 'Friend request rejected.', 'state': 'none'}, status=status.HTTP_200_OK)

        if action == 'remove':
            FriendRequest.objects.filter(
                Q(sender=user, receiver=target, status=FriendRequest.STATUS_ACCEPTED)
                | Q(sender=target, receiver=user, status=FriendRequest.STATUS_ACCEPTED)
            ).delete()
            return Response({'detail': 'Friend removed.', 'state': 'none'}, status=status.HTTP_200_OK)

        raise serializers.ValidationError({'detail': 'Unsupported friend action.'})
