import json
import re
import requests
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.conf import settings
from groq import Groq


WIKI_HEADERS = {
    'User-Agent': 'DjangoBlogApp/1.0 (Blog Platform; contact@example.com)'
}


def sanitize_wikipedia_html(raw_html):
    if not raw_html:
        return ''

    cleaned = raw_html

    cleaned = re.sub(r'<script\b[^>]*>.*?</script>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r'<style\b[^>]*>.*?</style>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r'<link\b[^>]*>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<meta\b[^>]*>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<base\b[^>]*>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<(?:html|head|body)\b[^>]*>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'</(?:html|head|body)>', '', cleaned, flags=re.IGNORECASE)

    # Make sure sections are not hidden (Wikipedia mobile payload often sets display:none)
    cleaned = re.sub(r'\sstyle="display\s*:\s*none;?"', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\sstyle='display\s*:\s*none;?'", '', cleaned, flags=re.IGNORECASE)

    # Prevent protocol-relative URLs from being blocked
    cleaned = cleaned.replace('src="//', 'src="https://')
    cleaned = cleaned.replace('href="//', 'href="https://')

    return cleaned


def fetch_wikipedia_results(query, limit=4):
    query = (query or '').strip()
    if not query:
        return []

    search_url = 'https://en.wikipedia.org/w/api.php'
    search_params = {
        'action': 'query',
        'list': 'search',
        'srsearch': query,
        'srlimit': limit,
        'format': 'json',
        'utf8': 1,
    }

    search_resp = requests.get(search_url, params=search_params, timeout=10, headers=WIKI_HEADERS)
    if search_resp.status_code != 200:
        return []

    search_data = search_resp.json()
    search_results = search_data.get('query', {}).get('search', [])
    if not search_results:
        return []

    results = []
    for item in search_results:
        title = item['title']
        summary_url = f'https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}'
        try:
            summary_resp = requests.get(summary_url, timeout=10, headers=WIKI_HEADERS)
            if summary_resp.status_code == 200:
                summary_data = summary_resp.json()
                results.append({
                    'title': summary_data.get('title', title),
                    'extract': summary_data.get('extract', ''),
                    'thumbnail': summary_data.get('thumbnail', {}).get('source', ''),
                    'page_url': summary_data.get('content_urls', {}).get('desktop', {}).get('page', ''),
                })
        except requests.RequestException:
            continue

    return results


@csrf_exempt
@require_POST
def ai_explain(request):
    """
    Accept selected text from blog and return AI explanation via Groq.
    """
    try:
        data = json.loads(request.body)
        selected_text = data.get('selected_text', '').strip()
        blog_title = data.get('blog_title', '')

        if not selected_text:
            return JsonResponse({'error': 'No text selected'}, status=400)

        client = Groq(api_key=settings.GROQ_API_KEY)

        prompt = f"""The user is reading a blog titled "{blog_title}" and has selected the following text for more details:

"{selected_text}"

Please provide a clear, detailed explanation of this text. Include:
1. A simple explanation of what it means
2. Any important context or background
3. Real-world examples if applicable

Keep the response informative but concise (under 300 words)."""

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that explains text from blog posts. Provide clear, informative explanations. Use markdown formatting for better readability."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=500,
        )

        response_text = completion.choices[0].message.content
        return JsonResponse({'explanation': response_text})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_GET
def wiki_search(request):
    """
    Search Wikipedia for related articles and return summaries.
    """
    query = request.GET.get('query', '').strip()
    if not query:
        return JsonResponse({'results': []})

    try:
        results = fetch_wikipedia_results(query, limit=4)
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse({'error': str(e), 'results': []}, status=500)


def wiki_article(request, title):
    """
    Fetch and display a full Wikipedia article on the website.
    """
    encoded_title = requests.utils.quote(title)
    article_data = {
        'title': title,
        'html_content': '',
        'extract': '',
        'thumbnail': '',
        'original_image': '',
        'original_url': '',
        'description': '',
        'related': [],
    }

    try:
        # Get the summary for metadata
        summary_url = f'https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_title}'
        summary_resp = requests.get(summary_url, timeout=10, headers=WIKI_HEADERS)
        if summary_resp.status_code == 200:
            summary_data = summary_resp.json()
            article_data['title'] = summary_data.get('title', title)
            article_data['extract'] = summary_data.get('extract', '')
            article_data['description'] = summary_data.get('description', '')
            article_data['thumbnail'] = summary_data.get('thumbnail', {}).get('source', '')
            article_data['original_image'] = summary_data.get('originalimage', {}).get('source', '')
            article_data['original_url'] = summary_data.get('content_urls', {}).get('desktop', {}).get('page', '')

        # Get article content using parse API (cleaner than mobile-html full document)
        parse_url = 'https://en.wikipedia.org/w/api.php'
        parse_params = {
            'action': 'parse',
            'page': title,
            'prop': 'text',
            'format': 'json',
            'formatversion': 2,
            'redirects': 1,
        }
        parse_resp = requests.get(parse_url, params=parse_params, timeout=15, headers=WIKI_HEADERS)
        if parse_resp.status_code == 200:
            parse_data = parse_resp.json()
            parse_html = parse_data.get('parse', {}).get('text', '')
            article_data['html_content'] = sanitize_wikipedia_html(parse_html)

        # Get related articles
        related_url = 'https://en.wikipedia.org/w/api.php'
        related_params = {
            'action': 'query',
            'titles': title,
            'prop': 'links',
            'pllimit': 10,
            'plnamespace': 0,
            'format': 'json',
        }
        related_resp = requests.get(related_url, params=related_params, timeout=10, headers=WIKI_HEADERS)
        if related_resp.status_code == 200:
            related_data = related_resp.json()
            pages = related_data.get('query', {}).get('pages', {})
            for page_id, page_data in pages.items():
                for link in page_data.get('links', []):
                    article_data['related'].append(link['title'])

    except requests.RequestException:
        pass

    context = {
        'article': article_data,
    }
    return render(request, 'wiki_article.html', context)


@csrf_exempt
@require_POST
def ai_writing_assist(request):
    """
    AI writing assistant for blog creation.
    Supports: generate_titles, improve_text, generate_outline,
              write_intro, seo_description
    """
    try:
        data = json.loads(request.body)
        action = data.get('action', '')
        content = data.get('content', '').strip()
        title = data.get('title', '').strip()
        category = data.get('category', '').strip()

        client = Groq(api_key=settings.GROQ_API_KEY)

        prompts = {
            'generate_titles': f"""Generate 5 creative, SEO-friendly blog title ideas for a blog post about:
Topic/Content: "{content}"
Category: {category or 'General'}

Return ONLY a numbered list of 5 titles. No explanations.""",

            'improve_text': f"""Improve the following blog text to make it more engaging, professional, and well-structured.
Keep the same meaning but enhance clarity, flow, and readability. Use a conversational yet authoritative tone.

Original text:
"{content}"

Return ONLY the improved text.""",

            'generate_outline': f"""Create a detailed blog post outline for:
Title: "{title or content}"
Category: {category or 'General'}

Include an introduction, 4-6 main sections with sub-points, and a conclusion.
Format with markdown headers (##) and bullet points.""",

            'write_intro': f"""Write a compelling, hook-driven introduction paragraph (100-150 words) for a blog post titled:
"{title}"

Category: {category or 'General'}
Context: {content[:300] if content else 'No additional context'}

Make it engaging and draw the reader in. Return ONLY the introduction paragraph.""",

            'seo_description': f"""Write a concise, SEO-optimized meta description (150-160 characters) for:
Title: "{title}"
Content summary: "{content[:300] if content else title}"

Return ONLY the meta description text.""",
        }

        if action not in prompts:
            return JsonResponse({'error': 'Invalid action'}, status=400)

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert blog writing assistant. Be concise, creative, and practical."
                },
                {
                    "role": "user",
                    "content": prompts[action]
                }
            ],
            temperature=0.8,
            max_tokens=800,
        )

        result = completion.choices[0].message.content
        return JsonResponse({'result': result})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def ai_rag_chat(request):
    """
    RAG-style AI chat: answers the user's question using their saved blog
    posts as context documents (Retrieval-Augmented Generation).
    """
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    try:
        from .models import FavoriteBlog

        data = json.loads(request.body)
        question = data.get('question', '').strip()

        if not question:
            return JsonResponse({'error': 'No question provided'}, status=400)

        favorites = (
            FavoriteBlog.objects
            .filter(user=request.user)
            .select_related('blog', 'blog__category')
            .order_by('-created_at')[:10]  # Limit to 10 most-recent to stay within token budget
        )

        if not favorites:
            return JsonResponse({
                'error': 'You have no saved blogs yet. Save some blogs to your library first!'
            }, status=400)

        context_docs = []
        for fav in favorites:
            blog = fav.blog
            # Truncate body to ~1200 chars per blog so the combined context stays
            # comfortably within the model's context window when using 10 blogs.
            doc = (
                f'--- Blog: "{blog.title}" (Category: {blog.category}) ---\n'
                f'Description: {blog.short_description}\n'
                f'Content: {blog.blog_body[:1200]}'
            )
            context_docs.append(doc)

        context_text = '\n\n'.join(context_docs)

        prompt = (
            f'The user has saved the following blog posts to their personal reading library:\n\n'
            f'{context_text}\n\n'
            f'Using ONLY the content from those saved blogs, please answer this question:\n'
            f'{question}\n\n'
            f'If the answer cannot be found in the saved blogs, say so clearly and suggest '
            f'what kind of blogs the user might want to save to get that answer.'
        )

        client = Groq(api_key=settings.GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful AI assistant that helps users learn from their "
                        "saved blog collection. Base your answers on the provided blog content. "
                        "Use markdown formatting for clarity."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=800,
        )

        answer = completion.choices[0].message.content
        return JsonResponse({'answer': answer})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

