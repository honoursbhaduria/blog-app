from django.http import JsonResponse
from django.shortcuts import redirect
from django.utils import timezone
from django.conf import settings


def root_landing(request):
    frontend_url = getattr(settings, 'FRONTEND_URL', '').strip()
    if frontend_url:
        return redirect(frontend_url)
    return JsonResponse(
        {
            'status': 'ok',
            'service': 'blogging-system-api',
            'message': 'Set FRONTEND_URL env var to redirect / to your frontend app.',
            'timestamp': timezone.now().isoformat(),
        }
    )


def health_check(request):
    return JsonResponse(
        {
            'status': 'ok',
            'service': 'blogging-system-api',
            'timestamp': timezone.now().isoformat(),
        }
    )
