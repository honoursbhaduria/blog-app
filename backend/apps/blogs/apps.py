from django.apps import AppConfig
from django.db.models.signals import post_migrate


def sync_predefined_categories(sender, **kwargs):
    from .constants import PREDEFINED_TECH_CATEGORIES_LOWER, PREDEFINED_TECH_CATEGORIES
    from .models import Category

    existing_names = {
        name.lower()
        for name in Category.objects.values_list('category_name', flat=True)
    }

    missing = [
        Category(category_name=name)
        for name in PREDEFINED_TECH_CATEGORIES
        if name.lower() not in existing_names
    ]

    if missing:
        Category.objects.bulk_create(missing)


class BlogsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.blogs'

    def ready(self):
        post_migrate.connect(sync_predefined_categories, sender=self)
