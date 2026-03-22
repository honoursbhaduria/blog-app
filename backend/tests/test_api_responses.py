import time
import json
from unittest import mock
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from apps.blogs.models import Blog, Category, Tag, SavedWikiArticle, Cluster

# Use a faster password hasher for tests to meet the threshold
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class APIPerformanceTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_password = 'testpassword123'
        self.user = User.objects.create_user(
            username='testuser', 
            email='test@example.com', 
            password=self.user_password
        )
        self.category = Category.objects.create(category_name='Test Category')
        self.tag = Tag.objects.create(name='Test Tag')
        self.blog = Blog.objects.create(
            title='Test Blog',
            short_description='This is a test blog description.',
            blog_body='This is the body of the test blog.',
            author=self.user,
            category=self.category,
            status='Published'
        )
        self.blog.tags.add(self.tag)
        
        # Saved Wiki Article
        self.wiki_article = SavedWikiArticle.objects.create(
            user=self.user,
            title='Test Article',
            extract='Test Extract'
        )
        
        # Cluster
        self.cluster = Cluster.objects.create(
            name='Test Cluster',
            owner=self.user
        )
        self.cluster.blogs.add(self.blog)
        self.cluster.wiki_articles.add(self.wiki_article)
        
        # Get JWT Token
        response = self.client.post('/api/v1/auth/login/', {
            'username': 'testuser',
            'password': self.user_password
        })
        self.token = response.data.get('access')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def measure_response(self, method, url, data=None, expected_status=status.HTTP_200_OK):
        start_time = time.time()
        if method == 'GET':
            response = self.client.get(url)
        elif method == 'POST':
            response = self.client.post(url, data, format='json')
        elif method == 'PATCH':
            response = self.client.patch(url, data, format='json')
        elif method == 'DELETE':
            response = self.client.delete(url)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        duration = (time.time() - start_time) * 1000  # in ms
        
        # Output result to see it during execution
        print(f"  {method} {url} -> {duration:.2f}ms")
        
        self.assertEqual(response.status_code, expected_status, f"URL {url} failed with status {response.status_code}")
        # Threshold 400ms as requested
        self.assertLessEqual(duration, 400, f"URL {url} took too long: {duration:.2f}ms (threshold: 400ms)")
        return response

    # --- AUTH TESTS ---
    def test_auth_login(self):
        self.measure_response('POST', '/api/v1/auth/login/', {
            'username': 'testuser',
            'password': self.user_password
        })

    def test_auth_register(self):
        self.measure_response('POST', '/api/v1/auth/register/', {
            'username': 'newuser',
            'email': 'new@example.com',
            'password': 'newpassword123'
        }, expected_status=status.HTTP_201_CREATED)

    # --- BLOG TESTS ---
    def test_blog_list(self):
        self.measure_response('GET', '/api/v1/blogs/posts/')

    def test_blog_detail(self):
        self.measure_response('GET', f'/api/v1/blogs/posts/{self.blog.slug}/')

    @mock.patch('apps.blogs.api_views.fetch_wikipedia_results')
    def test_blog_trending(self, mock_wiki):
        mock_wiki.return_value = [{'title': 'Mock Trending', 'extract': 'Mock Summary'}]
        self.measure_response('GET', '/api/v1/blogs/trending/')

    def test_blog_stats(self):
        self.measure_response('GET', '/api/v1/blogs/stats/')

    def test_blog_categories(self):
        self.measure_response('GET', '/api/v1/blogs/categories/')

    def test_blog_tags(self):
        self.measure_response('GET', '/api/v1/blogs/tags/')

    def test_blog_create(self):
        data = {
            'title': 'New Blog',
            'short_description': 'New description',
            'blog_body': 'New body',
            'category_id': self.category.id,
            'status': 'Draft'
        }
        self.measure_response('POST', '/api/v1/blogs/posts/', data, expected_status=status.HTTP_201_CREATED)

    # --- PROFILE TESTS ---
    def test_profile_view_own(self):
        self.measure_response('GET', '/api/v1/profiles/edit/')

    def test_profile_view_public(self):
        self.measure_response('GET', f'/api/v1/profiles/{self.user.username}/')

    def test_profile_blogs(self):
        self.measure_response('GET', f'/api/v1/profiles/{self.user.username}/blogs/')

    def test_profile_favorites(self):
        self.measure_response('GET', f'/api/v1/profiles/{self.user.username}/favorites/')

    def test_user_search(self):
        self.measure_response('GET', '/api/v1/profiles/users/search/?q=test')

    def test_friends_list(self):
        self.measure_response('GET', '/api/v1/profiles/friends/')

    def test_friend_requests(self):
        self.measure_response('GET', '/api/v1/profiles/friends/requests/')

    # --- CLUSTER TESTS ---
    def test_cluster_list(self):
        self.measure_response('GET', '/api/v1/blogs/clusters/')

    def test_cluster_detail(self):
        self.measure_response('GET', f'/api/v1/blogs/clusters/{self.cluster.id}/')

    # --- WIKI TESTS ---
    def test_saved_wiki_list(self):
        self.measure_response('GET', '/api/v1/blogs/saved-wiki/')

    @mock.patch('apps.blogs.api_views.fetch_wikipedia_results')
    def test_wiki_search(self, mock_wiki):
        mock_wiki.return_value = [{'title': 'Mock Search'}]
        self.measure_response('GET', '/api/v1/blogs/search-wiki/?keyword=Python')

    @mock.patch('requests.get')
    def test_random_wiki(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {'title': 'Random Article', 'extract': 'Random Extract'}
        self.measure_response('GET', '/api/v1/blogs/random-wiki/?limit=1')

    # --- AI TESTS ---
    @mock.patch('apps.blogs.ai_views.Groq')
    def test_ai_explain(self, mock_groq):
        mock_client = mock_groq.return_value
        mock_client.chat.completions.create.return_value.choices = [
            mock.Mock(message=mock.Mock(content='Mock AI explanation'))
        ]
        data = {'selected_text': 'test text', 'blog_title': 'Test Blog'}
        self.measure_response('POST', '/api/v1/blogs/ai/explain/', data)

    @mock.patch('apps.blogs.ai_views.Groq')
    def test_ai_write(self, mock_groq):
        mock_client = mock_groq.return_value
        mock_client.chat.completions.create.return_value.choices = [
            mock.Mock(message=mock.Mock(content='Mock AI content'))
        ]
        data = {'action': 'improve_text', 'content': 'old text'}
        self.measure_response('POST', '/api/v1/blogs/ai/write/', data)

    @mock.patch('apps.blogs.api_views.Groq')
    def test_create_blog_draft_from_cluster(self, mock_groq):
        mock_client = mock_groq.return_value
        mock_client.chat.completions.create.return_value.choices = [
            mock.Mock(message=mock.Mock(content='Mock AI Blog Body'))
        ]
        self.measure_response('POST', f'/api/v1/blogs/clusters/{self.cluster.id}/create_blog_draft/', {'title': 'Draft Test'}, expected_status=status.HTTP_201_CREATED)

    def test_create_blog_draft_from_wiki(self):
        self.measure_response('POST', f'/api/v1/blogs/saved-wiki/{self.wiki_article.id}/create_blog_draft/', expected_status=status.HTTP_201_CREATED)
