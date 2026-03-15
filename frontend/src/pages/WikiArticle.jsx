import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { blogService, wikiLibraryService } from '../services/api';
import { ArrowLeft, BookOpen, BookmarkPlus, Sparkles, X } from 'lucide-react';

export default function WikiArticle() {
    const { title } = useParams();
    const navigate = useNavigate();

    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const [selectedText, setSelectedText] = useState('');
    const [showAiModal, setShowAiModal] = useState(false);
    const [isExplaining, setIsExplaining] = useState(false);
    const [aiExplanation, setAiExplanation] = useState('');

    const contentRef = useRef(null);

    useEffect(() => {
        const fetchArticle = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await blogService.getWikiArticle(encodeURIComponent(title));
                setArticle(response.data);
                window.scrollTo(0, 0);
            } catch (err) {
                console.error('Wiki fetch error:', err);
                setError('Failed to load Wikipedia article.');
            } finally {
                setLoading(false);
            }
        };

        fetchArticle();
    }, [title]);

    useEffect(() => {
        const container = contentRef.current;
        if (!container) return;

        const handleInternalWikiNavigation = (event) => {
            const anchor = event.target.closest('a');
            if (!anchor) return;

            const rawHref = anchor.getAttribute('href') || '';
            const absoluteHref = anchor.href || '';
            const href = rawHref || absoluteHref;

            if (!href) return;

            const isWikipediaLink =
                href.includes('wikipedia.org/wiki/') ||
                href.startsWith('/wiki/');

            if (!isWikipediaLink) return;

            event.preventDefault();

            const path = href.includes('wikipedia.org')
                ? new URL(href).pathname
                : href;

            const wikiSlug = path.replace('/wiki/', '').split('#')[0].trim();
            if (!wikiSlug) return;

            navigate(`/wiki/${encodeURIComponent(decodeURIComponent(wikiSlug))}`);
        };

        container.addEventListener('click', handleInternalWikiNavigation);
        return () => {
            container.removeEventListener('click', handleInternalWikiNavigation);
        };
    }, [article, navigate]);

    const handleSaveToLibrary = async () => {
        if (!article) return;
        setSaving(true);
        try {
            await wikiLibraryService.save({
                title: article.title,
                extract: article.extract,
                thumbnail: article.thumbnail || article.original_image,
                original_url: article.original_url,
                html_content: article.html_content,
                board_column: 'Inbox'
            });
            alert('Saved to Wiki Drafts board.');
        } catch (saveError) {
            if (saveError.response?.status === 401) {
                alert('Please login first to save this article.');
            } else {
                alert(saveError.response?.data?.title?.[0] || 'This article is already in your Wiki Drafts board.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleTextSelection = () => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() || '';
        if (text.length > 10) {
            setSelectedText(text);
        }
    };

    const explainSelection = async () => {
        if (!selectedText || !article?.title) return;
        setShowAiModal(true);
        setIsExplaining(true);
        setAiExplanation('');

        try {
            const res = await blogService.aiExplain({
                selected_text: selectedText,
                blog_title: article.title,
            });
            setAiExplanation(res.data?.explanation || 'No explanation returned.');
        } catch {
            setAiExplanation('Sorry, AI explanation is unavailable right now.');
        } finally {
            setIsExplaining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-canvas-light text-canvas-dark font-display font-bold uppercase tracking-widest">
                <span className="animate-pulse">Retrieving Knowledge...</span>
            </div>
        );
    }

    if (error || !article) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center bg-canvas-light px-4">
                <div className="brutal-border border-2 bg-white p-12 text-center max-w-lg w-full">
                    <h2 className="text-2xl font-display font-black text-red-600 uppercase tracking-widest mb-4">Error</h2>
                    <p className="text-gray-600 font-medium mb-8">{error || 'Article not found.'}</p>
                    <button onClick={() => navigate(-1)} className="btn-pill">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-canvas-light min-h-screen pb-20">
            <div className="bg-white border-b-2 border-canvas-dark pt-12 pb-20 px-4">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-[10px] font-bold font-display uppercase tracking-widest text-canvas-coral hover:text-canvas-dark transition-colors mb-8"
                    >
                        <ArrowLeft size={16} strokeWidth={3} /> Return
                    </button>

                    <div className="mb-6 inline-block px-3 py-1 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest">
                        Wikipedia Reference
                    </div>

                    <h1 className="text-[3rem] md:text-[5rem] leading-[1.1] font-display font-black tracking-tighter text-canvas-dark mb-6">
                        {article.title}
                    </h1>

                    {article.description && (
                        <p className="text-xl md:text-2xl font-medium text-gray-500 max-w-2xl border-l-4 border-canvas-coral pl-6 py-2">
                            {article.description}
                        </p>
                    )}

                    <div className="mt-8 flex flex-wrap gap-3">
                        <button
                            onClick={handleSaveToLibrary}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-canvas-dark text-white font-display font-black uppercase text-xs tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-70"
                        >
                            <BookmarkPlus size={16} /> {saving ? 'Saving...' : 'Save to Drafts'}
                        </button>
                        <Link
                            to="/dashboard/wiki-board"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-canvas-dark font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors"
                        >
                            Open Wiki Board
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 mt-[-40px] relative z-10">
                {article.original_image && (
                    <div className="mb-12 brutal-border border-2 bg-white p-2 md:p-4 shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                        <img
                            src={article.original_image}
                            alt={article.title}
                            className="w-full h-auto max-h-[600px] object-contain bg-canvas-light mix-blend-luminosity hover:mix-blend-normal transition-all duration-500"
                        />
                    </div>
                )}

                {!article.html_content && article.extract && (
                    <div className="var-bg-card p-8 md:p-12 mb-12 brutal-border border-2 border-canvas-dark bg-[#f8f8f8]">
                        <h3 className="text-[10px] font-bold font-display uppercase tracking-widest text-canvas-coral mb-4">Summary</h3>
                        <p className="text-lg md:text-xl font-medium leading-relaxed text-canvas-dark">
                            {article.extract}
                        </p>
                    </div>
                )}

                <div
                    ref={contentRef}
                    onMouseUp={handleTextSelection}
                    className="bg-white brutal-border border-2 border-canvas-dark p-8 md:p-16 mb-12 shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]"
                >
                    {article.html_content ? (
                        <div
                            className="prose prose-lg max-w-none prose-headings:font-display prose-headings:font-black prose-headings:text-canvas-dark prose-p:font-medium prose-p:text-gray-700 prose-a:text-canvas-coral prose-a:font-bold prose-img:border-2 prose-img:border-canvas-dark prose-blockquote:border-l-4 prose-blockquote:border-canvas-coral prose-blockquote:bg-canvas-light prose-blockquote:p-4 prose-blockquote:font-medium prose-blockquote:italic"
                            dangerouslySetInnerHTML={{ __html: article.html_content }}
                        />
                    ) : (
                        <p className="text-center text-gray-500 font-medium py-8">Full content is unavailable right now. You can open the original source on Wikipedia.</p>
                    )}

                    <div className="mt-16 pt-8 border-t-2 border-canvas-dark flex flex-col sm:flex-row justify-between items-center gap-4">
                        <span className="text-[10px] font-bold font-display uppercase tracking-widest text-gray-500">
                            Source: Wikipedia • CC BY-SA 3.0
                        </span>
                    </div>
                </div>

                {article.related && article.related.length > 0 && (
                    <div className="mb-20">
                        <h3 className="text-2xl font-display font-black uppercase tracking-widest text-canvas-dark border-b-2 border-canvas-dark pb-3 mb-8">
                            Related Knowledge
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {article.related.slice(0, 6).map((topic, idx) => (
                                <Link
                                    key={idx}
                                    to={`/wiki/${encodeURIComponent(topic)}`}
                                    className="brutal-border border-2 bg-white p-6 hover:bg-canvas-coral hover:border-canvas-coral group transition-colors flex flex-col shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                                >
                                    <BookOpen className="text-canvas-dark group-hover:text-white mb-4" size={24} strokeWidth={2} />
                                    <h4 className="text-lg font-display font-bold text-canvas-dark group-hover:text-white leading-snug">
                                        {topic}
                                    </h4>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {selectedText && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40">
                    <button
                        onClick={explainSelection}
                        className="bg-canvas-dark text-white px-8 py-4 flex items-center space-x-3 shadow-[8px_8px_0px_0px_rgba(224,106,89,1)] brutal-border border-white border-2 hover:bg-canvas-coral transition-colors"
                    >
                        <Sparkles size={20} className="text-white" />
                        <span className="font-display font-black uppercase text-xs tracking-[0.2em]">Explain Selection</span>
                    </button>
                </div>
            )}

            {showAiModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white brutal-border border-4 border-canvas-dark max-w-2xl w-full max-h-[80vh] overflow-y-auto flex flex-col shadow-[16px_16px_0px_0px_rgba(224,106,89,1)]">
                        <div className="p-6 border-b-4 border-canvas-dark flex justify-between items-center bg-canvas-light">
                            <h4 className="font-display font-black uppercase text-lg tracking-widest flex items-center">
                                <Sparkles size={24} className="text-canvas-coral mr-3" />
                                AI Explanation
                            </h4>
                            <button onClick={() => setShowAiModal(false)} className="text-canvas-dark hover:text-canvas-coral"><X size={32} /></button>
                        </div>
                        <div className="p-8 md:p-12">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Selected Text:</div>
                            <blockquote className="italic border-l-4 border-canvas-coral pl-6 py-2 mb-10 text-gray-600 text-base font-medium">
                                "{selectedText}"
                            </blockquote>

                            {isExplaining ? (
                                <div className="flex flex-col items-center py-16">
                                    <div className="w-16 h-16 border-8 border-canvas-coral border-t-transparent rounded-full animate-spin mb-6"></div>
                                    <span className="font-display font-black uppercase text-sm tracking-[0.2em] animate-pulse text-canvas-dark">Generating explanation...</span>
                                </div>
                            ) : (
                                <div className="whitespace-pre-wrap font-medium leading-loose text-canvas-dark">
                                    {aiExplanation}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
