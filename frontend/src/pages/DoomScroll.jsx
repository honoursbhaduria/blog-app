import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dice5, ExternalLink, Heart, Search } from 'lucide-react';
import { blogService, wikiLibraryService } from '../services/api';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80';

export default function DoomScroll() {
    const [query, setQuery] = useState('technology');
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingTitle, setSavingTitle] = useState('');
    const [message, setMessage] = useState({ text: '', type: 'success' });
    const messageTimerRef = useRef(null);

    const isAuthenticated = !!localStorage.getItem('access_token');

    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        if (messageTimerRef.current) {
            clearTimeout(messageTimerRef.current);
        }
        messageTimerRef.current = setTimeout(() => {
            setMessage({ text: '', type: 'success' });
        }, 1500);
    };

    const loadRandom = async () => {
        setLoading(true);
        try {
            const res = await blogService.getRandomWiki(20);
            setArticles(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to load random Wikipedia feed', error);
            setArticles([]);
        } finally {
            setLoading(false);
        }
    };

    const searchWiki = async () => {
        const keyword = query.trim() || 'technology';
        setLoading(true);
        try {
            const res = await blogService.searchWiki(keyword);
            setArticles(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to search Wikipedia', error);
            setArticles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRandom();
        return () => {
            if (messageTimerRef.current) {
                clearTimeout(messageTimerRef.current);
            }
        };
    }, []);

    const saveArticle = async (article, likeOnSave = false) => {
        const title = article?.title || '';
        if (!title) return;

        setSavingTitle(title);
        try {
            await wikiLibraryService.save({
                title,
                extract: article.extract || '',
                thumbnail: article.thumbnail || '',
                original_url: article.page_url || '',
                liked: likeOnSave,
                board_column: 'Inbox',
            });
            showMessage(likeOnSave ? 'Saved and liked.' : 'Saved to your Wiki section.');
        } catch (error) {
            if (error.response?.status === 401) {
                showMessage('Please login to save and like articles.', 'error');
            } else if (error.response?.data?.title) {
                showMessage('This article is already in your saved section.', 'error');
            } else {
                showMessage('Failed to save this article.', 'error');
            }
        } finally {
            setSavingTitle('');
        }
    };

    const title = useMemo(() => {
        if (loading) return 'Loading Wikipedia feed...';
        return `Wikipedia Doom Scroll (${articles.length})`;
    }, [articles.length, loading]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="mb-6 border-b-4 border-canvas-dark pb-4">
                <h1 className="text-4xl font-display font-black uppercase tracking-tighter text-canvas-dark">{title}</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mt-2">Search Wikipedia or hit random to fetch 20 articles.</p>
            </div>

            <section className="p-5 md:p-6 bg-white brutal-border border-4 border-canvas-dark mb-8">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        searchWiki();
                    }}
                    className="flex flex-col md:flex-row md:items-center gap-3"
                >
                    <div className="flex-1 flex items-center gap-2">
                        <Search size={16} className="text-canvas-coral" />
                        <input
                            type="text"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search Wikipedia topics"
                            className="w-full px-3 py-2 bg-canvas-light brutal-border border-2 border-canvas-dark text-xs font-bold uppercase tracking-widest focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors"
                        >
                            Search
                        </button>
                        <button
                            type="button"
                            onClick={loadRandom}
                            className="px-4 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors inline-flex items-center gap-1"
                        >
                            <Dice5 size={12} /> Random 20
                        </button>
                    </div>
                </form>
                {!isAuthenticated && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-3">
                        Login is required for Save / Like. You can still browse and open Wikipedia pages.
                    </p>
                )}
                {message.text && (
                    <div className={`mt-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark ${message.type === 'error' ? 'bg-canvas-coral text-white' : 'bg-canvas-dark text-white'}`}>
                        {message.text}
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((item) => (
                    <article key={item.title} className="bg-white brutal-border border-4 border-canvas-dark overflow-hidden">
                        <img
                            src={item.thumbnail || FALLBACK_IMAGE}
                            alt={item.title}
                            className="w-full h-44 object-cover border-b-2 border-canvas-dark"
                            onError={(event) => {
                                event.currentTarget.src = FALLBACK_IMAGE;
                            }}
                        />
                        <div className="p-4">
                            <h2 className="font-display font-black uppercase text-sm text-canvas-dark leading-tight line-clamp-2 mb-2">{item.title}</h2>
                            <p className="text-xs text-gray-600 line-clamp-4 mb-4">{item.extract || 'No summary available.'}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                    to={`/wiki/${encodeURIComponent(item.title)}`}
                                    className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors"
                                >
                                    Open
                                </Link>
                                {item.page_url && (
                                    <a
                                        href={item.page_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors inline-flex items-center gap-1"
                                    >
                                        Source <ExternalLink size={12} />
                                    </a>
                                )}
                                <button
                                    onClick={() => saveArticle(item, false)}
                                    disabled={savingTitle === item.title}
                                    className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => saveArticle(item, true)}
                                    disabled={savingTitle === item.title}
                                    className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors inline-flex items-center gap-1"
                                >
                                    <Heart size={12} /> Save + Like
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            {!loading && articles.length === 0 && (
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 border-2 border-dashed border-gray-300 p-8 text-center">
                    No Wikipedia articles found.
                </p>
            )}
        </div>
    );
}
