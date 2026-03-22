import json
import re
import requests
import wikipediaapi
from concurrent.futures import ThreadPoolExecutor
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.core.cache import cache
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.conf import settings
from groq import Groq


WIKI_HEADERS = {
    'User-Agent': 'DjangoBlogApp/1.0 (https://example.com/blog; contact@example.com)'
}

WIKI_SESSION = requests.Session()
_wiki_retry = Retry(
    total=1,
    connect=1,
    read=1,
    backoff_factor=0.1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=frozenset(['GET']),
)
_wiki_adapter = HTTPAdapter(pool_connections=24, pool_maxsize=24, max_retries=_wiki_retry)
WIKI_SESSION.mount('https://', _wiki_adapter)
WIKI_SESSION.mount('http://', _wiki_adapter)

# Initialize wikipedia-api
# The library requires a proper User-Agent
wiki_en = wikipediaapi.Wikipedia(
    user_agent='DjangoBlogApp/1.0 (https://example.com/blog; contact@example.com)',
    language='en',
    extract_format=wikipediaapi.ExtractFormat.WIKI
)

def fetch_single_wiki_detail(title):
    """Fetch details for a single wikipedia page."""
    try:
        # Check cache first for this specific title
        cache_key = f"wiki_detail_{re.sub(r'\W+', '_', title.lower())}"
        cached_detail = cache.get(cache_key)
        if cached_detail:
            return cached_detail

        page = wiki_en.page(title)
        if not page.exists():
            return None
        
        # Thumbnail still needs the REST API
        summary_url = f'https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}'
        thumbnail = ''
        try:
            summary_resp = WIKI_SESSION.get(summary_url, timeout=1.5, headers=WIKI_HEADERS)
            if summary_resp.status_code == 200:
                thumbnail = summary_resp.json().get('thumbnail', {}).get('source', '')
        except:
            pass

        result = {
            'title': page.title,
            'extract': page.summary[:500] if page.summary else '',
            'thumbnail': thumbnail,
            'page_url': page.fullurl,
        }
        
        # Cache for 1 hour
        cache.set(cache_key, result, 3600)
        return result
    except:
        return None


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

    # Check cache for this search query
    search_cache_key = f"wiki_search_{re.sub(r'\W+', '_', query.lower())}_{limit}"
    cached_results = cache.get(search_cache_key)
    if cached_results:
        return cached_results

    # wikipedia-api doesn't have search, so we still use requests for the search part
    search_url = 'https://en.wikipedia.org/w/api.php'
    search_params = {
        'action': 'query',
        'list': 'search',
        'srsearch': query,
        'srlimit': limit,
        'format': 'json',
        'utf8': 1,
    }

    try:
        search_resp = WIKI_SESSION.get(search_url, params=search_params, timeout=1.8, headers=WIKI_HEADERS)
        if search_resp.status_code != 200:
            return []

        search_data = search_resp.json()
        search_results = search_data.get('query', {}).get('search', [])
        if not search_results:
            return []

        # Use ThreadPoolExecutor for parallel detail fetching
        titles = [item['title'] for item in search_results]
        with ThreadPoolExecutor(max_workers=min(len(titles), 10)) as executor:
            results = list(filter(None, executor.map(fetch_single_wiki_detail, titles)))
        
        # Cache search results for 10 minutes
        cache.set(search_cache_key, results, 600)
        return results
    except Exception as e:
        print(f"Wiki search error: {e}")
        return []


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
    page = wiki_en.page(title)
    
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

    if not page.exists():
        return render(request, 'wiki_article.html', {'article': article_data})

    article_data['title'] = page.title
    article_data['extract'] = page.summary
    article_data['original_url'] = page.fullurl
    
    # Get related (links)
    article_data['related'] = list(page.links.keys())[:10]

    try:
        # wikipedia-api doesn't provide HTML content easily in the same way, 
        # but we can still use the MediaWiki API for the full HTML to preserve formatting
        # or use page.text but that loses HTML formatting.
        # User wants to "use wikipedia api for all this", but for rich HTML content 
        # wikipedia-api is mostly for plain text/sections.
        
        # To satisfy "use wikipedia api", I will use it for what it's good at.
        # However, to keep the UI working with HTML, I'll still fetch the HTML via requests if needed,
        # OR I'll use wikipedia-api's sections to build something.
        
        # Let's keep the HTML fetch for now because the frontend expects it.
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

        # Get summary for thumbnail/image
        summary_url = f'https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}'
        summary_resp = requests.get(summary_url, timeout=10, headers=WIKI_HEADERS)
        if summary_resp.status_code == 200:
            sd = summary_resp.json()
            article_data['thumbnail'] = sd.get('thumbnail', {}).get('source', '')
            article_data['original_image'] = sd.get('originalimage', {}).get('source', '')
            article_data['description'] = sd.get('description', '')

    except Exception as e:
        print(f"Error fetching wiki details: {e}")

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

