from django import forms
from .models import UserProfile


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ('phone', 'github_handle', 'linkedin_handle', 'about', 'profile_image', 'facebook_link', 'twitter_link', 'instagram_link', 'youtube_link')
        widgets = {
            'phone': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '+91 9876543210'
            }),
            'github_handle': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g. octocat'
            }),
            'linkedin_handle': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g. johndoe'
            }),
            'about': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Tell something about yourself...'
            }),
            'profile_image': forms.ClearableFileInput(attrs={
                'class': 'form-control-file'
            }),
            'facebook_link': forms.URLInput(attrs={'class': 'form-control'}),
            'twitter_link': forms.URLInput(attrs={'class': 'form-control'}),
            'instagram_link': forms.URLInput(attrs={'class': 'form-control'}),
            'youtube_link': forms.URLInput(attrs={'class': 'form-control'}),
        }
        labels = {
            'phone': 'Phone Number',
            'github_handle': 'GitHub Username',
            'linkedin_handle': 'LinkedIn Username',
            'about': 'About Me',
            'profile_image': 'Profile Picture',
        }
