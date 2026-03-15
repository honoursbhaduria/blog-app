import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { blogService } from '../services/api';
import { getFullImageUrl } from '../utils/helpers';

export default function Trending() {
    const [blogs, setBlogs] = useState([]);
    const [wikiTrending, setWikiTrending] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const res = await blogService.getTrending();
                setBlogs(Array.isArray(res.data?.blogs) ? res.data.blogs : []);
                setWikiTrending(Array.isArray(res.data?.wiki_trending) ? res.data.wiki_trending : []);
            } catch (error) {
                console.error("Error fetching trending data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTrending();
    }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-canvas-light text-canvas-dark font-display font-bold uppercase tracking-widest animate-pulse">
            Curating Trending Content...
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            {/* Header Section */}
            <div className="relative h-[300px] md:h-[400px] bg-canvas-dark brutal-border border-2 mt-12 shadow-[12px_12px_0px_0px_rgba(224,106,89,1)] mb-20 flex flex-col justify-between p-8 md:p-12">
                <div className="flex justify-end">
                    <div className="bg-canvas-coral text-white brutal-border border-2 border-white px-6 py-2 font-display font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]">
                        LIVE PULSE
                    </div>
                </div>
                
                <div>
                    <p className="font-display font-bold uppercase text-xs md:text-sm tracking-[0.3em] leading-relaxed text-canvas-coral">
                        MOST LOVED STORIES & KNOWLEDGE
                    </p>
                </div>
            </div>

            {/* Wikipedia Section (Now titled Community Favorites per request) */}
            <div className="mb-12 border-b-8 border-canvas-dark pb-6">
                <h3 className="text-4xl md:text-5xl font-display font-black uppercase tracking-tighter text-canvas-dark leading-none">
                    COMMUNITY FAVORITES (WIKIPEDIA)
                </h3>
            </div>

            {wikiTrending.length > 0 ? (
                <section className="mb-32">
                    {wikiTrending.map((wiki, idx) => (
                        <div key={idx} className="brutal-border border-4 bg-white p-8 md:p-12 flex flex-col md:flex-row gap-12 items-center shadow-[12px_12px_0px_0px_rgba(28,28,28,1)]">
                            <div className="w-full md:w-1/3 aspect-square brutal-border border-4 overflow-hidden bg-canvas-dark">
                                {wiki.thumbnail ? (
                                    <img src={getFullImageUrl(wiki.thumbnail)} className="w-full h-full object-cover grayscale" alt="Wiki" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-display font-black text-4xl text-canvas-coral opacity-20 uppercase">WIKI</div>
                                )}
                            </div>
                            <div className="w-full md:w-2/3">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mb-4">GLOBAL KNOWLEDGE INDEX</div>
                                <h2 className="text-4xl md:text-6xl font-display font-black uppercase tracking-tighter text-canvas-dark mb-6 leading-none">
                                    {wiki.title}
                                </h2>
                                <p className="text-sm font-medium text-gray-600 mb-8 line-clamp-4 leading-relaxed">
                                    {wiki.extract}
                                </p>
                                <Link to={`/wiki/${encodeURIComponent(wiki.title)}`} className="inline-block px-10 py-4 bg-canvas-dark text-white font-display font-black uppercase text-xs tracking-widest hover:bg-canvas-coral transition-colors shadow-[4px_4px_0px_0px_rgba(224,106,89,1)] hover:shadow-none translate-x-0 hover:translate-x-1 hover:translate-y-1">
                                    Read Knowledge File
                                </Link>
                            </div>
                        </div>
                    ))}
                </section>
            ) : (
                <div className="mb-32 p-12 brutal-border border-4 bg-canvas-light text-center">
                    <p className="font-display font-black text-xl uppercase tracking-widest text-gray-400">Knowledge pulse offline...</p>
                </div>
            )}

            {/* User Created Blogs Section */}
            <div className="mb-12 border-b-8 border-canvas-dark pb-6">
                <div className="flex items-end justify-between">
                    <h3 className="text-4xl md:text-5xl font-display font-black uppercase tracking-tighter text-canvas-dark leading-none">
                        USER COMPILATIONS
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                        TOTAL {blogs.length} RECORDS
                    </span>
                </div>
            </div>

            {blogs.length > 0 ? (
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 brutal-border border-l-4 border-t-4 border-r-0 border-b-0 mb-32">
                    {blogs.map((post, idx) => (
                        <article key={post.id} className="brutal-border border-r-4 border-b-4 border-t-0 border-l-0 bg-white group hover:bg-canvas-light transition-colors flex flex-col">
                            <div className="relative h-72 border-b-4 border-canvas-dark overflow-hidden bg-canvas-dark">
                                <img src={getFullImageUrl(post.featured_image)} alt={post.title} className="w-full h-full object-cover grayscale mix-blend-luminosity group-hover:grayscale-0 group-hover:mix-blend-normal transition-all duration-500 hover:scale-110" />
                                <div className="absolute bottom-4 left-4 bg-canvas-coral text-white brutal-border border-2 border-canvas-dark px-3 py-1 font-display font-black text-xl shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]">
                                    0{idx + 1}
                                </div>
                            </div>
                            <div className="p-8 flex flex-col flex-grow">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-canvas-coral">{post.category?.category_name}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{post.like_count} Likes</span>
                                </div>
                                <Link to={`/post/${post.slug}`} className="block mb-8 flex-grow">
                                    <h3 className="text-3xl font-display font-black text-canvas-dark leading-[1.1] group-hover:text-canvas-coral transition-colors uppercase tracking-tight">
                                        {post.title}
                                    </h3>
                                </Link>
                                <Link to={`/post/${post.slug}`} className="w-full py-4 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-[0.3em] text-center hover:bg-canvas-coral transition-colors brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
                                    Access Artifact
                                </Link>
                            </div>
                        </article>
                    ))}
                </section>
            ) : (
                <div className="text-center py-20 brutal-border border-4 bg-canvas-light mb-32 shadow-[12px_12px_0px_0px_rgba(224,106,89,1)]">
                    <p className="font-display font-black text-2xl uppercase tracking-[0.2em] text-gray-400">No original artifacts detected.</p>
                </div>
            )}

            {/* Massive Footer Title */}
            <div className="pt-20 border-t-4 border-canvas-dark text-center overflow-hidden">
                <h2 className="text-[10rem] md:text-[18rem] font-display font-black text-canvas-dark leading-[0.7] uppercase tracking-tighter translate-y-12">
                    THE CANVAS
                </h2>
            </div>
        </div>
    );
}
