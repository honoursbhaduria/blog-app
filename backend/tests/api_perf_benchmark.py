import json
import random
import string
import time

import requests

BASE = 'http://127.0.0.1:8001/api/v1/'
BASELINE_OUT = '/home/honours/blogging-system-yt/API_PERF_BASELINE.json'
AFTER_OUT = '/home/honours/blogging-system-yt/API_PERF_AFTER.json'


def random_user():
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f'perf_{suffix}', 'Perf#123456'


def request_once(session, headers, method, path, auth=False, payload=None, params=None, timeout=5):
    start = time.perf_counter()
    try:
        response = session.request(
            method,
            BASE + path,
            headers=headers if auth else None,
            json=payload,
            params=params,
            timeout=timeout,
        )
        latency_ms = (time.perf_counter() - start) * 1000
        return {
            'transport_ok': True,
            'status': response.status_code,
            'latency_ms': round(latency_ms, 2),
        }
    except Exception as exc:
        latency_ms = (time.perf_counter() - start) * 1000
        return {
            'transport_ok': False,
            'status': None,
            'latency_ms': round(latency_ms, 2),
            'error': str(exc),
        }


def bench(session, headers, name, method, path, auth=False, payload=None, params=None, n=5):
    rows = []
    for _ in range(n):
        rows.append(request_once(session, headers, method, path, auth, payload, params, timeout=5))
    latencies = [row['latency_ms'] for row in rows]
    statuses = [row['status'] for row in rows if row['status'] is not None]
    success_2xx = sum(1 for status in statuses if 200 <= status < 300)
    client_4xx = sum(1 for status in statuses if 400 <= status < 500)
    server_5xx = sum(1 for status in statuses if 500 <= status < 600)
    transport_failures = sum(1 for row in rows if not row['transport_ok'])

    start = time.perf_counter()
    for _ in range(n):
        request_once(session, headers, method, path, auth, payload, params, timeout=5)
    duration = max(time.perf_counter() - start, 1e-9)

    sorted_lat = sorted(latencies)
    p95_index = max(0, int(0.95 * len(sorted_lat)) - 1)

    return {
        'name': name,
        'endpoint': path,
        'method': method,
        'samples': n,
        'avg_ms': round(sum(latencies) / len(latencies), 2),
        'p95_ms': sorted_lat[p95_index],
        'success_rate': round(success_2xx / n, 4),
        'error_rate': round((server_5xx + transport_failures) / n, 4),
        'client_error_rate': round(client_4xx / n, 4),
        'throughput_rps': round(n / duration, 2),
        'status_breakdown': {str(status): statuses.count(status) for status in sorted(set(statuses))},
    }


def run(output_path):
    session = requests.Session()
    username, password = random_user()

    register = session.post(
        BASE + 'auth/register/',
        json={
            'username': username,
            'password': password,
            'confirm_password': password,
            'email': f'{username}@example.com',
        },
        timeout=8,
    )

    login = session.post(
        BASE + 'auth/login/',
        json={'username': username, 'password': password},
        timeout=8,
    )

    access = login.json().get('access') if login.ok else None
    refresh = login.json().get('refresh') if login.ok else None
    headers = {'Authorization': f'Bearer {access}'} if access else {}

    benchmarks = [
        bench(session, headers, 'auth_login', 'POST', 'auth/login/', payload={'username': username, 'password': password}),
        bench(session, headers, 'auth_refresh', 'POST', 'auth/refresh/', payload={'refresh': refresh or ''}),
        bench(session, headers, 'blogs_posts_list', 'GET', 'blogs/posts/', auth=True),
        bench(session, headers, 'blogs_trending', 'GET', 'blogs/trending/', auth=True),
        bench(session, headers, 'blogs_stats', 'GET', 'blogs/stats/', auth=True),
        bench(session, headers, 'blogs_categories', 'GET', 'blogs/categories/', auth=True),
        bench(session, headers, 'blogs_tags', 'GET', 'blogs/tags/', auth=True),
        bench(session, headers, 'profiles_edit', 'GET', 'profiles/edit/', auth=True),
        bench(session, headers, 'profiles_friends', 'GET', 'profiles/friends/', auth=True),
    ]

    reachability_targets = [
        ('GET', 'blogs/random-wiki/', True, None, {'limit': 3}, 10),
        ('GET', 'blogs/search-wiki/', True, None, {'keyword': 'python'}, 10),
        ('GET', 'blogs/users/', True, None, None, 8),
        ('POST', 'blogs/users/', True, {'username': 'u'}, None, 8),
        ('GET', 'blogs/clusters/', True, None, None, 8),
        ('POST', 'blogs/clusters/', True, {'name': 'x'}, None, 8),
        ('GET', 'blogs/saved-wiki/', True, None, None, 8),
        ('POST', 'blogs/saved-wiki/', True, {'title': 'x'}, None, 8),
        ('GET', f'profiles/{username}/', True, None, None, 8),
        ('GET', f'profiles/{username}/blogs/', True, None, None, 8),
        ('GET', f'profiles/{username}/favorites/', True, None, None, 8),
        ('GET', 'profiles/users/search/', True, None, {'q': 'perf'}, 8),
        ('GET', 'profiles/friends/requests/', True, None, None, 8),
        ('POST', f'profiles/friends/{username}/invite/', True, None, None, 8),
    ]

    reachability = []
    for method, path, auth, payload, params, timeout in reachability_targets:
        result = request_once(session, headers, method, path, auth, payload, params, timeout)
        reachability.append({
            'method': method,
            'endpoint': path,
            'status': result['status'],
            'latency_ms': result['latency_ms'],
            'transport_ok': result['transport_ok'],
            'error': result.get('error'),
        })

    report = {
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'base': BASE,
        'register_status': register.status_code,
        'login_status': login.status_code,
        'created_user': username,
        'benchmarks': benchmarks,
        'reachability': reachability,
    }

    with open(output_path, 'w', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2)

    print(f'Wrote {output_path}')


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['baseline', 'after'], default='baseline')
    args = parser.parse_args()

    output = BASELINE_OUT if args.mode == 'baseline' else AFTER_OUT
    run(output)
