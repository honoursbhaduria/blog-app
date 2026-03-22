import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { blogService } from '../services/api';
import { getFullImageUrl } from '../utils/helpers';

export default function CategoryPosts() {
    const { id } = useParams();
    const [posts, setPosts] = useState([]);
    const [category, setCategory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCategoryData = async () => {
            setLoading(true);
            try {
                const [postsRes, catsRes] = await Promise.all([
                    blogService.getAll({ category: id }),
                    blogService.getCategories()
                ]);
                setPosts(postsRes.data);
                const currentCat = catsRes.data.find(c => c.id.toString() === id.toString());
                if (currentCat) setCategory(currentCat);
            } catch (error) {
                console.error("Error fetching category data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCategoryData();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-canvas-light text-canvas-dark font-display font-bold uppercase tracking-widest">
                <span className="animate-pulse">Loading Archive...</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mb-20 bg-canvas-light text-canvas-dark">
            {/* Category Header */}
            <div className="py-12 border-b-4 border-canvas-dark mb-16 flex flex-col items-center justify-center bg-white px-4 sm:px-8 brutal-border border-2 mt-8 shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                <div className="text-[10px] font-bold font-display uppercase tracking-widest text-canvas-coral mb-4">
                    Category Archive
                </div>
                <h1 className="text-[2.5rem] sm:text-[4rem] md:text-[7rem] leading-none font-display font-black tracking-tighter uppercase text-canvas-dark text-center break-words">
                    {category ? category.category_name : 'Unknown'}
                </h1>
            </div>

            {/* Posts Grid */}
            {posts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 brutal-border border-l-2 border-t-2 border-r-0 border-b-0">
                    {posts.map(post => (
                        <article key={post.id} className="brutal-border border-r-2 border-b-2 border-t-0 border-l-0 bg-white group hover:bg-canvas-light transition-colors flex flex-col h-full">
                            <div className="relative h-64 border-b-2 border-canvas-dark overflow-hidden bg-canvas-dark">
                                {post.featured_image ? (
                                    <img
                                        src={getFullImageUrl(post.featured_image)}
                                        alt={post.title}
                                        className="w-full h-full object-cover grayscale mix-blend-luminosity group-hover:grayscale-0 group-hover:mix-blend-normal transition-all duration-500 hover:scale-105"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-canvas-coral font-display font-black text-4xl opacity-20 uppercase">No Image</span>
                                    </div>
                                )}
                            </div>
                            <div className="p-8 flex flex-col flex-grow">
                                <div className="text-[10px] font-bold font-display uppercase tracking-widest text-gray-400 mb-4 flex justify-between">
                                    <span>By {post.author?.username}</span>
                                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                                <Link to={`/post/${post.slug}`} className="block mb-6 flex-grow">
                                    <h3 className="text-2xl font-display font-black text-canvas-dark leading-snug group-hover:text-canvas-coral transition-colors uppercase">
                                        {post.title}
                                    </h3>
                                </Link>
                                <p className="text-xs font-medium text-gray-600 line-clamp-3 mb-8 italic">
                                    {post.short_description}
                                </p>
                                <Link to={`/post/${post.slug}`} className="inline-flex max-w-max px-6 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-canvas-coral transition-colors">
                                    Read Article
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 brutal-border border-4 bg-white shadow-[8px_8px_0px_0px_rgba(224,106,89,1)]">
                    <h2 className="text-3xl font-display font-black text-canvas-dark mb-4 uppercase">Archive Empty</h2>
                    <p className="text-gray-500 font-medium mb-12 uppercase text-xs tracking-widest">No articles found in this category.</p>
                    <Link to="/" className="px-8 py-4 bg-canvas-dark text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-canvas-coral transition-colors">Return to Feed</Link>
                </div>
            )}
        </div>
    );
}
