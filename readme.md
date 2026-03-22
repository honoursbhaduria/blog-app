# Blogging System (AI + Wikipedia)

A full-stack blogging platform with JWT auth, social profile features, AI writing/explain tools, and Wikipedia-powered research workflows.

## What this project includes

- Django REST API for auth, blogs, profiles, comments, likes, favorites, wiki board, and cluster workflows.
- React frontend (Vite) with dashboard pages, feed pages, profile pages, and wiki reader pages.
- AI endpoints for writing assistance and highlighted-text explanation.
- Performance-minded API patterns (query optimizations, short-lived response cache).

## Tech stack

- Backend: Django, Django REST Framework, SimpleJWT
- Frontend: React, Vite, Tailwind CSS, Axios
- Data: SQLite (default local) or PostgreSQL via env vars
- Integrations: Groq API, Wikipedia API

## Project structure

- `backend/` Django project and apps
- `frontend/` React application
- `templates/` server-rendered templates used by legacy pages
- `media/` uploaded files
- `requirements.txt` backend dependencies

## Environment variables

Copy `.env.example` to `.env` and fill values for your environment.

Key variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `USE_SQLITE`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
- `GROQ_API_KEY`
- `VITE_API_URL`

## Local setup

### 1) Backend

1. Create and activate a virtual environment.
2. Install dependencies:
	- `pip install -r requirements.txt`
3. From `backend/`, run migrations:
	- `python manage.py migrate`
4. Start API server:
	- `python manage.py runserver 8001`

### 2) Frontend

1. From `frontend/`, install dependencies:
	- `npm install --legacy-peer-deps`
2. Start dev server:
	- `npm run dev`
3. Open the local Vite URL and ensure frontend points to `VITE_API_URL`.

## API overview

Base path: `/api/v1/`

- Auth: `/auth/login/`, `/auth/refresh/`, `/auth/register/`
- Blogs: `/blogs/posts/`, `/blogs/tags/`, `/blogs/categories/`, `/blogs/trending/`, `/blogs/stats/`
- Profiles: `/profiles/edit/`, `/profiles/{username}/`, `/profiles/users/search/`, `/profiles/friends/`
- Wiki: `/blogs/search-wiki/`, `/blogs/random-wiki/`, `/blogs/wiki/{title}/`, `/blogs/saved-wiki/`

## Testing and checks

- Django checks:
  - `python backend/manage.py check`
- API benchmark script:
  - `python backend/tests/api_perf_benchmark.py --mode baseline`
  - `python backend/tests/api_perf_benchmark.py --mode after`
- Frontend build:
  - `cd frontend && npm run build`

## Contribution rules

To keep the repo stable, follow these rules when contributing:

1. Keep PRs small and focused (one feature/fix per PR).
2. Do not commit secrets, tokens, `.env`, or generated local DB/media artifacts.
3. Add/adjust tests when changing API behavior.
4. Preserve API compatibility unless a breaking change is explicitly approved.
5. Match existing naming, formatting, and folder conventions.
6. Update docs (`readme.md`) whenever setup, env vars, or workflow changes.
7. Ensure backend `manage.py check` and frontend `npm run build` pass before opening PR.

## Security notes

- Never hardcode credentials in source files.
- Keep `DJANGO_DEBUG=False` outside local development.
- Use strong `DJANGO_SECRET_KEY` and restricted `DJANGO_ALLOWED_HOSTS`.
