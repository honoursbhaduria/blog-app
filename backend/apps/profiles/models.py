from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('Student', 'Student'),
        ('Developer', 'Developer'),
        ('Researcher', 'Researcher'),
        ('Engineer', 'Engineer'),
        ('Designer', 'Designer'),
        ('Other', 'Other'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    about = models.TextField(max_length=500, blank=True, default='')
    profile_image = models.ImageField(upload_to='profile_pics/%Y/%m/%d', blank=True, null=True)
    profile_banner = models.ImageField(upload_to='profile_banners/%Y/%m/%d', blank=True, null=True)
    
    facebook_link = models.URLField(max_length=200, blank=True, default='')
    twitter_link = models.URLField(max_length=200, blank=True, default='')
    instagram_link = models.URLField(max_length=200, blank=True, default='')
    youtube_link = models.URLField(max_length=200, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    github_handle = models.CharField(max_length=100, blank=True, default='')
    linkedin_handle = models.CharField(max_length=100, blank=True, default='')

    # Professional Information
    current_role = models.CharField(max_length=30, choices=ROLE_CHOICES, blank=True, default='')
    company = models.CharField(max_length=150, blank=True, default='')
    university = models.CharField(max_length=200, blank=True, default='')
    degree = models.CharField(max_length=150, blank=True, default='')
    field_of_study = models.CharField(max_length=150, blank=True, default='')
    years_of_experience = models.PositiveIntegerField(default=0)
    open_to_opportunities = models.BooleanField(default=False)
    location = models.CharField(max_length=150, blank=True, default='')
    website = models.URLField(max_length=300, blank=True, default='')
    
    # Notification and Privacy fields
    email_notifications = models.BooleanField(default=True)
    privacy_setting = models.CharField(max_length=20, default='public')
    public_email = models.EmailField(max_length=254, blank=True, default='')
    two_factor_enabled = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"


class FriendRequest(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_REJECTED, 'Rejected'),
    )

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_friend_requests')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_friend_requests')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    responded_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['sender', 'receiver'], name='unique_friend_request_pair'),
            models.CheckConstraint(condition=~models.Q(sender=models.F('receiver')), name='no_self_friend_request'),
        ]
        indexes = [
            models.Index(fields=['receiver', 'status']),
            models.Index(fields=['sender', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.sender.username} -> {self.receiver.username} ({self.status})"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    try:
        instance.profile.save()
    except UserProfile.DoesNotExist:
        UserProfile.objects.create(user=instance)
