import { useState, useEffect } from 'react';
import { blogService, dashboardService } from '../services/api';
import { Pencil, Trash2, Plus, X, Sparkles, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFullImageUrl } from '../utils/helpers';

export default function DashboardPosts() {
    const [posts, setPosts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tagsList, setTagsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // AI Assistant State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState('');

    // Form State
    const [currentPost, setCurrentPost] = useState({
        id: null, title: '', subtitle: '', category_id: '', short_description: '', blog_body: '', status: 'Draft', 
        is_featured: false, visibility: 'Public', allow_comments: true, allow_likes: true, citation: '',
        difficulty_level: 'Beginner', source_type: 'User Generated', source_url: '', reference_links: '',
        is_ai_reference: false, topic_category: '', reference_priority: 0, scheduled_publish_at: '', selectedTags: []
    });
    const [customCategoryName, setCustomCategoryName] = useState('');
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [postsRes, catsRes, tagsRes] = await Promise.all([
                dashboardService.getPosts(),
                dashboardService.getCategories(),
                blogService.getTags()
            ]);
            setPosts(postsRes.data);
            setCategories(catsRes.data);
            setTagsList(tagsRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        setImageFile(e.target.files[0]);
    };

    const handleTagToggle = (tagId) => {
        const selected = currentPost.selectedTags || [];
        if (selected.includes(tagId)) {
            setCurrentPost({ ...currentPost, selectedTags: selected.filter(id => id !== tagId) });
        } else {
            setCurrentPost({ ...currentPost, selectedTags: [...selected, tagId] });
        }
    };

    const handleAiAssist = async (action) => {
        setIsAiLoading(true);
        try {
            const selectedCategory = currentPost.category_id === '__custom__'
                ? customCategoryName
                : categories.find(c => c.id.toString() === currentPost.category_id.toString())?.category_name;
            const res = await blogService.aiWrite({
                action,
                content: currentPost.blog_body || currentPost.short_description,
                title: currentPost.title,
                category: selectedCategory
            });
            setAiResult(res.data.result);
        } catch {
            alert("AI Assistant failed. Check your API key.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const applyAiResult = (field) => {
        setCurrentPost({ ...currentPost, [field]: aiResult });
        setAiResult('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        let resolvedCategoryId = currentPost.category_id;

        if (currentPost.category_id === '__custom__') {
            const normalizedCustomName = customCategoryName.trim();

            if (!normalizedCustomName) {
                alert('Please enter a custom category name.');
                return;
            }

            const existingCategory = categories.find(
                (category) => category.category_name.toLowerCase() === normalizedCustomName.toLowerCase()
            );

            if (existingCategory) {
                resolvedCategoryId = existingCategory.id;
            } else {
                try {
                    const createResponse = await dashboardService.createCategory({ category_name: normalizedCustomName });
                    const createdCategory = createResponse.data;
                    resolvedCategoryId = createdCategory.id;
                    setCategories((previous) => [...previous, createdCategory]);
                } catch (error) {
                    const refreshedCategories = (await dashboardService.getCategories()).data;
                    setCategories(refreshedCategories);
                    const matchedCategory = refreshedCategories.find(
                        (category) => category.category_name.toLowerCase() === normalizedCustomName.toLowerCase()
                    );

                    if (matchedCategory) {
                        resolvedCategoryId = matchedCategory.id;
                    } else {
                        console.error('Failed to create custom category', error);
                        alert('Failed to create custom category. Please try again.');
                        return;
                    }
                }
            }
        }

        if (!resolvedCategoryId) {
            alert('Please select a category before saving.');
            return;
        }

        const formData = new FormData();
        formData.append('title', currentPost.title);
        formData.append('subtitle', currentPost.subtitle || '');
        formData.append('category_id', resolvedCategoryId);
        formData.append('short_description', currentPost.short_description);
        formData.append('blog_body', currentPost.blog_body);
        formData.append('status', currentPost.status);
        formData.append('is_featured', currentPost.is_featured);
        
        formData.append('visibility', currentPost.visibility);
        formData.append('allow_comments', currentPost.allow_comments);
        formData.append('allow_likes', currentPost.allow_likes);
        formData.append('citation', currentPost.citation || '');

        formData.append('difficulty_level', currentPost.difficulty_level);
        formData.append('source_type', currentPost.source_type);
        formData.append('source_url', currentPost.source_url || '');
        formData.append('reference_links', currentPost.reference_links || '');
        formData.append('is_ai_reference', currentPost.is_ai_reference);
        formData.append('topic_category', currentPost.topic_category || '');
        
        // Tags need to be handled carefully with FormData
        (currentPost.selectedTags || []).forEach(tagId => formData.append('tag_ids', tagId));

        if (currentPost.scheduled_publish_at) {
            formData.append('scheduled_publish_at', currentPost.scheduled_publish_at);
        }
        formData.append('reference_priority', currentPost.reference_priority || 0);

        if (imageFile) {
            formData.append('featured_image', imageFile);
        } else if (!currentPost.id && currentPost.status === 'Published') {
            alert("An image is required for new published posts.");
            return;
        } else if (currentPost.status === 'Published' && !imageFile && !currentPost.featured_image) {
            alert("Please upload an image before publishing this post.");
            return;
        }

        try {
            if (currentPost.id) {
                await dashboardService.updatePost(currentPost.slug, formData);
            } else {
                await dashboardService.createPost(formData);
            }
            setShowModal(false);
            setImageFile(null);
            setCustomCategoryName('');
            fetchData();
        } catch (error) {
            console.error("Failed to save post", error);
            const apiErrors = error.response?.data;
            if (apiErrors && typeof apiErrors === 'object') {
                const firstMessage = Object.values(apiErrors).flat().find(Boolean);
                if (firstMessage) {
                    alert(`Failed to save post: ${firstMessage}`);
                    return;
                }
            }
            alert("Failed to save post. Please check the fields.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            try {
                await dashboardService.deletePost(id);
                fetchData();
            } catch (error) {
                console.error("Failed to delete post", error);
            }
        }
    };

    const openEditModal = (post) => {
        setCurrentPost({ 
            ...post, 
            subtitle: post.subtitle || '',
            visibility: post.visibility || 'Public',
            allow_comments: post.allow_comments ?? true,
            allow_likes: post.allow_likes ?? true,
            citation: post.citation || '',
            reference_priority: post.reference_priority ?? 0,
            scheduled_publish_at: post.scheduled_publish_at ? post.scheduled_publish_at.slice(0, 16) : '',
            category_id: post.category?.id || '',
            selectedTags: post.tags?.map(t => t.id) || []
        });
        setCustomCategoryName('');
        setImageFile(null);
        setShowModal(true);
    };

    const openAddModal = () => {
        setCurrentPost({ 
            id: null, title: '', subtitle: '', category_id: categories[0]?.id || '', short_description: '', blog_body: '', status: 'Draft', 
            is_featured: false, visibility: 'Public', allow_comments: true, allow_likes: true, citation: '',
            difficulty_level: 'Beginner', source_type: 'User Generated', source_url: '', reference_links: '',
            is_ai_reference: false, topic_category: '', reference_priority: 0, scheduled_publish_at: '', selectedTags: []
        });
        setCustomCategoryName('');
        setImageFile(null);
        setShowModal(true);
    };

    if (loading) return <div className="p-8 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Loading Workspace...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-8 border-b-4 border-canvas-dark pb-4">
                <h2 className="text-4xl font-display font-black text-canvas-dark uppercase tracking-tighter">My Knowledge Base</h2>
                <button onClick={openAddModal} className="flex items-center space-x-2 bg-canvas-dark hover:bg-canvas-coral text-white px-6 py-3 font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                    <Plus size={18} />
                    <span>Create Entry</span>
                </button>
            </div>

            <div className="grid gap-6">
                {posts.map((post) => (
                    <div key={post.id} className="bg-white brutal-border border-2 border-canvas-dark p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                        <div className="flex items-center gap-6 flex-1">
                            {post.featured_image ? (
                                <img src={getFullImageUrl(post.featured_image)} alt={post.title} className="w-24 h-24 object-cover brutal-border border-2 border-canvas-dark grayscale hover:grayscale-0 transition-all" />
                            ) : (
                                <div className="w-24 h-24 brutal-border border-2 border-canvas-dark bg-canvas-light flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-gray-500 text-center p-2">
                                    No Image
                                </div>
                            )}
                            <div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 brutal-border border border-canvas-dark ${post.status === 'Published' ? 'bg-canvas-coral text-white' : 'bg-gray-200 text-canvas-dark'}`}>
                                    {post.status}
                                </span>
                                {post.is_ai_reference && <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-purple-600 text-white brutal-border border border-canvas-dark">AI Ref</span>}
                                <h3 className="text-2xl font-display font-black text-canvas-dark mt-2 uppercase">{post.title}</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">
                                    {post.category?.category_name} &bull; {post.difficulty_level} &bull; {new Date(post.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link to={`/post/${post.slug}`} className="px-4 py-2 bg-canvas-light text-canvas-dark brutal-border border border-canvas-dark text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-dark hover:text-white transition-colors">
                                View
                            </Link>
                            <button onClick={() => openEditModal(post)} className="p-2 text-canvas-dark hover:text-canvas-coral hover:bg-canvas-light brutal-border border border-canvas-dark transition-colors">
                                <Pencil size={18} />
                            </button>
                            <button onClick={() => handleDelete(post.slug)} className="p-2 text-white bg-canvas-dark hover:bg-red-600 brutal-border border border-canvas-dark transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
                {posts.length === 0 && <p className="text-gray-500 text-center py-12 font-display font-bold uppercase tracking-widest">No knowledge entries found. Begin compiling.</p>}
            </div>

            {/* Editor Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-canvas-light brutal-border border-4 border-canvas-dark w-full max-w-4xl max-h-[90vh] overflow-y-auto relative shadow-[16px_16px_0px_0px_rgba(224,106,89,1)]">
                        <div className="sticky top-0 bg-white border-b-4 border-canvas-dark p-6 flex justify-between items-center z-10">
                            <h3 className="text-3xl font-display font-black text-canvas-dark uppercase tracking-tighter">{currentPost.id ? 'Edit Entry' : 'Compile Knowledge'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-canvas-dark hover:text-canvas-coral"><X size={32} /></button>
                        </div>
                        
                        <div className="p-8">
                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* AI Assistant Tools */}
                                <div className="bg-canvas-dark text-white p-6 brutal-border border-2 border-canvas-dark relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Sparkles size={120} />
                                    </div>
                                    <h4 className="flex items-center text-sm font-display font-black uppercase tracking-widest mb-4">
                                        <Wand2 size={16} className="text-canvas-coral mr-2" />
                                        Nexus Assistant
                                    </h4>
                                    <div className="flex flex-wrap gap-3">
                                        <button type="button" onClick={() => handleAiAssist('generate_titles')} className="px-4 py-2 bg-transparent text-white brutal-border border border-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral hover:border-canvas-coral transition-colors">Generate Titles</button>
                                        <button type="button" onClick={() => handleAiAssist('improve_text')} className="px-4 py-2 bg-transparent text-white brutal-border border border-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral hover:border-canvas-coral transition-colors">Polish Body</button>
                                        <button type="button" onClick={() => handleAiAssist('generate_outline')} className="px-4 py-2 bg-transparent text-white brutal-border border border-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral hover:border-canvas-coral transition-colors">Structure Outline</button>
                                        <button type="button" onClick={() => handleAiAssist('seo_description')} className="px-4 py-2 bg-transparent text-white brutal-border border border-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral hover:border-canvas-coral transition-colors">SEO Meta</button>
                                    </div>

                                    {isAiLoading && <div className="mt-6 text-xs font-bold uppercase tracking-widest text-canvas-coral animate-pulse border-l-4 border-canvas-coral pl-4">Synthesizing...</div>}

                                    {aiResult && (
                                        <div className="mt-6 p-6 bg-white text-canvas-dark brutal-border border-2 border-canvas-dark">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mb-4 flex justify-between border-b-2 border-canvas-dark pb-2">
                                                <span>Generated Artifact</span>
                                                <button type="button" onClick={() => setAiResult('')} className="text-red-500 hover:text-red-700">Discard</button>
                                            </div>
                                            <div className="text-sm font-medium max-h-40 overflow-y-auto mb-6 whitespace-pre-wrap leading-relaxed">{aiResult}</div>
                                            <div className="flex gap-3">
                                                <button type="button" onClick={() => applyAiResult('title')} className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors">Apply {"->"} Title</button>
                                                <button type="button" onClick={() => applyAiResult('blog_body')} className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors">Apply {"->"} Body</button>
                                                <button type="button" onClick={() => applyAiResult('short_description')} className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors">Apply {"->"} Desc</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Title</label>
                                        <input type="text" required className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={currentPost.title} onChange={(e) => setCurrentPost({ ...currentPost, title: e.target.value })} placeholder="ENTER TITLE" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Subtitle</label>
                                        <input type="text" className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={currentPost.subtitle} onChange={(e) => setCurrentPost({ ...currentPost, subtitle: e.target.value })} placeholder="ENTER SUBTITLE" />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Category</label>
                                        <select required className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium uppercase text-xs" value={currentPost.category_id} onChange={(e) => setCurrentPost({ ...currentPost, category_id: e.target.value })}>
                                            <option value="">SELECT A CATEGORY</option>
                                            <option value="__custom__">CUSTOM CATEGORY...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                                        </select>
                                        {currentPost.category_id === '__custom__' && (
                                            <input
                                                type="text"
                                                required
                                                className="mt-3 w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium"
                                                value={customCategoryName}
                                                onChange={(e) => setCustomCategoryName(e.target.value)}
                                                placeholder="ENTER CUSTOM CATEGORY"
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Featured Image</label>
                                        <div className="flex items-center gap-4">
                                            {currentPost.id && typeof currentPost.featured_image === 'string' && (
                                                <img src={getFullImageUrl(currentPost.featured_image)} className="w-20 h-20 object-cover brutal-border border-2 border-canvas-dark grayscale" alt="Current" />
                                            )}
                                            <input type="file" accept="image/*" onChange={handleFileChange} className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark text-sm file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-canvas-dark file:text-white hover:file:bg-canvas-coral" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 bg-white brutal-border border-2 border-canvas-dark">
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Difficulty</label>
                                        <select className="w-full px-4 py-2 bg-canvas-light brutal-border border border-canvas-dark text-xs uppercase font-bold" value={currentPost.difficulty_level} onChange={(e) => setCurrentPost({ ...currentPost, difficulty_level: e.target.value })}>
                                            <option value="Beginner">Beginner</option>
                                            <option value="Intermediate">Intermediate</option>
                                            <option value="Advanced">Advanced</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Source Type</label>
                                        <select className="w-full px-4 py-2 bg-canvas-light brutal-border border border-canvas-dark text-xs uppercase font-bold" value={currentPost.source_type} onChange={(e) => setCurrentPost({ ...currentPost, source_type: e.target.value })}>
                                            <option value="User Generated">Original Content</option>
                                            <option value="Wikipedia">Wikipedia</option>
                                            <option value="External Article">External Article</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Source URL (If external)</label>
                                        <input type="url" className="w-full px-4 py-2 bg-canvas-light brutal-border border border-canvas-dark text-xs font-medium" value={currentPost.source_url || ''} onChange={(e) => setCurrentPost({ ...currentPost, source_url: e.target.value })} placeholder="https://..." />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Tags</label>
                                    <div className="flex flex-wrap gap-2 p-4 bg-white brutal-border border-2 border-canvas-dark">
                                        {tagsList.map(tag => (
                                            <button 
                                                key={tag.id} 
                                                type="button"
                                                onClick={() => handleTagToggle(tag.id)}
                                                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest brutal-border border ${currentPost.selectedTags?.includes(tag.id) ? 'bg-canvas-dark text-white border-canvas-dark' : 'bg-canvas-light text-gray-500 border-gray-300 hover:border-canvas-dark'}`}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Short Description</label>
                                    <textarea required rows="2" className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={currentPost.short_description} onChange={(e) => setCurrentPost({ ...currentPost, short_description: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Blog Body (Markdown Supported)</label>
                                    <textarea required rows="12" className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-mono text-sm leading-relaxed" value={currentPost.blog_body} onChange={(e) => setCurrentPost({ ...currentPost, blog_body: e.target.value })} />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Reference Links (Markdown/CSV)</label>
                                    <textarea rows="3" className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-mono text-xs" placeholder="- [GitHub Repo](https://...)" value={currentPost.reference_links || ''} onChange={(e) => setCurrentPost({ ...currentPost, reference_links: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-white brutal-border border-2 border-canvas-dark">
                                    <div>
                                        <label className="block text-[10px] font-display font-black uppercase tracking-widest text-canvas-dark mb-4 border-b-2 border-canvas-dark pb-2">Engagement & Visibility</label>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2">Visibility Level</label>
                                                <select className="w-full px-4 py-2 bg-canvas-light brutal-border border border-canvas-dark text-xs uppercase font-bold" value={currentPost.visibility} onChange={(e) => setCurrentPost({ ...currentPost, visibility: e.target.value })}>
                                                    <option value="Public">Public Access</option>
                                                    <option value="Unlisted">Unlisted Link</option>
                                                    <option value="Private">Private Vault</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" className="w-5 h-5 text-canvas-coral bg-transparent border-canvas-dark rounded-none focus:ring-canvas-coral" checked={currentPost.allow_comments} onChange={(e) => setCurrentPost({ ...currentPost, allow_comments: e.target.checked })} />
                                                    <span className="text-xs font-bold uppercase tracking-widest">Enable Interaction (Comments)</span>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" className="w-5 h-5 text-canvas-coral bg-transparent border-canvas-dark rounded-none focus:ring-canvas-coral" checked={currentPost.allow_likes} onChange={(e) => setCurrentPost({ ...currentPost, allow_likes: e.target.checked })} />
                                                    <span className="text-xs font-bold uppercase tracking-widest">Enable Endorsements (Likes)</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-display font-black uppercase tracking-widest text-canvas-dark mb-4 border-b-2 border-canvas-dark pb-2">Intellectual Property</label>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2">Citation / Source Attribution</label>
                                        <textarea rows="4" className="w-full px-4 py-3 bg-canvas-light brutal-border border border-canvas-dark focus:outline-none focus:border-canvas-coral font-mono text-xs" placeholder="ORIGINAL WORK / CITE SOURCES" value={currentPost.citation || ''} onChange={(e) => setCurrentPost({ ...currentPost, citation: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-canvas-dark text-white brutal-border border-2 border-canvas-dark">
                                    <div>
                                        <label className="block text-[10px] font-display font-black uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-700 pb-2">Publishing Status</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input type="radio" name="status" value="Draft" checked={currentPost.status === 'Draft'} onChange={(e) => setCurrentPost({ ...currentPost, status: e.target.value })} className="w-4 h-4 text-canvas-coral bg-transparent border-white focus:ring-canvas-coral" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Draft</span>
                                            </label>
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input type="radio" name="status" value="Published" checked={currentPost.status === 'Published'} onChange={(e) => setCurrentPost({ ...currentPost, status: e.target.value })} className="w-4 h-4 text-canvas-coral bg-transparent border-white focus:ring-canvas-coral" />
                                                <span className="text-xs font-bold uppercase tracking-widest text-canvas-coral">Publish</span>
                                            </label>
                                        </div>
                                        <label className="flex items-center mt-6 space-x-3 cursor-pointer">
                                            <input type="checkbox" className="w-5 h-5 text-canvas-coral bg-transparent border-white rounded-none focus:ring-canvas-coral" checked={currentPost.is_featured} onChange={(e) => setCurrentPost({ ...currentPost, is_featured: e.target.checked })} />
                                            <span className="text-xs font-bold uppercase tracking-widest">Featured Post</span>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-display font-black uppercase tracking-widest text-purple-400 mb-4 border-b border-gray-700 pb-2">AI Knowledge Graph</label>
                                        <label className="flex items-center space-x-3 cursor-pointer mb-4">
                                            <input type="checkbox" className="w-5 h-5 text-purple-600 bg-transparent border-white rounded-none focus:ring-purple-600" checked={currentPost.is_ai_reference} onChange={(e) => setCurrentPost({ ...currentPost, is_ai_reference: e.target.checked })} />
                                            <span className="text-xs font-bold uppercase tracking-widest">Index for AI Training</span>
                                        </label>
                                        {currentPost.is_ai_reference && (
                                            <div className="space-y-3">
                                                <input type="text" className="w-full px-4 py-2 bg-transparent brutal-border border border-purple-500 text-white text-xs font-bold uppercase focus:outline-none placeholder-purple-800" placeholder="TOPIC CATEGORY (E.G. MACHINE LEARNING)" value={currentPost.topic_category || ''} onChange={(e) => setCurrentPost({ ...currentPost, topic_category: e.target.value })} />
                                                <input type="number" min="0" className="w-full px-4 py-2 bg-transparent brutal-border border border-purple-500 text-white text-xs font-bold uppercase focus:outline-none" placeholder="REFERENCE PRIORITY" value={currentPost.reference_priority ?? 0} onChange={(e) => setCurrentPost({ ...currentPost, reference_priority: Number(e.target.value || 0) })} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 bg-white brutal-border border-2 border-canvas-dark">
                                    <label className="block text-[10px] font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Schedule Publish (Optional)</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-3 bg-canvas-light brutal-border border border-canvas-dark focus:outline-none focus:border-canvas-coral text-xs font-bold"
                                        value={currentPost.scheduled_publish_at || ''}
                                        onChange={(e) => setCurrentPost({ ...currentPost, scheduled_publish_at: e.target.value })}
                                    />
                                </div>

                                <div className="pt-8 flex justify-end space-x-4 border-t-4 border-canvas-dark">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-8 py-4 bg-white text-canvas-dark font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors">Cancel</button>
                                    <button type="submit" className="px-10 py-4 bg-canvas-coral text-white font-display font-black uppercase text-xs tracking-[0.2em] brutal-border border-2 border-canvas-dark shadow-[6px_6px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                                        {currentPost.id ? 'UPDATE ENTRY' : 'COMMIT KNOWLEDGE'}
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
