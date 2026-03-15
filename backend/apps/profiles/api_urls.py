from django.urls import path
from . import api_views

urlpatterns = [
    path('edit/', api_views.EditProfileView.as_view(), name='api_edit_profile'),
    path('users/search/', api_views.UserSearchView.as_view(), name='api_user_search'),
    path('friends/', api_views.FriendsListView.as_view(), name='api_friends_list'),
    path('friends/requests/', api_views.FriendRequestsView.as_view(), name='api_friend_requests'),
    path('friends/<str:username>/<str:action>/', api_views.FriendActionView.as_view(), name='api_friend_action'),
    path('<str:username>/', api_views.ViewProfileView.as_view(), name='api_view_profile'),
    path('<str:username>/blogs/', api_views.ProfileBlogsView.as_view(), name='api_profile_blogs'),
    path('<str:username>/favorites/', api_views.ProfileFavoritesView.as_view(), name='api_profile_favorites'),
]
