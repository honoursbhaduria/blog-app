import { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { dashboardService } from '../services/api';
import { LayoutDashboard, FileText, FolderTree, Users, LogOut, Settings, Share2, Menu, X, BookMarked } from 'lucide-react';

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                await dashboardService.getStats();
                setLoading(false);
            } catch (error) {
                if (error.response?.status === 401) {
                    navigate('/login');
                }
            }
        };
        checkAuth();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/login');
    };

    const navLinkClass = (path) => {
        const isActive = location.pathname === path || location.pathname === path + '/';
        return `flex items-center space-x-4 px-6 py-4 transition-colors font-display font-black uppercase text-xs tracking-widest brutal-border border-2 ${
            isActive
                ? 'bg-canvas-dark text-white border-canvas-dark shadow-[4px_4px_0px_0px_rgba(224,106,89,1)]'
                : 'bg-canvas-light text-canvas-dark border-transparent hover:border-canvas-dark hover:bg-white'
        }`;
    };

    if (loading) return <div className="flex justify-center items-center h-64 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Initializing Control Panel...</div>;

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-canvas-light">
            {/* Mobile Sidebar Toggle */}
            <div className="md:hidden fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-4 bg-canvas-dark text-white rounded-none brutal-border border-2 border-white shadow-[4px_4px_0px_0px_rgba(224,106,89,1)]"
                >
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 w-72 bg-white brutal-border border-r-4 border-t-0 border-b-0 border-l-0 border-canvas-dark z-40 transition-transform duration-300 ease-in-out`}>
                <div className="p-8 h-full flex flex-col overflow-y-auto">
                    <div className="mb-10 pb-6 border-b-4 border-canvas-dark">
                        <h2 className="text-2xl font-display font-black uppercase tracking-widest text-canvas-dark leading-none">Control Panel</h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mt-3">Secure Session</p>
                    </div>
                    
                    <nav className="space-y-4 flex-1">
                        <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                            <LayoutDashboard size={18} />
                            <span>Overview</span>
                        </Link>
                        <Link to="/dashboard/posts" className={navLinkClass('/dashboard/posts')}>
                            <FileText size={18} />
                            <span>Knowledge Base</span>
                        </Link>
                        <Link to="/dashboard/clusters" className={navLinkClass('/dashboard/clusters')}>
                            <Share2 size={18} />
                            <span>Clusters</span>
                        </Link>
                        <Link to="/dashboard/wiki-board" className={navLinkClass('/dashboard/wiki-board')}>
                            <BookMarked size={18} />
                            <span>Wiki Drafts</span>
                        </Link>
                        <Link to="/dashboard/categories" className={navLinkClass('/dashboard/categories')}>
                            <FolderTree size={18} />
                            <span>Categories</span>
                        </Link>
                        <Link to="/dashboard/users" className={navLinkClass('/dashboard/users')}>
                            <Users size={18} />
                            <span>System Users</span>
                        </Link>
                        
                        <div className="pt-8 border-t-4 border-canvas-dark mt-8 mb-4">
                            <span className="bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1">Identity Management</span>
                        </div>
                        
                        <Link to="/profile/edit" className={navLinkClass('/profile/edit')}>
                            <Settings size={18} />
                            <span>Configure Profile</span>
                        </Link>
                    </nav>

                    <div className="mt-8 pt-6 border-t-4 border-canvas-dark">
                        <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-red-600 text-white font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-dark transition-colors shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
                            <LogOut size={18} />
                            <span>Terminate Session</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content nested here */}
            <main className="flex-1 p-6 md:p-12 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
