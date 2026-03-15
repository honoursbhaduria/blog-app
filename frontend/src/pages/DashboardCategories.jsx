import { useState, useEffect } from 'react';
import { dashboardService } from '../services/api';
import { Pencil, Trash2, Plus, X, FolderTree, Lock } from 'lucide-react';

export default function DashboardCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentCategory, setCurrentCategory] = useState({ category_name: '' });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await dashboardService.getCategories();
            setCategories(res.data);
        } catch (error) {
            console.error("Failed to fetch categories", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentCategory.id) {
                await dashboardService.updateCategory(currentCategory.id, currentCategory);
            } else {
                await dashboardService.createCategory(currentCategory);
            }
            setShowModal(false);
            fetchCategories();
        } catch (error) {
            console.error("Failed to save category", error);
            alert("Failed to save category. Please ensure the name is unique.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this category?')) {
            try {
                await dashboardService.deleteCategory(id);
                fetchCategories();
            } catch (error) {
                console.error("Failed to delete category", error);
            }
        }
    };

    const openEditModal = (category) => {
        if (category.is_predefined) {
            alert('Predefined categories are locked and cannot be edited.');
            return;
        }
        setCurrentCategory(category);
        setShowModal(true);
    };

    const openAddModal = () => {
        setCurrentCategory({ category_name: '' });
        setShowModal(true);
    };

    if (loading) return <div className="p-8 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Scanning Categories...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-8 border-b-4 border-canvas-dark pb-4">
                <h2 className="text-4xl font-display font-black text-canvas-dark uppercase tracking-tighter flex items-center gap-4">
                    <FolderTree className="text-canvas-coral" size={32} strokeWidth={3} />
                    Categories
                </h2>
                <button onClick={openAddModal} className="flex items-center space-x-2 bg-canvas-dark hover:bg-canvas-coral text-white px-6 py-3 font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                    <Plus size={18} />
                    <span>Add New</span>
                </button>
            </div>

            <div className="brutal-border border-4 border-canvas-dark overflow-hidden shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-canvas-dark text-white">
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">ID</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">Name</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">Created</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black font-display uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories?.map((cat, idx) => (
                            <tr key={cat.id} className={`border-t-2 border-canvas-dark hover:bg-canvas-light transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-canvas-light/50'}`}>
                                <td className="px-6 py-4 text-sm font-bold text-gray-500">{cat.id}</td>
                                <td className="px-6 py-4 text-sm font-display font-black text-canvas-dark uppercase">{cat.category_name}</td>
                                <td className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">{new Date(cat.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => openEditModal(cat)} className="p-2 text-canvas-dark hover:text-canvas-coral hover:bg-canvas-light brutal-border border-2 border-canvas-dark transition-colors">
                                            <Pencil size={16} />
                                        </button>
                                        {cat.is_predefined ? (
                                            <div className="p-2 text-gray-500 bg-gray-200 brutal-border border-2 border-canvas-dark" title="Predefined category is locked">
                                                <Lock size={16} />
                                            </div>
                                        ) : (
                                            <button onClick={() => handleDelete(cat.id)} className="p-2 text-white bg-canvas-dark hover:bg-red-600 brutal-border border-2 border-canvas-dark transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {categories.length === 0 && (
                    <div className="text-center py-16 bg-canvas-light">
                        <p className="font-display font-black text-xl uppercase tracking-[0.2em] text-gray-400">Zero Categories Established.</p>
                    </div>
                )}
            </div>

            {/* Canvas-styled Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-canvas-light brutal-border border-4 border-canvas-dark w-full max-w-md shadow-[16px_16px_0px_0px_rgba(224,106,89,1)]">
                        <div className="bg-white border-b-4 border-canvas-dark p-6 flex justify-between items-center">
                            <h3 className="text-2xl font-display font-black text-canvas-dark uppercase tracking-tighter">{currentCategory.id ? 'Edit Category' : 'Initialize Category'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-canvas-dark hover:text-canvas-coral">
                                <X size={28} />
                            </button>
                        </div>

                        <div className="p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Category Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium uppercase"
                                        value={currentCategory.category_name}
                                        onChange={(e) => setCurrentCategory({ ...currentCategory, category_name: e.target.value })}
                                        placeholder="E.G. MACHINE LEARNING"
                                    />
                                </div>
                                <div className="flex justify-end space-x-4 pt-4 border-t-4 border-canvas-dark">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 bg-white text-canvas-dark font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors">Cancel</button>
                                    <button type="submit" className="px-8 py-3 bg-canvas-coral text-white font-display font-black uppercase text-xs tracking-[0.2em] brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                                        {currentCategory.id ? 'Update' : 'Create'}
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
