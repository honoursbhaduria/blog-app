from django import forms
from .models import UserProfile


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ('phone', 'github_handle', 'linkedin_handle', 'bio', 'profile_picture')
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
            'bio': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Tell something about yourself...'
            }),
            'profile_picture': forms.ClearableFileInput(attrs={
                'class': 'form-control-file'
            }),
        }
        labels = {
            'phone': 'Phone Number',
            'github_handle': 'GitHub Username',
            'linkedin_handle': 'LinkedIn Username',
            'bio': 'About Me',
            'profile_picture': 'Profile Picture',
        }
