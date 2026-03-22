web: gunicorn core.wsgi:application --chdir backend --bind 0.0.0.0:${PORT:-8001} --workers 3 --timeout 120
