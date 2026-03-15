from django.shortcuts import get_object_or_404, redirect, render
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages

from apps.blogs.models import Blog
from .models import UserProfile
from .forms import UserProfileForm


@login_required(login_url='login')
def edit_profile(request):
    # Get or create profile for current user
    profile, created = UserProfile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        form = UserProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profile updated successfully!')
            return redirect('edit_profile')
    else:
        form = UserProfileForm(instance=profile)

    context = {
        'form': form,
        'profile': profile,
    }
    return render(request, 'dashboard/profile_edit.html', context)


def view_profile(request, username):
    user = get_object_or_404(User, username=username)
    profile, created = UserProfile.objects.get_or_create(user=user)
    user_blogs = Blog.objects.filter(author=user, status='Published').order_by('-created_at')

    context = {
        'profile_user': user,
        'profile': profile,
        'user_blogs': user_blogs,
    }
    return render(request, 'profile_public.html', context)
