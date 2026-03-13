from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.contrib.auth.decorators import login_required

from .models import Blog, Category, Comment, Like
from django.db.models import Q
from .ai_views import fetch_wikipedia_results



def posts_by_category(request, category_id):
    # Fetch the posts that belongs to the category with the id category_id
    posts = Blog.objects.filter(status='Published', category=category_id)
    # Use try/except when we want to do some custom action if the category does not exists
    # try:
    #     category = Category.objects.get(pk=category_id)
    # except:
    #     # redirect the user to homepage
    #     return redirect('home')
    
    # Use get_object_or_404 when you want to show 404 error page if the category does not exist
    category = get_object_or_404(Category, pk=category_id)
    
    context = {
        'posts': posts,
        'category': category,
    }
    return render(request, 'posts_by_category.html', context)


def blogs(request, slug):
    single_blog = get_object_or_404(Blog, slug=slug, status='Published')
    if request.method == 'POST':
        comment = Comment()
        comment.user = request.user
        comment.blog = single_blog
        comment.comment = request.POST['comment']
        comment.save()
        return HttpResponseRedirect(request.path_info)

    # Comments
    comments = Comment.objects.filter(blog=single_blog)
    comment_count = comments.count()

    # Likes
    like_count = Like.objects.filter(blog=single_blog).count()
    user_has_liked = (
        request.user.is_authenticated
        and Like.objects.filter(blog=single_blog, user=request.user).exists()
    )

    context = {
        'single_blog': single_blog,
        'comments': comments,
        'comment_count': comment_count,
        'like_count': like_count,
        'user_has_liked': user_has_liked,
    }
    return render(request, 'blogs.html', context)


@login_required(login_url='login')
def like_blog(request, slug):
    blog = get_object_or_404(Blog, slug=slug, status='Published')
    like, created = Like.objects.get_or_create(user=request.user, blog=blog)
    if not created:
        like.delete()
    like_count = Like.objects.filter(blog=blog).count()
    user_has_liked = created
    return JsonResponse({'like_count': like_count, 'user_has_liked': user_has_liked})

def search(request):
    keyword = (request.GET.get('keyword') or '').strip()

    if keyword:
        blogs = Blog.objects.filter(
            Q(title__icontains=keyword) |
            Q(short_description__icontains=keyword) |
            Q(blog_body__icontains=keyword),
            status='Published'
        )
        wiki_results = fetch_wikipedia_results(keyword, limit=6)
    else:
        blogs = Blog.objects.none()
        wiki_results = []

    context = {
        'blogs': blogs,
        'keyword': keyword,
        'wiki_results': wiki_results,
    }
    return render(request, 'search.html', context)