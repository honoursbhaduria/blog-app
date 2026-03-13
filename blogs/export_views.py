from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required
from blogs.models import Blog


@login_required(login_url='login')
def export_to_medium(request, pk):
    """
    Generate a downloadable HTML file of the blog post formatted for Medium.
    Users can copy-paste this content into Medium's editor.
    """
    post = get_object_or_404(Blog, pk=pk)

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{post.title}</title>
    <style>
        body {{ font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.8; color: #333; }}
        h1 {{ font-size: 2.2em; margin-bottom: 0.3em; }}
        .subtitle {{ font-size: 1.2em; color: #666; margin-bottom: 2em; }}
        img {{ max-width: 100%; height: auto; }}
        p {{ margin-bottom: 1.5em; }}
    </style>
</head>
<body>
    <h1>{post.title}</h1>
    <p class="subtitle">{post.short_description}</p>
    <hr>
    <div>{post.blog_body}</div>
    <hr>
    <p><em>Originally published on Django Blog by {post.author.get_full_name() or post.author.username}</em></p>
</body>
</html>"""

    response = HttpResponse(html_content, content_type='text/html')
    response['Content-Disposition'] = f'attachment; filename="{post.slug}_medium.html"'
    return response
