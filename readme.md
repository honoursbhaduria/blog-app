# Blogging System with AI & Wikipedia Integration

A high-performance, minimalist, and brutalist-styled blogging platform with deep Wikipedia integration and AI-powered research/writing tools.

## 🚀 Features

### Core Platform
- **Authentication:** Secure registration, login, JWT auth with token refresh.
- **Home Feed:** Brutalist UI featuring latest posts, featured content, and live Wikipedia feeds.
- **Trending:** Data-driven trending page for both user content and technical Wikipedia topics.
- **Global Search:** Unified search across internal blogs and Wikipedia articles.
- **Archive System:** Category-based archive pages and full single-post readers.

### Blogging Engine
- **Full CRUD:** Create, edit, publish, draft, and delete functionality.
- **Rich Metadata:** support for categories, tags, difficulty levels, and source attribution.
- **Interactions:** Integrated like system, favorites/bookmarks, and threaded comments.
- **Performance:** Optimized per-post counters for views, likes, and engagement.

### Wikipedia Integration
> **Note:** Initial loads for Wikipedia search and trending topics may experience slight delays due to external API processing and network latency from Wikipedia servers.
- **Explorer:** Keyword search and "Doom Scroll" random article discovery.
- **Reader:** In-app Wikipedia article reader with internal navigation.
- **Research Board:** Save and organize Wikipedia entries on a dedicated board.
- **Workflow:** One-click conversion from Wikipedia articles to local blog drafts.

### AI Research Tools
- **Writing Assistant:** AI-powered title generation, outlining, text improvement, and SEO meta descriptions.
- **Selection Explain:** Highlight any text in a blog or wiki article to get an instant AI-powered explanation.
- **Knowledge Clusters:** Group blogs and wiki articles into research clusters.
- **Cluster Chat:** Chat with an AI assistant that has the full context of your selected research cluster.

### Social & Profile
- **Identity:** Comprehensive public profiles with social links, professional roles, and education.
- **Friend System:** Full social graph support: search users, invite friends, accept/reject requests.
- **Dashboard Integration:** Live friend counts and social management directly in the workspace.

### Workspace Dashboard
- **Analytics:** Real-time stats for posts, categories, comments, and engagement.
- **Management:** Full control over categories, users, and blog entries via a modal-driven workspace.
- **Research Hub:** Drag-and-drop cluster management and kanban-style Wiki board.

## 🛠️ Tech Stack
- **Backend:** Django, Django REST Framework, PostgreSQL (Neon).
- **Frontend:** React, Tailwind CSS (Brutalist Design), Lucide Icons.
- **AI:** Groq Llama 3.1 Integration.
- **Data:** Wikipedia REST API.

---

*This project is optimized for high-performance and low-latency database operations on Neon PostgreSQL.*
