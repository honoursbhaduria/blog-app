from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blogs', '0010_cluster_uniqueness_savedwiki_liked_and_optional_draft_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='cluster',
            name='wiki_articles',
            field=models.ManyToManyField(blank=True, related_name='clusters', to='blogs.savedwikiarticle'),
        ),
    ]
