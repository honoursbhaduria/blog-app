import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { blogService, dashboardService, wikiLibraryService } from '../services/api';
import { BookMarked, BrainCircuit, CheckCircle2, ExternalLink, FilePlus2, GripVertical, Heart, Search, Trash2 } from 'lucide-react';

const COLUMN_CONFIG = {
    Inbox: {
        title: 'Drafts',
        icon: BookMarked,
        empty: 'No saved Wikipedia drafts yet.'
    },
    Reading: {
        title: 'AI Reference',
        icon: BrainCircuit,
        empty: 'Drop drafts here to mark for AI context.'
    },
    Completed: {
        title: 'Used',
        icon: CheckCircle2,
        empty: 'Completed wiki references appear here.'
    }
};

const COLUMNS = ['Inbox', 'Reading', 'Completed'];

export default function DashboardWikiBoard() {
    const [articles, setArticles] = useState([]);
    const [blogDrafts, setBlogDrafts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [draggedId, setDraggedId] = useState(null);
    const [savedSearch, setSavedSearch] = useState('');
    const [draftSearch, setDraftSearch] = useState('');

    const [wikiQuery, setWikiQuery] = useState('technology');
    const [wikiResults, setWikiResults] = useState([]);
    const [wikiLoading, setWikiLoading] = useState(false);
    const [busySavedId, setBusySavedId] = useState(null);
    const [busyResultTitle, setBusyResultTitle] = useState('');

    const fetchBoard = async () => {
        try {
            const [savedRes, postsRes] = await Promise.all([
                wikiLibraryService.getAll(),
                dashboardService.getPosts()
            ]);

            setArticles(Array.isArray(savedRes.data) ? savedRes.data : []);
            const posts = Array.isArray(postsRes.data) ? postsRes.data : [];
            setBlogDrafts(posts.filter((post) => post.status === 'Draft'));
        } catch (error) {
            console.error('Failed to fetch wiki board', error);
        } finally {
            setLoading(false);
        }
    };

    const searchWikipedia = useCallback(async (keyword = wikiQuery) => {
        const query = keyword.trim() || 'technology';
        setWikiLoading(true);
        try {
            const res = await blogService.searchWiki(query);
            setWikiResults(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to search Wikipedia', error);
            setWikiResults([]);
        } finally {
            setWikiLoading(false);
        }
    }, [wikiQuery]);

    useEffect(() => {
        fetchBoard();
        searchWikipedia('technology');
    }, [searchWikipedia]);

    const saveFromSearch = async (item, setLiked = false) => {
        const title = item?.title || '';
        if (!title) return;

        setBusyResultTitle(title);
        try {
            await wikiLibraryService.save({
                title,
                extract: item.extract || '',
                thumbnail: item.thumbnail || '',
                original_url: item.page_url || '',
                liked: setLiked,
                board_column: 'Inbox'
            });
            await fetchBoard();
        } catch (error) {
            if (error.response?.data?.title) {
                const existing = articles.find((article) => article.title.toLowerCase() === title.toLowerCase());
                if (setLiked && existing && !existing.liked) {
                    await toggleSavedLike(existing.id);
                } else {
                    alert('Already saved in your Wiki Drafts.');
                }
            } else if (error.response?.status === 401) {
                alert('Please login to save this article.');
            } else {
                alert('Failed to save this article.');
            }
        } finally {
            setBusyResultTitle('');
        }
    };

    const toggleSavedLike = async (id) => {
        setBusySavedId(id);
        try {
            await wikiLibraryService.toggleLike(id);
            setArticles((prev) => prev.map((item) => (item.id === id ? { ...item, liked: !item.liked } : item)));
        } catch (error) {
            console.error('Failed to toggle liked state', error);
            alert('Failed to update like state.');
        } finally {
            setBusySavedId(null);
        }
    };

    const createDraftFromSaved = async (id) => {
        setBusySavedId(id);
        try {
            const res = await wikiLibraryService.createBlogDraft(id);
            if (res.data?.status === 'Draft') {
                setBlogDrafts((prev) => [res.data, ...prev]);
            }
            alert('Blog draft created from saved Wikipedia article.');
        } catch (error) {
            console.error('Failed to create draft from saved article', error);
            alert('Failed to create blog draft from this saved article.');
        } finally {
            setBusySavedId(null);
        }
    };

    const filteredBlogDrafts = useMemo(() => {
        const query = draftSearch.trim().toLowerCase();
        if (!query) return blogDrafts;
        return blogDrafts.filter((draft) => `${draft.title} ${draft.short_description || ''}`.toLowerCase().includes(query));
    }, [blogDrafts, draftSearch]);

    const filteredSavedArticles = useMemo(() => {
        const query = savedSearch.trim().toLowerCase();
        if (!query) return articles;
        return articles.filter((article) => `${article.title} ${article.extract || ''}`.toLowerCase().includes(query));
    }, [articles, savedSearch]);

    const grouped = useMemo(() => {
        const initial = {
            Inbox: [],
            Reading: [],
            Completed: []
        };

        for (const article of filteredSavedArticles) {
            const column = COLUMNS.includes(article.board_column) ? article.board_column : 'Inbox';
            initial[column].push(article);
        }

        for (const column of COLUMNS) {
            initial[column].sort((a, b) => (a.board_order ?? 0) - (b.board_order ?? 0));
        }

        return initial;
    }, [filteredSavedArticles]);

    const persistBoardState = async (nextArticles) => {
        const entries = [];
        for (const column of COLUMNS) {
            const items = nextArticles
                .filter((item) => (item.board_column || 'Inbox') === column)
                .sort((a, b) => (a.board_order ?? 0) - (b.board_order ?? 0));

            items.forEach((item, index) => {
                entries.push({
                    id: item.id,
                    board_column: column,
                    board_order: index
                });
            });
        }

        try {
            await wikiLibraryService.reorder({ entries });
        } catch (error) {
            console.error('Failed to persist board order', error);
            await fetchBoard();
        }
    };

    const moveToColumn = async (articleId, destinationColumn) => {
        const sourceArticle = articles.find((item) => item.id === articleId);
        if (!sourceArticle) return;

        const updated = articles.map((item) => {
            if (item.id === articleId) {
                return { ...item, board_column: destinationColumn };
            }
            return item;
        });

        const normalized = [];
        for (const column of COLUMNS) {
            const items = updated.filter((item) => (item.board_column || 'Inbox') === column);
            items.forEach((item, index) => {
                normalized.push({ ...item, board_order: index });
            });
        }

        setArticles(normalized);
        await persistBoardState(normalized);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this saved wiki draft?')) return;
        try {
            await wikiLibraryService.delete(id);
            setArticles((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            console.error('Failed to delete wiki draft', error);
        }
    };

    if (loading) {
        return <div className="p-8 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Loading Wiki Draft Board...</div>;
    }

    return (
        <div>
            <div className="mb-8 border-b-4 border-canvas-dark pb-4">
                <h2 className="text-4xl font-display font-black text-canvas-dark uppercase tracking-tighter">Drafts & Wikipedia Workspace</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mt-2">Your blog drafts, saved wiki drafts, likes, and search in one place.</p>
            </div>

            <section className="mb-8 p-6 bg-white brutal-border border-4 border-canvas-dark">
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                    <h3 className="text-sm font-display font-black uppercase tracking-widest text-canvas-dark">Your Blog Drafts</h3>
                    <div className="flex items-center gap-2">
                        <Search size={14} className="text-canvas-coral" />
                        <input
                            type="text"
                            value={draftSearch}
                            onChange={(event) => setDraftSearch(event.target.value)}
                            placeholder="Search your drafts"
                            className="px-3 py-2 bg-canvas-light brutal-border border-2 border-canvas-dark text-xs font-bold uppercase tracking-widest focus:outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredBlogDrafts.map((draft) => (
                        <article key={draft.id} className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark">
                            <h4 className="font-display font-black uppercase text-sm text-canvas-dark mb-2 line-clamp-2">{draft.title}</h4>
                            <p className="text-xs font-medium text-gray-600 line-clamp-2 mb-4">{draft.short_description || 'No description yet.'}</p>
                            <div className="flex items-center gap-2">
                                <Link
                                    to={`/post/${draft.slug}`}
                                    className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors"
                                >
                                    Open Draft
                                </Link>
                                <Link
                                    to="/dashboard/posts"
                                    className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors"
                                >
                                    Edit in Posts
                                </Link>
                            </div>
                        </article>
                    ))}
                    {filteredBlogDrafts.length === 0 && (
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 border-2 border-dashed border-gray-300 p-6 text-center md:col-span-2">
                            No blog drafts found.
                        </p>
                    )}
                </div>
            </section>

            <section className="mb-8 p-6 bg-white brutal-border border-4 border-canvas-dark">
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                    <h3 className="text-sm font-display font-black uppercase tracking-widest text-canvas-dark">Wikipedia Explorer</h3>
                    <form
                        className="flex items-center gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            searchWikipedia();
                        }}
                    >
                        <input
                            type="text"
                            value={wikiQuery}
                            onChange={(event) => setWikiQuery(event.target.value)}
                            placeholder="Search Wikipedia topics"
                            className="px-3 py-2 bg-canvas-light brutal-border border-2 border-canvas-dark text-xs font-bold uppercase tracking-widest focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors"
                        >
                            Search
                        </button>
                    </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wikiResults.map((item) => (
                        <article key={item.title} className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark">
                            <h4 className="font-display font-black uppercase text-sm text-canvas-dark mb-2 line-clamp-2">{item.title}</h4>
                            <p className="text-xs font-medium text-gray-600 line-clamp-3 mb-4">{item.extract || 'No summary available.'}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                    to={`/wiki/${encodeURIComponent(item.title)}`}
                                    className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors"
                                >
                                    Open
                                </Link>
                                <button
                                    onClick={() => saveFromSearch(item, false)}
                                    className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors"
                                    disabled={busyResultTitle === item.title}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => saveFromSearch(item, true)}
                                    className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors"
                                    disabled={busyResultTitle === item.title}
                                >
                                    Save + Like
                                </button>
                            </div>
                        </article>
                    ))}
                    {!wikiLoading && wikiResults.length === 0 && (
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 border-2 border-dashed border-gray-300 p-6 text-center md:col-span-2 lg:col-span-3">
                            No Wikipedia results found.
                        </p>
                    )}
                </div>
                {wikiLoading && <p className="text-xs font-bold uppercase tracking-widest text-canvas-coral mt-4">Searching Wikipedia...</p>}
            </section>

            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <h3 className="text-sm font-display font-black uppercase tracking-widest text-canvas-dark">Saved Wiki Drafts Board</h3>
                <div className="flex items-center gap-2">
                    <Search size={14} className="text-canvas-coral" />
                    <input
                        type="text"
                        value={savedSearch}
                        onChange={(event) => setSavedSearch(event.target.value)}
                        placeholder="Search saved wiki drafts"
                        className="px-3 py-2 bg-white brutal-border border-2 border-canvas-dark text-xs font-bold uppercase tracking-widest focus:outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {COLUMNS.map((columnKey) => {
                    const config = COLUMN_CONFIG[columnKey];
                    const Icon = config.icon;
                    const columnItems = grouped[columnKey];

                    return (
                        <section
                            key={columnKey}
                            className="bg-white brutal-border border-4 border-canvas-dark p-5 min-h-[540px]"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={async (event) => {
                                event.preventDefault();
                                if (!draggedId) return;
                                await moveToColumn(draggedId, columnKey);
                                setDraggedId(null);
                            }}
                        >
                            <header className="flex items-center justify-between border-b-2 border-canvas-dark pb-3 mb-4">
                                <h3 className="flex items-center gap-2 text-sm font-display font-black uppercase tracking-widest text-canvas-dark">
                                    <Icon size={16} className="text-canvas-coral" />
                                    {config.title}
                                </h3>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{columnItems.length}</span>
                            </header>

                            <div className="space-y-4">
                                {columnItems.map((item) => (
                                    <article
                                        key={item.id}
                                        draggable
                                        onDragStart={() => setDraggedId(item.id)}
                                        className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark shadow-[3px_3px_0px_0px_rgba(28,28,28,1)]"
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <h4 className="font-display font-black uppercase text-sm text-canvas-dark leading-tight">{item.title}</h4>
                                            <GripVertical size={16} className="text-gray-500 mt-0.5" />
                                        </div>

                                        <p className="text-xs font-medium text-gray-600 line-clamp-3 mb-4">{item.extract || 'No summary available.'}</p>

                                        <div className="flex items-center justify-between gap-2">
                                            <Link
                                                to={`/wiki/${encodeURIComponent(item.title)}`}
                                                className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors"
                                            >
                                                Open
                                            </Link>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleSavedLike(item.id)}
                                                    className={`p-2 brutal-border border border-canvas-dark transition-colors ${item.liked ? 'bg-canvas-coral text-white' : 'bg-white text-canvas-dark hover:bg-canvas-light'}`}
                                                    title={item.liked ? 'Unlike saved wiki draft' : 'Like saved wiki draft'}
                                                    disabled={busySavedId === item.id}
                                                >
                                                    <Heart size={14} />
                                                </button>
                                                <button
                                                    onClick={() => createDraftFromSaved(item.id)}
                                                    className="p-2 bg-white text-canvas-dark brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors"
                                                    title="Create blog draft from this saved article"
                                                    disabled={busySavedId === item.id}
                                                >
                                                    <FilePlus2 size={14} />
                                                </button>
                                                {item.original_url && (
                                                    <a
                                                        href={item.original_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-2 bg-white text-canvas-dark brutal-border border border-canvas-dark hover:bg-canvas-coral hover:text-white transition-colors"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 bg-white text-canvas-dark brutal-border border border-canvas-dark hover:bg-red-600 hover:text-white transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                ))}

                                {columnItems.length === 0 && (
                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 border-2 border-dashed border-gray-300 p-6 text-center">
                                        {config.empty}
                                    </p>
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
