import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { blogService, dashboardService } from '../services/api';
import { Search as SearchIcon, BookOpen, ArrowRight, Filter } from 'lucide-react';
import { getFullImageUrl } from '../utils/helpers';

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams();
    const keyword = searchParams.get('keyword') || '';

    const [blogs, setBlogs] = useState([]);
    const [wikiResults, setWikiResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState(keyword);

    const [categories, setCategories] = useState([]);
    const [tagsList, setTagsList] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Fetch initial filters data
    useEffect(() => {
        const fetchFiltersData = async () => {
            try {
                const [catsRes, tagsRes] = await Promise.all([
                    dashboardService.getCategories(),
                    blogService.getTags()
                ]);
                setCategories(catsRes.data);
                setTagsList(tagsRes.data);
            } catch (err) {
                console.error("Filter data error:", err);
            }
        };
        fetchFiltersData();
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            if (!keyword && !selectedCategory && !selectedTag && !selectedDifficulty) {
                setBlogs([]);
                setWikiResults([]);
                return;
            }

            setLoading(true);
            try {
                const params = {};
                if (keyword) params.search = keyword;
                if (selectedCategory) params.category = selectedCategory;
                if (selectedTag) params.tag = selectedTag;
                if (selectedDifficulty) params.difficulty = selectedDifficulty;

                const [blogRes, wikiRes] = await Promise.all([
                    blogService.getAll(params),
                    keyword ? blogService.searchWiki(keyword) : { data: [] }
                ]);
                setBlogs(Array.isArray(blogRes.data) ? blogRes.data : []);
                setWikiResults(Array.isArray(wikiRes.data) ? wikiRes.data : []);
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [keyword, selectedCategory, selectedTag, selectedDifficulty]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (inputValue.trim()) {
            setSearchParams({ keyword: inputValue.trim() });
        } else {
            setSearchParams({});
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mb-20">
            {/* Massive Search Header */}
            <div className="py-8 border-b-4 border-canvas-dark mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <h1 className="text-[2.5rem] sm:text-[4rem] md:text-[6rem] leading-none font-display font-black tracking-tighter uppercase text-canvas-dark">
                    SEARCH
                </h1>

                <div className="flex-grow max-w-2xl w-full flex flex-col gap-4">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row group w-full shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="SEARCH THE KNOWLEDGE BASE..."
                            className="w-full bg-white text-canvas-dark brutal-border border-4 border-canvas-dark px-6 py-4 font-display font-black uppercase tracking-widest text-sm focus:outline-none focus:border-canvas-coral transition-colors"
                        />
                        <button type="submit" className="sm:min-w-[88px] px-8 py-4 sm:py-0 bg-canvas-dark text-white border-4 sm:border-l-0 border-canvas-dark hover:bg-canvas-coral transition-colors flex items-center justify-center">
                            <SearchIcon size={24} className="stroke-[3px]" />
                        </button>
                    </form>
                    
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className="self-end flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-canvas-dark hover:text-canvas-coral transition-colors"
                    >
                        <Filter size={16} /> {showFilters ? 'Hide Parameters' : 'Advanced Parameters'}
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <div className="mb-16 p-8 bg-canvas-light brutal-border border-4 border-canvas-dark shadow-[12px_12px_0px_0px_rgba(224,106,89,1)]">
                    <h3 className="font-display font-black uppercase tracking-widest text-sm border-b-2 border-canvas-dark pb-4 mb-6">Refine Query</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-canvas-dark mb-2">Category</label>
                            <select 
                                className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark text-xs font-bold uppercase focus:outline-none"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-canvas-dark mb-2">Topic Tag</label>
                            <select 
                                className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark text-xs font-bold uppercase focus:outline-none"
                                value={selectedTag}
                                onChange={(e) => setSelectedTag(e.target.value)}
                            >
                                <option value="">All Tags</option>
                                {tagsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-canvas-dark mb-2">Complexity</label>
                            <select 
                                className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark text-xs font-bold uppercase focus:outline-none"
                                value={selectedDifficulty}
                                onChange={(e) => setSelectedDifficulty(e.target.value)}
                            >
                                <option value="">Any Level</option>
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-8 pt-4 border-t-2 border-canvas-dark flex justify-end">
                        <button 
                            onClick={() => { setSelectedCategory(''); setSelectedTag(''); setSelectedDifficulty(''); setInputValue(''); setSearchParams({}); }}
                            className="px-6 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-canvas-coral transition-colors"
                        >
                            Reset All Filters
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-40 font-display font-black text-2xl uppercase tracking-widest text-canvas-coral animate-pulse">
                    Scanning Neural Net...
                </div>
            ) : (
                (keyword || selectedCategory || selectedTag || selectedDifficulty) && (
                    <div className="space-y-24">
                        {/* Blogs Results */}
                        <section>
                            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b-8 border-canvas-dark pb-6 mb-12">
                                <h2 className="text-4xl md:text-5xl font-display font-black uppercase tracking-tighter text-canvas-dark leading-none">
                                    System Results
                                </h2>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total {blogs.length} Items</span>
                            </div>

                            {blogs.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 brutal-border border-l-4 border-t-4 border-r-0 border-b-0">
                                    {blogs.map((post, idx) => (
                                        <article key={post.id} className="brutal-border border-r-4 border-b-4 border-t-0 border-l-0 bg-white group hover:bg-canvas-light transition-colors flex flex-col">
                                            <div className="relative h-64 border-b-4 border-canvas-dark overflow-hidden bg-canvas-dark">
                                                <img src={getFullImageUrl(post.featured_image)} alt={post.title} className="w-full h-full object-cover grayscale mix-blend-luminosity group-hover:grayscale-0 group-hover:mix-blend-normal transition-all duration-500 hover:scale-110" />
                                                <div className="absolute top-4 left-4 bg-canvas-coral text-white brutal-border border-2 border-canvas-dark px-3 py-1 font-display font-black text-xl shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]">
                                                    0{idx + 1}
                                                </div>
                                            </div>
                                            <div className="p-8 flex flex-col flex-grow">
                                                <div className="flex justify-between items-center mb-6">
                                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-canvas-coral">{post.category?.category_name}</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 border border-canvas-dark ${post.difficulty_level === 'Advanced' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{post.difficulty_level}</span>
                                                </div>
                                                <Link to={`/post/${post.slug}`} className="block mb-8 flex-grow">
                                                    <h3 className="text-3xl font-display font-black text-canvas-dark leading-[1.1] group-hover:text-canvas-coral transition-colors uppercase tracking-tight">
                                                        {post.title}
                                                    </h3>
                                                </Link>
                                                <Link to={`/post/${post.slug}`} className="w-full py-4 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-[0.3em] text-center hover:bg-canvas-coral transition-colors brutal-border border-2 border-canvas-dark">
                                                    Access File
                                                </Link>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 brutal-border border-4 bg-canvas-light shadow-[12px_12px_0px_0px_rgba(224,106,89,1)]">
                                    <p className="font-display font-black text-2xl uppercase tracking-[0.2em] text-gray-400">Zero artifacts found for current parameters.</p>
                                </div>
                            )}
                        </section>

                        {/* Wikipedia Results */}
                        {keyword && (
                            <section>
                                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b-8 border-canvas-dark pb-6 mb-12">
                                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-black uppercase tracking-tighter text-canvas-dark leading-none flex items-center gap-3 sm:gap-4">
                                        <BookOpen className="text-canvas-coral" size={48} strokeWidth={3} />
                                        Global DB
                                    </h2>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Wikipedia Reference</span>
                                </div>

                                {wikiResults.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {wikiResults.map((wiki, idx) => (
                                            <Link key={idx} to={`/wiki/${encodeURIComponent(wiki.title)}`} className="brutal-border border-4 bg-white hover:bg-canvas-light group transition-all p-8 flex flex-col items-start shadow-[8px_8px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
                                                <span className="px-4 py-1 bg-canvas-coral text-white text-[10px] font-bold uppercase tracking-widest mb-6 brutal-border border-2 border-white">
                                                    Wikipedia Index
                                                </span>
                                                <h3 className="text-3xl font-display font-black text-canvas-dark group-hover:text-canvas-coral mb-4 uppercase leading-none tracking-tighter">
                                                    {wiki.title}
                                                </h3>
                                                <p className="text-sm font-medium text-gray-600 group-hover:text-gray-700 leading-relaxed mb-8 border-l-4 border-canvas-coral pl-4 italic">
                                                    {wiki.extract ? (wiki.extract.length > 150 ? wiki.extract.substring(0, 150) + '...' : wiki.extract) : "Read full record."}
                                                </p>
                                                <div className="mt-auto flex items-center gap-2 text-xs font-black font-display uppercase tracking-widest text-canvas-coral bg-white px-4 py-2 brutal-border border-2 border-canvas-dark group-hover:bg-canvas-coral group-hover:text-white">
                                                    Fetch Entry <ArrowRight size={16} strokeWidth={4} />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="font-display font-bold uppercase tracking-widest text-sm text-gray-500">No external records found.</p>
                                )}
                            </section>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
