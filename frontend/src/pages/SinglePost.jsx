import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { blogService } from '../services/api';
import { Heart, Sparkles, X, Bookmark, Eye, Clock, Link as LinkIcon, ExternalLink, Share2 } from 'lucide-react';
import { getFullImageUrl } from '../utils/helpers';

export default function SinglePost() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    
    // Interactions State
    const [hasLiked, setHasLiked] = useState(false);
    const [hasFavorited, setHasFavorited] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    
    // AI Explain State
    const [selectedText, setSelectedText] = useState('');
    const [aiExplanation, setAiExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const contentRef = useRef(null);

    useEffect(() => {
        const fetchPostData = async () => {
            try {
                const postRes = await blogService.getById(slug);

                if (String(postRes.data?.source_type || '').toLowerCase() === 'wikipedia' && postRes.data?.title) {
                    navigate(`/wiki/${encodeURIComponent(postRes.data.title)}`, { replace: true });
                    return;
                }

                setPost(postRes.data);

                const commentsRes = await blogService.getComments(slug);
                setComments(commentsRes.data);

                try {
                    const [likeRes, favRes] = await Promise.all([
                        blogService.checkLike(slug),
                        blogService.checkFavorite(slug)
                    ]);
                    setHasLiked(likeRes.data.user_has_liked);
                    setHasFavorited(favRes.data.is_favorited);
                } catch { /* might not be logged in */ }

            } catch (error) {
                console.error("Error fetching post", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPostData();
    }, [slug]);

    const handleTextSelection = () => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text && text.length > 10) {
            setSelectedText(text);
        }
    };

    const explainText = async () => {
        if (!selectedText) return;
        setIsExplaining(true);
        setShowAiModal(true);
        try {
            const res = await blogService.aiExplain({
                selected_text: selectedText,
                blog_title: post.title
            });
            setAiExplanation(res.data.explanation);
        } catch {
            setAiExplanation("Sorry, I couldn't explain that text right now.");
        } finally {
            setIsExplaining(false);
        }
    };

    const toggleLike = async () => {
        try {
            const res = await blogService.toggleLike(slug);
            setHasLiked(res.data.user_has_liked);
            setPost({ ...post, like_count: res.data.like_count });
        } catch (error) {
            if (error.response?.status === 401) alert("Please log in to like posts.");
        }
    };

    const toggleFavorite = async () => {
        try {
            const res = await blogService.toggleFavorite(slug);
            setHasFavorited(res.data.is_favorited);
            setPost({ ...post, favorite_count: res.data.favorite_count });
        } catch (error) {
            if (error.response?.status === 401) alert("Please log in to save to favorites.");
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            const res = await blogService.addComment(slug, newComment);
            setComments([res.data, ...comments]);
            setNewComment('');
            setPost({ ...post, comment_count: post.comment_count + 1 });
        } catch (error) {
            console.error("Error posting comment", error);
            if (error.response?.status === 401) alert("Please log in to comment.");
        }
    };

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: post.title,
                    text: post.short_description,
                    url: window.location.href,
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert("Link copied to clipboard!");
            }
        } catch (err) {
            console.error("Error sharing:", err);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-64 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Loading Knowledge...</div>;
    if (!post) return <div className="text-center font-display font-bold text-2xl py-12 text-canvas-dark">Artifact not found.</div>;

    return (
        <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mb-20">
            <header className="mb-12 border-b-4 border-canvas-dark pb-8">
                <div className="flex flex-wrap items-center gap-4 mb-8">
                    <span className="px-4 py-1 border-2 border-canvas-dark text-[10px] font-bold uppercase tracking-widest bg-canvas-dark text-white shadow-[2px_2px_0px_0px_rgba(224,106,89,1)]">
                        {post.category?.category_name}
                    </span>
                    <span className={`px-4 py-1 border-2 border-canvas-dark text-[10px] font-bold uppercase tracking-widest ${post.difficulty_level === 'Advanced' ? 'bg-red-100' : post.difficulty_level === 'Intermediate' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                        {post.difficulty_level}
                    </span>
                    {post.is_ai_reference && (
                        <span className="px-4 py-1 border-2 border-purple-600 bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                            <Sparkles size={12} /> AI Reference
                        </span>
                    )}
                </div>

                <h1 className="text-5xl sm:text-7xl font-display font-black text-canvas-dark leading-[0.9] tracking-tighter mb-8 uppercase">
                    {post.title}
                </h1>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-canvas-dark pt-6 mt-6">
                    <div className="flex items-center text-xs font-bold font-display uppercase tracking-widest text-canvas-dark">
                        <span>Compiled By <Link to={`/profile/${post.author?.username}`} className="text-canvas-coral hover:underline ml-1">{post.author?.username}</Link></span>
                        <span className="mx-3 text-gray-300">|</span>
                        <span>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    
                    <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        <span className="flex items-center gap-1"><Clock size={14} /> {post.read_time} Min Read</span>
                        <span className="flex items-center gap-1"><Eye size={14} /> {post.view_count} Views</span>
                    </div>
                </div>
            </header>

            <div className="brutal-border border-4 bg-canvas-dark w-full h-[300px] md:h-[500px] relative mb-16 shadow-[12px_12px_0px_0px_rgba(28,28,28,1)]">
                <img src={getFullImageUrl(post.featured_image)} alt={post.title} className="absolute inset-0 w-full h-full object-cover grayscale mix-blend-luminosity opacity-90 hover:grayscale-0 hover:mix-blend-normal hover:opacity-100 transition-all duration-700" />
            </div>

            <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-12">
                {/* Main Content */}
                <div className="lg:w-2/3">
                    <div 
                        ref={contentRef}
                        onMouseUp={handleTextSelection}
                        className="prose prose-lg prose-headings:font-display prose-headings:font-black prose-headings:uppercase prose-p:font-medium prose-p:leading-relaxed text-canvas-dark mb-16"
                    >
                        <p className="text-2xl font-display font-bold leading-relaxed mb-10 text-canvas-coral border-l-4 border-canvas-coral pl-6 italic">
                            {post.short_description}
                        </p>
                        <div className="text-lg leading-loose" dangerouslySetInnerHTML={{ __html: post.blog_body.replace(/\n/g, '<br/>') }} />
                    </div>
                </div>
                
                {/* Sidebar (Tags, Sources, Actions) */}
                <div className="lg:w-1/3 space-y-8">
                    {/* Action Panel */}
                    <div className="p-6 bg-canvas-light brutal-border border-4 border-canvas-dark shadow-[6px_6px_0px_0px_rgba(28,28,28,1)]">
                        <h4 className="font-display font-black uppercase tracking-widest text-sm mb-6 border-b-2 border-canvas-dark pb-2">Artifact Actions</h4>
                        <div className="flex flex-col gap-4">
                            <button onClick={toggleLike} className={`flex items-center justify-between w-full px-4 py-3 brutal-border border-2 transition-all ${hasLiked ? 'bg-canvas-coral text-white border-canvas-coral' : 'bg-white text-canvas-dark border-canvas-dark hover:bg-canvas-light'}`}>
                                <span className="font-bold uppercase text-xs tracking-widest flex items-center gap-2"><Heart size={16} className={hasLiked ? 'fill-current' : ''} /> Like</span>
                                <span className="font-bold">{post.like_count}</span>
                            </button>
                            <button onClick={toggleFavorite} className={`flex items-center justify-between w-full px-4 py-3 brutal-border border-2 transition-all ${hasFavorited ? 'bg-canvas-dark text-white border-canvas-dark' : 'bg-white text-canvas-dark border-canvas-dark hover:bg-canvas-light'}`}>
                                <span className="font-bold uppercase text-xs tracking-widest flex items-center gap-2"><Bookmark size={16} className={hasFavorited ? 'fill-current' : ''} /> Save</span>
                                <span className="font-bold">{post.favorite_count || 0}</span>
                            </button>
                            <button onClick={handleShare} className="flex items-center justify-between w-full px-4 py-3 brutal-border border-2 bg-white text-canvas-dark border-canvas-dark hover:bg-canvas-coral hover:text-white transition-all">
                                <span className="font-bold uppercase text-xs tracking-widest flex items-center gap-2"><Share2 size={16} /> Share</span>
                            </button>
                        </div>
                    </div>

                    {/* Metadata Panel */}
                    <div className="p-6 bg-white brutal-border border-4 border-canvas-dark shadow-[6px_6px_0px_0px_rgba(224,106,89,1)]">
                        {post.tags && post.tags.length > 0 && (
                            <div className="mb-8">
                                <h4 className="font-display font-black uppercase tracking-widest text-sm mb-4">Tags</h4>
                                <div className="flex flex-wrap gap-2">
                                    {post.tags.map(tag => (
                                        <span key={tag.id} className="px-3 py-1 bg-canvas-light text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-coral hover:text-white hover:border-canvas-coral transition-colors cursor-pointer">
                                            #{tag.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-8">
                            <h4 className="font-display font-black uppercase tracking-widest text-sm mb-4">Source Intelligence</h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-600">
                                    <span className="w-20 text-canvas-dark">Origin:</span> 
                                    <span className="px-2 py-1 bg-gray-100 border border-gray-300">{post.source_type}</span>
                                </div>
                                {post.source_url && post.source_type !== 'Wikipedia' && (
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                                        <span className="w-20 text-canvas-dark">URL:</span>
                                        <a href={post.source_url} target="_blank" rel="noreferrer" className="text-canvas-coral hover:underline flex items-center gap-1 truncate"><ExternalLink size={12}/> View Original</a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {post.reference_links && (
                            <div>
                                <h4 className="font-display font-black uppercase tracking-widest text-sm mb-4 flex items-center gap-2"><LinkIcon size={16}/> References</h4>
                                <div className="text-xs font-mono bg-canvas-dark text-white p-4 whitespace-pre-wrap leading-relaxed">
                                    {post.reference_links}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Explain Floating Trigger */}
            {selectedText && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40">
                    <button 
                        onClick={explainText}
                        className="bg-canvas-dark text-white px-8 py-4 flex items-center space-x-3 shadow-[8px_8px_0px_0px_rgba(224,106,89,1)] brutal-border border-white border-2 hover:bg-canvas-coral transition-colors animate-bounce"
                    >
                        <Sparkles size={20} className="text-white" />
                        <span className="font-display font-black uppercase text-xs tracking-[0.2em]">Explain Selection</span>
                    </button>
                </div>
            )}

            {/* Comments Section */}
            <div className="max-w-3xl mx-auto mt-20 border-t-8 border-canvas-dark pt-12">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-4xl font-display font-black tracking-tighter uppercase text-canvas-dark">
                        Discourse
                    </h3>
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{post.comment_count} Entries</span>
                </div>

                {localStorage.getItem('access_token') && (
                    <form onSubmit={handleCommentSubmit} className="mb-12 p-8 bg-white brutal-border border-4 border-canvas-dark shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                        <h4 className="font-display font-black uppercase tracking-widest text-sm mb-6 border-b-2 border-canvas-dark pb-2 text-canvas-dark">Contribute to Discourse</h4>
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Enter your insights..."
                            className="w-full h-32 p-4 brutal-border border-2 border-canvas-dark font-medium text-canvas-dark focus:ring-0 focus:border-canvas-coral mb-6 outline-none resize-none"
                            required
                        ></textarea>
                        <button
                            type="submit"
                            className="px-8 py-3 bg-canvas-dark text-white font-display font-black uppercase text-xs tracking-widest hover:bg-canvas-coral transition-colors brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(224,106,89,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                        >
                            Submit Entry
                        </button>
                    </form>
                )}
                
                <div className="space-y-6">
                    {comments.map(c => (
                        <div key={c.id} className="bg-canvas-light p-8 brutal-border border-4 border-canvas-dark relative group hover:bg-white transition-colors">
                            <div className="absolute top-0 left-0 w-2 h-full bg-canvas-coral"></div>
                            <div className="flex justify-between items-center mb-4 border-b-2 border-canvas-dark pb-4">
                                <span className="font-black font-display uppercase tracking-widest text-sm text-canvas-dark">{c.user?.username}</span>
                                <span className="text-[10px] font-bold font-display uppercase tracking-widest text-gray-500">{new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-canvas-dark font-medium text-base leading-relaxed pl-2">{c.comment}</p>
                        </div>
                    ))}
                    {comments.length === 0 && (
                        <div className="text-center py-12 border-4 border-dashed border-gray-300">
                            <p className="text-gray-400 font-display font-black uppercase text-lg tracking-widest">Silence... Be the first to initiate discourse.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Explanation Modal */}
            {showAiModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white brutal-border border-4 border-canvas-dark max-w-2xl w-full max-h-[80vh] overflow-y-auto flex flex-col shadow-[16px_16px_0px_0px_rgba(224,106,89,1)]">
                        <div className="p-6 border-b-4 border-canvas-dark flex justify-between items-center bg-canvas-light">
                            <h4 className="font-display font-black uppercase text-lg tracking-widest flex items-center">
                                <Sparkles size={24} className="text-canvas-coral mr-3" />
                                Nexus Insights
                            </h4>
                            <button onClick={() => setShowAiModal(false)} className="text-canvas-dark hover:text-canvas-coral"><X size={32}/></button>
                        </div>
                        <div className="p-8 md:p-12">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Target Artifact:</div>
                            <blockquote className="italic border-l-4 border-canvas-coral pl-6 py-2 mb-10 text-gray-600 text-base font-medium">
                                "{selectedText}"
                            </blockquote>
                            
                            {isExplaining ? (
                                <div className="flex flex-col items-center py-16">
                                    <div className="w-16 h-16 border-8 border-canvas-coral border-t-transparent rounded-full animate-spin mb-6"></div>
                                    <span className="font-display font-black uppercase text-sm tracking-[0.2em] animate-pulse text-canvas-dark">Consulting the Oracle...</span>
                                </div>
                            ) : (
                                <div className="prose prose-lg max-w-none">
                                    <div className="whitespace-pre-wrap font-medium leading-loose text-canvas-dark">
                                        {aiExplanation}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-canvas-light border-t-4 border-canvas-dark mt-auto">
                             <button 
                                onClick={() => setShowAiModal(false)}
                                className="w-full py-4 bg-canvas-dark text-white font-display font-black uppercase text-sm tracking-[0.2em] hover:bg-canvas-coral transition-colors"
                             >
                                Close Terminal
                             </button>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
}
