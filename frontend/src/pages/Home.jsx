import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { blogService } from '../services/api';
import { getFullImageUrl } from '../utils/helpers';
import canvasTextFill from '../assets/canvas-spiderman.jpg';

const WIKI_FALLBACK_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/512px-Wikipedia-logo-v2.svg.png';

export default function Home() {
    const [featuredPosts, setFeaturedPosts] = useState([]);
    const [posts, setPosts] = useState([]);
    const [wikipediaPosts, setWikipediaPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customCanvasBg, setCustomCanvasBg] = useState('');
    const [canvasMessage, setCanvasMessage] = useState('');

    const isAuthenticated = !!localStorage.getItem('access_token');

    useEffect(() => {
        const savedCanvasImage = localStorage.getItem('canvas_text_bg_image');
        if (savedCanvasImage) {
            setCustomCanvasBg(savedCanvasImage);
        }

        const fetchPosts = async () => {
            try {
                const [featuredRes, postsRes, liveWikiRes, savedWikiRes] = await Promise.all([
                    blogService.getAll({ featured: 'true' }),
                    blogService.getAll(),
                    blogService.getRandomWiki(8),
                    blogService.getAll({ source_type: 'Wikipedia' })
                ]);

                // Merge live wiki items and saved wiki items
                const liveWikiItems = Array.isArray(liveWikiRes.data) ? liveWikiRes.data : [];
                const savedWikiItems = Array.isArray(savedWikiRes.data) ? savedWikiRes.data : [];
                
                // Map saved items to look like wiki results for consistent rendering
                const mappedSaved = savedWikiItems.map(item => ({
                    title: item.title,
                    extract: item.short_description,
                    thumbnail: item.featured_image,
                    is_local: true,
                    slug: item.slug
                }));

                const combinedWiki = [...mappedSaved, ...liveWikiItems].slice(0, 9);
                
                setFeaturedPosts(Array.isArray(featuredRes.data) ? featuredRes.data : []);
                setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
                setWikipediaPosts(combinedWiki);
            } catch (error) {
                console.error("Error fetching posts:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPosts();
    }, []);

    const showCanvasMessage = (text) => {
        setCanvasMessage(text);
        window.setTimeout(() => setCanvasMessage(''), 1500);
    };

    const handleCanvasImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showCanvasMessage('Please choose an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!dataUrl) return;

            setCustomCanvasBg(dataUrl);
            localStorage.setItem('canvas_text_bg_image', dataUrl);
            showCanvasMessage('Canvas background updated');
        };
        reader.readAsDataURL(file);
    };

    const resetCanvasImage = () => {
        setCustomCanvasBg('');
        localStorage.removeItem('canvas_text_bg_image');
        showCanvasMessage('Canvas background reset');
    };

    if (loading) return <div className="flex justify-center items-center h-64 font-display font-bold uppercase tracking-widest text-canvas-coral">Loading The Canvas...</div>;

    const mainFeature = featuredPosts?.length > 0 ? featuredPosts[0] : null;
    const allRecentPosts = posts || [];

    const getPostLink = (post) => {
        if (String(post?.source_type || '').toLowerCase() === 'wikipedia') {
            return `/wiki/${encodeURIComponent(post.title)}`;
        }
        return `/post/${post.slug}`;
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">

            {/* Massive Heading Section */}
            <div className="py-12 border-b-4 border-canvas-dark mb-16 flex flex-col md:flex-row md:items-end justify-between bg-white px-4 sm:px-6 md:px-8 brutal-border border-2 mt-8 shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                <div>
                    <h1 className="text-[2.75rem] sm:text-[4rem] md:text-[10rem] leading-[0.8] font-display font-black tracking-tighter uppercase text-canvas-dark break-words">
                        <span
                            className="text-transparent bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] bg-center bg-cover"
                            style={{
                                backgroundImage: `url(${customCanvasBg || canvasTextFill})`,
                            }}
                        >
                            THE CANVAS
                        </span>
                    </h1>
                    <div className="mt-4 max-w-md">
                        <p className="font-display font-bold uppercase text-sm tracking-[0.2em] leading-relaxed text-canvas-coral">
                            Technology &bull; AI &bull; Programming &bull; Data Science
                        </p>
                    </div>

                    {isAuthenticated && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <label className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-canvas-coral transition-colors">
                                Custom Canvas Image
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleCanvasImageUpload}
                                />
                            </label>
                            <button
                                type="button"
                                onClick={resetCanvasImage}
                                className="px-4 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark hover:bg-canvas-light transition-colors"
                            >
                                Reset
                            </button>
                            {canvasMessage && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral">
                                    {canvasMessage}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="hidden lg:block pb-4">
                    <div className="flex space-x-2">
                        <div className="w-12 h-12 rounded-full border-2 border-canvas-dark flex items-center justify-center font-display font-black text-xl bg-canvas-coral text-white shadow-[3px_3px_0px_0px_rgba(28,28,28,1)]">B</div>
                        <div className="w-12 h-12 rounded-full border-2 border-canvas-dark flex items-center justify-center font-display font-black text-xl bg-white text-canvas-dark shadow-[3px_3px_0px_0px_rgba(28,28,28,1)]">X</div>
                        <div className="w-12 h-12 rounded-full border-2 border-canvas-dark flex items-center justify-center font-display font-black text-xl bg-canvas-dark text-white shadow-[3px_3px_0px_0px_rgba(28,28,28,1)]">P</div>
                    </div>
                </div>
            </div>

            {/* Hero Section */}
            {mainFeature ? (
                <section className="mb-24 relative">
                    <div className="brutal-border border-4 bg-white flex flex-col lg:flex-row w-full shadow-[12px_12px_0px_0px_rgba(224,106,89,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all group overflow-hidden">
                        
                        {/* Text Box (Left) */}
                        <div className="p-6 sm:p-8 lg:p-16 lg:w-1/2 flex flex-col justify-center border-b-4 lg:border-b-0 lg:border-r-4 border-canvas-dark bg-white z-10">
                            <div className="inline-block px-4 py-1 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest mb-8 self-start">
                                Featured Edition
                            </div>
                            
                            <Link to={`/post/${mainFeature.slug}`}>
                                <h2 className="text-3xl sm:text-4xl lg:text-7xl font-display font-black text-canvas-dark leading-[0.9] mb-8 hover:text-canvas-coral transition-colors uppercase tracking-tighter">
                                    {mainFeature.title}
                                </h2>
                            </Link>
                            
                            <p className="text-lg font-medium leading-relaxed text-gray-700 mb-10 border-l-4 border-canvas-coral pl-6 italic">
                                {mainFeature.short_description}
                            </p>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <Link to={getPostLink(mainFeature)} className="px-8 py-4 bg-canvas-coral text-white text-xs font-black uppercase tracking-[0.2em] brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none transition-all">
                                    Read Issue
                                </Link>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    By {mainFeature.author?.username} &bull; {new Date(mainFeature.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* Image Box (Right) */}
                        <div className="lg:w-1/2 relative bg-canvas-dark overflow-hidden min-h-[400px]">
                            <img src={getFullImageUrl(mainFeature.featured_image)} alt={mainFeature.title} className="absolute inset-0 w-full h-full object-cover grayscale mix-blend-luminosity opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:grayscale-0 group-hover:mix-blend-normal transition-all duration-1000 ease-in-out" />
                        </div>
                    </div>
                </section>
            ) : (
                <div className="mb-24 p-12 brutal-border border-4 bg-white text-center shadow-[12px_12px_0px_0px_rgba(224,106,89,1)]">
                    <p className="font-display font-black text-2xl uppercase tracking-widest text-gray-400">No primary artifacts established yet.</p>
                </div>
            )}

            {/* Podcast/Secondary Promo Section (Mimicking image copy 4) */}
            <section className="mb-24 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 brutal-border border-4 bg-canvas-light p-8 flex flex-col md:flex-row gap-8 items-center shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                    <div className="w-full md:w-1/3 aspect-square brutal-border border-4 overflow-hidden bg-white">
                        <img src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover grayscale" alt="Podcast" />
                    </div>
                    <div className="w-full md:w-2/3">
                                 <h3 className="text-2xl md:text-4xl font-display font-black uppercase tracking-tighter text-canvas-dark mb-4 leading-none">
                            Have You Heard Our Podcast Yet?
                         </h3>
                         <div className="space-y-3 mb-8">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest border-b border-canvas-dark pb-2">
                                <span>001 - Art In The City</span>
                                <span className="text-canvas-coral">12:45</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest border-b border-canvas-dark pb-2">
                                <span>002 - Design Systems</span>
                                <span className="text-canvas-coral">08:20</span>
                            </div>
                         </div>
                         <button className="w-full py-4 bg-canvas-coral text-white font-display font-black uppercase text-xs tracking-widest rounded-full brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none transition-all">
                            Playlist
                         </button>
                    </div>
                </div>
                
                <div className="brutal-border border-4 bg-white p-8 flex flex-col justify-center items-center text-center shadow-[8px_8px_0px_0px_rgba(224,106,89,1)]">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mb-4">Contact</div>
                    <h4 className="text-2xl md:text-3xl font-display font-black uppercase leading-tight mb-6">Get In Touch</h4>
                    <a
                        href="mailto:honoursbhadauria@gmail.com"
                        className="w-full p-4 brutal-border border-2 border-canvas-dark mb-4 text-xs font-bold uppercase tracking-widest text-canvas-dark hover:bg-canvas-light transition-colors"
                    >
                        honoursbhadauria@gmail.com
                    </a>
                    <a
                        href="https://github.com/honoursbhaduria"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-4 bg-canvas-dark text-white font-display font-black uppercase text-xs tracking-widest hover:bg-canvas-coral transition-colors"
                    >
                        GitHub
                    </a>
                </div>
            </section>

            <section className="mt-24">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b-4 border-canvas-dark pb-4 mb-8">
                    <h2 className="text-4xl md:text-5xl font-display font-black uppercase tracking-tighter text-canvas-dark leading-none">
                        Latest From Platform Users
                    </h2>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                        Total {allRecentPosts.length} Posts
                    </span>
                </div>

            {/* The Grid (Recent & secondary features) */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 brutal-border border-l-2 border-t-2 border-r-0 border-b-0">
                {allRecentPosts.map((post) => (
                    <article key={post.id} className="brutal-border border-r-2 border-b-2 border-t-0 border-l-0 bg-white group hover:bg-canvas-light transition-colors flex flex-col">
                        <div className="h-64 border-b-2 border-canvas-dark overflow-hidden bg-canvas-dark relative">
                            <img src={getFullImageUrl(post.featured_image)} alt={post.title} className="w-full h-full object-cover transition-all duration-500 hover:scale-105" />
                            <div className="absolute top-4 left-4">
                                <span className="bg-canvas-coral text-white border border-canvas-dark px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(28,28,28,1)]">
                                    {post.category?.category_name}
                                </span>
                            </div>
                        </div>
                        <div className="p-6 flex flex-col flex-grow">
                            <div className="text-[10px] font-bold font-display uppercase tracking-widest text-gray-400 mb-3">
                                {new Date(post.created_at).toLocaleDateString()} &bull; By {post.author?.username}
                            </div>
                            <Link to={getPostLink(post)} className="block mb-4 flex-grow">
                                <h3 className="text-2xl font-display font-bold text-canvas-dark leading-snug group-hover:text-canvas-coral transition-colors">
                                    {post.title}
                                </h3>
                            </Link>
                            <p className="text-sm font-medium text-gray-600 line-clamp-2 mb-6">
                                {post.short_description}
                            </p>
                            <Link to={getPostLink(post)} className="inline-flex max-w-max px-5 py-2 rounded-full border border-canvas-dark text-xs font-bold uppercase tracking-widest hover:bg-canvas-dark hover:text-white transition-colors mt-auto">
                                Read More
                            </Link>
                        </div>
                    </article>
                ))}
                {allRecentPosts.length === 0 && (
                    <div className="col-span-full p-12 text-center border-r-2 border-b-2 border-canvas-dark">
                        <p className="font-display font-bold text-xl uppercase tracking-widest text-gray-400">No secondary knowledge artifacts detected.</p>
                    </div>
                )}
            </section>
            </section>

            {/* Wikipedia Blogs */}
            <section className="mt-24">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b-4 border-canvas-dark pb-4 mb-8">
                    <h2 className="text-4xl md:text-5xl font-display font-black uppercase tracking-tighter text-canvas-dark leading-none">
                        Wikipedia Blogs
                    </h2>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                        Total {wikipediaPosts.length} Entries
                    </span>
                </div>

                {wikipediaPosts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 brutal-border border-l-2 border-t-2 border-r-0 border-b-0">
                        {wikipediaPosts.map((post, index) => {
                            const wikiImage = getFullImageUrl(post.thumbnail) || WIKI_FALLBACK_IMAGE;

                            return (
                            <article key={`wiki-${post.title}-${index}`} className="brutal-border border-r-2 border-b-2 border-t-0 border-l-0 bg-white group hover:bg-canvas-light transition-colors flex flex-col">
                                <div className="h-64 border-b-2 border-canvas-dark overflow-hidden bg-canvas-dark relative">
                                    <img
                                        src={wikiImage}
                                        onError={(event) => {
                                            event.currentTarget.onerror = null;
                                            event.currentTarget.src = WIKI_FALLBACK_IMAGE;
                                        }}
                                        alt={post.title}
                                        className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
                                    />
                                    <div className="absolute top-4 left-4">
                                        <span className="bg-canvas-coral text-white border border-canvas-dark px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(28,28,28,1)]">
                                            Wikipedia
                                        </span>
                                    </div>
                                </div>
                                    <div className="p-6 flex flex-col flex-grow">
                                        <div className="text-[10px] font-bold font-display uppercase tracking-widest text-gray-400 mb-3">
                                            {post.is_local ? 'Saved Knowledge' : 'Live Wikipedia'} &bull; {post.is_local ? 'Local Archive' : 'Random Feed'}
                                        </div>
                                        <Link to={post.is_local ? `/post/${post.slug}` : `/wiki/${encodeURIComponent(post.title)}`} className="block mb-4 flex-grow">
                                            <h3 className="text-2xl font-display font-bold text-canvas-dark leading-snug group-hover:text-canvas-coral transition-colors">
                                                {post.title}
                                            </h3>
                                        </Link>
                                        <p className="text-sm font-medium text-gray-600 line-clamp-2 mb-6">
                                            {post.extract || 'No summary available.'}
                                        </p>
                                        <Link to={post.is_local ? `/post/${post.slug}` : `/wiki/${encodeURIComponent(post.title)}`} className="inline-flex max-w-max px-5 py-2 rounded-full border border-canvas-dark text-xs font-bold uppercase tracking-widest hover:bg-canvas-dark hover:text-white transition-colors mt-auto">
                                            {post.is_local ? 'Read Blog' : 'Explore Wiki'}
                                        </Link>
                                    </div>
                            </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-10 brutal-border border-2 border-canvas-dark bg-white text-center">
                        <p className="font-display font-bold text-xl uppercase tracking-widest text-gray-400">No live Wikipedia entries available right now.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
