from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blogs', '0009_seed_predefined_tech_categories'),
    ]

    operations = [
        migrations.AlterField(
            model_name='blog',
            name='featured_image',
            field=models.ImageField(blank=True, null=True, upload_to='uploads/%Y/%m/%d'),
        ),
        migrations.AlterField(
            model_name='cluster',
            name='name',
            field=models.CharField(max_length=150),
        ),
        migrations.AlterUniqueTogether(
            name='cluster',
            unique_together={('owner', 'name')},
        ),
        migrations.AddField(
            model_name='savedwikiarticle',
            name='liked',
            field=models.BooleanField(default=False),
        ),
    ]
