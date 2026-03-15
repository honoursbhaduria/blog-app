import { useState, useEffect, useCallback } from 'react';
import { clusterService, blogService, dashboardService, wikiLibraryService } from '../services/api';
import { Pencil, Trash2, Plus, X, FolderTree, Search, Bot, FilePlus2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function DashboardClusters() {
    const navigate = useNavigate();
    const [clusters, setClusters] = useState([]);
    const [tagsList, setTagsList] = useState([]);
    const [userBlogs, setUserBlogs] = useState([]);
    const [savedWiki, setSavedWiki] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [wikiQuery, setWikiQuery] = useState('technology');
    const [wikiResults, setWikiResults] = useState([]);
    const [wikiLoading, setWikiLoading] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);

    const [selectedClusterId, setSelectedClusterId] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftLoading, setDraftLoading] = useState(false);
    
    // Form State
    const [currentCluster, setCurrentCluster] = useState({
        id: null, name: '', description: '', selectedTags: [], selectedBlogs: [], selectedWikiArticles: []
    });

    const fetchData = useCallback(async () => {
        try {
            const [clustersRes, tagsRes, blogsRes, savedWikiRes] = await Promise.all([
                clusterService.getAll(),
                blogService.getTags(),
                dashboardService.getPosts(),
                wikiLibraryService.getAll()
            ]);
            setClusters(clustersRes.data);
            setTagsList(tagsRes.data);
            setUserBlogs(blogsRes.data);
            setSavedWiki(savedWikiRes.data);

            setSelectedClusterId((previous) => {
                if (previous) return previous;
                if (clustersRes.data?.length) return String(clustersRes.data[0].id);
                return '';
            });
        } catch (error) {
            console.error("Failed to fetch clusters data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const searchWikipedia = useCallback(async (query = wikiQuery) => {
        const finalQuery = query.trim() || 'technology';
        setWikiLoading(true);
        try {
            const res = await blogService.searchWiki(finalQuery);
            setWikiResults(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to search Wikipedia', error);
            setWikiResults([]);
        } finally {
            setWikiLoading(false);
        }
    }, [wikiQuery]);

    useEffect(() => {
        fetchData();
        searchWikipedia('technology');
    }, [fetchData, searchWikipedia]);

    const handleTagToggle = (tagId) => {
        const selected = currentCluster.selectedTags || [];
        if (selected.includes(tagId)) {
            setCurrentCluster({ ...currentCluster, selectedTags: selected.filter(id => id !== tagId) });
        } else {
            setCurrentCluster({ ...currentCluster, selectedTags: [...selected, tagId] });
        }
    };

    const handleBlogToggle = (blogId) => {
        const selected = currentCluster.selectedBlogs || [];
        if (selected.includes(blogId)) {
            setCurrentCluster({ ...currentCluster, selectedBlogs: selected.filter(id => id !== blogId) });
        } else {
            setCurrentCluster({ ...currentCluster, selectedBlogs: [...selected, blogId] });
        }
    };

    const handleWikiToggle = (wikiId) => {
        const selected = currentCluster.selectedWikiArticles || [];
        if (selected.includes(wikiId)) {
            setCurrentCluster({ ...currentCluster, selectedWikiArticles: selected.filter(id => id !== wikiId) });
        } else {
            setCurrentCluster({ ...currentCluster, selectedWikiArticles: [...selected, wikiId] });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            name: currentCluster.name,
            description: currentCluster.description,
            tag_ids: currentCluster.selectedTags,
            blog_ids: currentCluster.selectedBlogs,
            wiki_article_ids: currentCluster.selectedWikiArticles,
        };

        try {
            if (currentCluster.id) {
                await clusterService.update(currentCluster.id, payload);
            } else {
                await clusterService.create(payload);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("Failed to save cluster", error);
            const apiErrors = error.response?.data;
            if (apiErrors && typeof apiErrors === 'object') {
                const firstMessage = Object.values(apiErrors).flat().find(Boolean);
                alert(firstMessage || "Failed to save cluster. Please check the fields.");
            } else {
                alert("Failed to save cluster. Please check the fields.");
            }
        }
    };

    const ensureSavedWikiArticle = async (wikiItem) => {
        const title = wikiItem?.title;
        if (!title) return null;

        const existing = savedWiki.find((item) => item.title.toLowerCase() === title.toLowerCase());
        if (existing) return existing;

        try {
            const saveRes = await wikiLibraryService.save({
                title,
                extract: wikiItem.extract || '',
                thumbnail: wikiItem.thumbnail || '',
                original_url: wikiItem.page_url || wikiItem.original_url || '',
                html_content: wikiItem.html_content || '',
                board_column: 'Inbox'
            });
            const created = saveRes.data;
            setSavedWiki((prev) => [...prev, created]);
            return created;
        } catch {
            const refreshed = await wikiLibraryService.getAll();
            const items = Array.isArray(refreshed.data) ? refreshed.data : [];
            setSavedWiki(items);
            return items.find((item) => item.title.toLowerCase() === title.toLowerCase()) || null;
        }
    };

    const handleDropOnCluster = async (clusterId) => {
        if (!draggedItem) return;
        const targetCluster = clusters.find((cluster) => cluster.id === clusterId);
        if (!targetCluster) return;

        const existingBlogIds = (targetCluster.blogs || []).map((item) => item.id);
        const existingWikiIds = (targetCluster.wiki_articles || []).map((item) => item.id);

        if (draggedItem.type === 'blog') {
            const blogId = draggedItem.item?.id;
            if (!blogId || existingBlogIds.includes(blogId)) {
                setDraggedItem(null);
                return;
            }

            const payload = {
                name: targetCluster.name,
                description: targetCluster.description,
                tag_ids: (targetCluster.tags || []).map((tag) => tag.id),
                blog_ids: [...existingBlogIds, blogId],
                wiki_article_ids: existingWikiIds,
            };

            try {
                await clusterService.update(targetCluster.id, payload);
                await fetchData();
                setDraggedItem(null);
            } catch (error) {
                console.error('Failed to assign blog to cluster', error);
                alert('Failed to add this blog to cluster.');
            }
            return;
        }

        let savedArticle = null;
        if (draggedItem.type === 'saved') {
            savedArticle = draggedItem.item;
        } else {
            savedArticle = await ensureSavedWikiArticle(draggedItem.item);
        }

        if (!savedArticle) {
            alert('Could not resolve dropped wiki article.');
            return;
        }

        if (existingWikiIds.includes(savedArticle.id)) {
            setDraggedItem(null);
            return;
        }

        const payload = {
            name: targetCluster.name,
            description: targetCluster.description,
            tag_ids: (targetCluster.tags || []).map((tag) => tag.id),
            blog_ids: existingBlogIds,
            wiki_article_ids: [...existingWikiIds, savedArticle.id],
        };

        try {
            await clusterService.update(targetCluster.id, payload);
            await fetchData();
            setDraggedItem(null);
        } catch (error) {
            console.error('Failed to assign wiki article to cluster', error);
            alert('Failed to add this wiki article to cluster.');
        }
    };

    const sendClusterChat = async (event) => {
        event.preventDefault();
        if (!selectedClusterId || !chatInput.trim()) return;

        const message = chatInput.trim();
        setChatHistory((prev) => [...prev, { role: 'user', text: message }]);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await clusterService.chat(selectedClusterId, { message });
            setChatHistory((prev) => [...prev, { role: 'assistant', text: res.data?.answer || 'No response.' }]);
        } catch (error) {
            console.error('Cluster chat failed', error);
            setChatHistory((prev) => [...prev, { role: 'assistant', text: 'Chatbot failed. Please check API key/server config.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    const createBlogFromCluster = async () => {
        if (!selectedClusterId) {
            alert('Select a cluster first.');
            return;
        }

        setDraftLoading(true);
        try {
            const res = await clusterService.createBlogDraft(selectedClusterId, {
                title: draftTitle,
                prompt: chatInput,
            });
            const createdSlug = res.data?.slug;
            alert('Cluster blog draft created successfully.');
            if (createdSlug) {
                navigate(`/post/${createdSlug}`);
            } else {
                navigate('/dashboard/posts');
            }
        } catch (error) {
            console.error('Failed to create cluster draft', error);
            alert('Failed to create draft from cluster.');
        } finally {
            setDraftLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this cluster?')) {
            try {
                await clusterService.delete(id);
                fetchData();
            } catch (error) {
                console.error("Failed to delete cluster", error);
            }
        }
    };

    const openEditModal = (cluster) => {
        setCurrentCluster({ 
            ...cluster, 
            selectedTags: cluster.tags?.map(t => t.id) || [],
            selectedBlogs: cluster.blogs?.map(b => b.id) || [],
            selectedWikiArticles: cluster.wiki_articles?.map(w => w.id) || []
        });
        setShowModal(true);
    };

    const openAddModal = () => {
        setCurrentCluster({ id: null, name: '', description: '', selectedTags: [], selectedBlogs: [], selectedWikiArticles: [] });
        setShowModal(true);
    };

    if (loading) return <div className="p-8 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Scanning Clusters...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-8 border-b-4 border-canvas-dark pb-4">
                <h2 className="text-4xl font-display font-black text-canvas-dark uppercase tracking-tighter flex items-center gap-4">
                    <FolderTree className="text-canvas-coral" size={32} strokeWidth={3} />
                    Knowledge Clusters
                </h2>
                <button onClick={openAddModal} className="flex items-center space-x-2 bg-canvas-dark hover:bg-canvas-coral text-white px-6 py-3 font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                    <Plus size={18} />
                    <span>New Cluster</span>
                </button>
            </div>

            <div className="bg-white brutal-border border-4 border-canvas-dark p-6 mb-8">
                <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                    <h3 className="text-sm font-display font-black uppercase tracking-widest text-canvas-dark">Wikipedia Explorer (Drag into Clusters)</h3>
                    <form
                        className="flex items-center gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            searchWikipedia();
                        }}
                    >
                        <Search size={14} className="text-canvas-coral" />
                        <input
                            value={wikiQuery}
                            onChange={(event) => setWikiQuery(event.target.value)}
                            placeholder="Search Wikipedia"
                            className="px-3 py-2 bg-canvas-light brutal-border border-2 border-canvas-dark text-xs font-bold uppercase tracking-widest focus:outline-none"
                        />
                        <button type="submit" className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors">Search</button>
                    </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wikiResults.map((item) => (
                        <article
                            key={item.title}
                            draggable
                            onDragStart={() => setDraggedItem({ type: 'search', item })}
                            className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark"
                        >
                            <h4 className="font-display font-black uppercase text-sm text-canvas-dark line-clamp-2 mb-2">{item.title}</h4>
                            <p className="text-xs font-medium text-gray-600 line-clamp-3 mb-3">{item.extract || 'No summary available.'}</p>
                            <div className="flex items-center justify-between">
                                <Link to={`/wiki/${encodeURIComponent(item.title)}`} className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors">Open</Link>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Drag to Cluster</span>
                            </div>
                        </article>
                    ))}
                    {!wikiLoading && wikiResults.length === 0 && (
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 border-2 border-dashed border-gray-300 p-6 text-center md:col-span-2 lg:col-span-3">No Wikipedia results found.</p>
                    )}
                </div>
                {wikiLoading && <p className="text-xs font-bold uppercase tracking-widest text-canvas-coral mt-4">Searching Wikipedia...</p>}
            </div>

            <div className="bg-white brutal-border border-4 border-canvas-dark p-6 mb-8">
                <h3 className="text-sm font-display font-black uppercase tracking-widest text-canvas-dark mb-4">Your Blog Artifacts (Drag into Clusters)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userBlogs.map((blog) => (
                        <article
                            key={blog.id}
                            draggable
                            onDragStart={() => setDraggedItem({ type: 'blog', item: blog })}
                            className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark"
                        >
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{blog.category?.category_name || 'Uncategorized'}</div>
                            <h4 className="font-display font-black uppercase text-sm text-canvas-dark line-clamp-2 mb-2">{blog.title}</h4>
                            <p className="text-xs font-medium text-gray-600 line-clamp-2">{blog.short_description || 'No summary available.'}</p>
                        </article>
                    ))}
                    {userBlogs.length === 0 && (
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 border-2 border-dashed border-gray-300 p-6 text-center md:col-span-2 lg:col-span-3">No authored artifacts available.</p>
                    )}
                </div>
            </div>

            <div className="grid gap-6">
                {clusters.map((cluster) => (
                    <div
                        key={cluster.id}
                        className="bg-white brutal-border border-4 border-canvas-dark p-8 shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={async () => handleDropOnCluster(cluster.id)}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-3xl font-display font-black text-canvas-dark uppercase">{cluster.name}</h3>
                                <p className="text-sm font-medium text-gray-600 mt-2 max-w-2xl">{cluster.description}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mt-2">Drop blog or Wikipedia cards here to attach references.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => openEditModal(cluster)} className="p-2 text-canvas-dark hover:text-canvas-coral hover:bg-canvas-light brutal-border border-2 border-canvas-dark transition-colors">
                                    <Pencil size={18} />
                                </button>
                                <button onClick={() => handleDelete(cluster.id)} className="p-2 text-white bg-canvas-dark hover:bg-red-600 brutal-border border-2 border-canvas-dark transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {cluster.tags?.map(tag => (
                                <span key={tag.id} className="px-3 py-1 bg-canvas-light text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark">
                                    #{tag.name}
                                </span>
                            ))}
                        </div>

                        <div className="border-t-2 border-canvas-dark pt-6 mt-6">
                            <h4 className="text-xs font-black font-display uppercase tracking-widest text-canvas-coral mb-4">Included Artifacts ({cluster.blogs?.length})</h4>
                            {cluster.blogs?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {cluster.blogs.map(blog => (
                                        <Link
                                            key={blog.id}
                                            to={`/post/${blog.slug}`}
                                            draggable
                                            onDragStart={() => setDraggedItem({ type: 'blog', item: blog })}
                                            className="block p-4 bg-canvas-light brutal-border border-2 border-canvas-dark hover:bg-canvas-dark hover:text-white transition-colors group"
                                        >
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 mb-2">{blog.category?.category_name}</div>
                                            <div className="font-display font-black uppercase text-sm leading-tight line-clamp-2">{blog.title}</div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm font-medium text-gray-500 italic">No artifacts assigned to this cluster.</p>
                            )}
                        </div>

                        <div className="border-t-2 border-canvas-dark pt-6 mt-6">
                            <h4 className="text-xs font-black font-display uppercase tracking-widest text-canvas-coral mb-4">Wikipedia References ({cluster.wiki_articles?.length || 0})</h4>
                            {cluster.wiki_articles?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {cluster.wiki_articles.map((article) => (
                                        <article
                                            key={article.id}
                                            draggable
                                            onDragStart={() => setDraggedItem({ type: 'saved', item: article })}
                                            className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark"
                                        >
                                            <div className="font-display font-black uppercase text-sm leading-tight line-clamp-2 text-canvas-dark mb-2">{article.title}</div>
                                            <p className="text-xs font-medium text-gray-600 line-clamp-3 mb-3">{article.extract || 'No summary available.'}</p>
                                            <div className="flex items-center gap-2">
                                                <Link to={`/wiki/${encodeURIComponent(article.title)}`} className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors">Open</Link>
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${article.liked ? 'text-canvas-coral' : 'text-gray-500'}`}>{article.liked ? 'Liked' : 'Saved'}</span>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm font-medium text-gray-500 italic">No wiki references assigned yet. Drag from explorer above.</p>
                            )}
                        </div>
                    </div>
                ))}
                {clusters.length === 0 && (
                    <div className="text-center py-20 brutal-border border-4 bg-canvas-light shadow-[12px_12px_0px_0px_rgba(224,106,89,1)]">
                        <p className="font-display font-black text-2xl uppercase tracking-[0.2em] text-gray-400">Zero Clusters Established.</p>
                    </div>
                )}
            </div>

            <section className="mt-8 bg-white brutal-border border-4 border-canvas-dark p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Bot size={18} className="text-canvas-coral" />
                    <h3 className="text-sm font-display font-black uppercase tracking-widest text-canvas-dark">Cluster AI Workspace</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Select Cluster</label>
                        <select
                            value={selectedClusterId}
                            onChange={(event) => setSelectedClusterId(event.target.value)}
                            className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark text-xs font-bold uppercase tracking-widest"
                        >
                            <option value="">Choose cluster</option>
                            {clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}
                        </select>

                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mt-4 mb-2">Chat Prompt</label>
                        <form onSubmit={sendClusterChat} className="space-y-3">
                            <textarea
                                rows="5"
                                value={chatInput}
                                onChange={(event) => setChatInput(event.target.value)}
                                placeholder="Ask AI using this cluster's blogs and dropped wiki references..."
                                className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark focus:outline-none"
                            />
                            <button type="submit" disabled={chatLoading || !selectedClusterId} className="px-5 py-3 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50">
                                {chatLoading ? 'Thinking...' : 'Chat with Cluster Bot'}
                            </button>
                        </form>
                    </div>

                    <div>
                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Create Blog from Cluster</label>
                        <input
                            type="text"
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                            placeholder="Draft title (optional)"
                            className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark focus:outline-none mb-3"
                        />
                        <button onClick={createBlogFromCluster} disabled={draftLoading || !selectedClusterId} className="flex items-center gap-2 px-5 py-3 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50">
                            <FilePlus2 size={14} />
                            {draftLoading ? 'Creating Draft...' : 'Create Blog Draft from Cluster'}
                        </button>

                        <div className="mt-4 max-h-64 overflow-y-auto p-4 bg-canvas-light brutal-border border-2 border-canvas-dark space-y-3">
                            {chatHistory.length === 0 && <p className="text-xs font-bold uppercase tracking-widest text-gray-400">No chat yet.</p>}
                            {chatHistory.map((item, index) => (
                                <div key={`${item.role}-${index}`} className={`p-3 brutal-border border ${item.role === 'assistant' ? 'bg-white border-canvas-dark' : 'bg-canvas-dark text-white border-canvas-dark'}`}>
                                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1">{item.role === 'assistant' ? 'Bot' : 'You'}</div>
                                    <p className="text-xs whitespace-pre-wrap">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Editor Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-canvas-light brutal-border border-4 border-canvas-dark w-full max-w-3xl max-h-[90vh] overflow-y-auto relative shadow-[16px_16px_0px_0px_rgba(224,106,89,1)]">
                        <div className="sticky top-0 bg-white border-b-4 border-canvas-dark p-6 flex justify-between items-center z-10">
                            <h3 className="text-3xl font-display font-black text-canvas-dark uppercase tracking-tighter">{currentCluster.id ? 'Edit Cluster' : 'Initialize Cluster'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-canvas-dark hover:text-canvas-coral"><X size={32} /></button>
                        </div>
                        
                        <div className="p-8">
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Cluster Name</label>
                                    <input type="text" required className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium uppercase" value={currentCluster.name} onChange={(e) => setCurrentCluster({ ...currentCluster, name: e.target.value })} placeholder="E.G. MACHINE LEARNING BASICS" />
                                </div>

                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Description</label>
                                    <textarea required rows="3" className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={currentCluster.description} onChange={(e) => setCurrentCluster({ ...currentCluster, description: e.target.value })} placeholder="Brief overview of this knowledge cluster..." />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Global Tags</label>
                                    <div className="flex flex-wrap gap-2 p-4 bg-white brutal-border border-2 border-canvas-dark">
                                        {tagsList.map(tag => (
                                            <button 
                                                key={tag.id} 
                                                type="button"
                                                onClick={() => handleTagToggle(tag.id)}
                                                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest brutal-border border ${currentCluster.selectedTags?.includes(tag.id) ? 'bg-canvas-dark text-white border-canvas-dark' : 'bg-canvas-light text-gray-500 border-gray-300 hover:border-canvas-dark'}`}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-coral mb-2 border-t-2 border-canvas-dark pt-6 mt-6">Select Artifacts for Cluster</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-64 overflow-y-auto p-4 bg-white brutal-border border-2 border-canvas-dark">
                                        {userBlogs.map(blog => (
                                            <label key={blog.id} className={`flex items-start gap-3 p-3 brutal-border border cursor-pointer transition-colors ${currentCluster.selectedBlogs?.includes(blog.id) ? 'bg-canvas-dark text-white border-canvas-dark' : 'bg-canvas-light text-canvas-dark border-gray-300 hover:border-canvas-dark'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    className="mt-1"
                                                    checked={currentCluster.selectedBlogs?.includes(blog.id)}
                                                    onChange={() => handleBlogToggle(blog.id)}
                                                />
                                                <div>
                                                    <div className="text-xs font-display font-black uppercase leading-tight line-clamp-2">{blog.title}</div>
                                                    <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${currentCluster.selectedBlogs?.includes(blog.id) ? 'text-gray-300' : 'text-gray-500'}`}>{blog.status} &bull; {blog.difficulty_level}</div>
                                                </div>
                                            </label>
                                        ))}
                                        {userBlogs.length === 0 && <p className="text-xs font-bold uppercase tracking-widest text-gray-400 col-span-2">No authored artifacts available.</p>}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-coral mb-2 border-t-2 border-canvas-dark pt-6 mt-6">Select Saved Wikipedia References</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-64 overflow-y-auto p-4 bg-white brutal-border border-2 border-canvas-dark">
                                        {savedWiki.map(article => (
                                            <label key={article.id} className={`flex items-start gap-3 p-3 brutal-border border cursor-pointer transition-colors ${currentCluster.selectedWikiArticles?.includes(article.id) ? 'bg-canvas-dark text-white border-canvas-dark' : 'bg-canvas-light text-canvas-dark border-gray-300 hover:border-canvas-dark'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="mt-1"
                                                    checked={currentCluster.selectedWikiArticles?.includes(article.id)}
                                                    onChange={() => handleWikiToggle(article.id)}
                                                />
                                                <div>
                                                    <div className="text-xs font-display font-black uppercase leading-tight line-clamp-2">{article.title}</div>
                                                    <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${currentCluster.selectedWikiArticles?.includes(article.id) ? 'text-gray-300' : 'text-gray-500'}`}>{article.liked ? 'Liked' : 'Saved'}</div>
                                                </div>
                                            </label>
                                        ))}
                                        {savedWiki.length === 0 && <p className="text-xs font-bold uppercase tracking-widest text-gray-400 col-span-2">No saved wiki references yet.</p>}
                                    </div>
                                </div>

                                <div className="pt-8 flex justify-end space-x-4 border-t-4 border-canvas-dark">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-8 py-4 bg-white text-canvas-dark font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors">Cancel</button>
                                    <button type="submit" className="px-10 py-4 bg-canvas-coral text-white font-display font-black uppercase text-xs tracking-[0.2em] brutal-border border-2 border-canvas-dark shadow-[6px_6px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                                        {currentCluster.id ? 'UPDATE CLUSTER' : 'INITIALIZE CLUSTER'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
