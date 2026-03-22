import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Search } from 'lucide-react';

export default function Navbar() {
    const navigate = useNavigate();
    const _location = useLocation();
    const isAuthenticated = !!localStorage.getItem('access_token');

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/');
    };

    return (
        <nav className="bg-canvas-light brutal-border border-l-0 border-r-0 border-t-0 mb-8 py-5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center gap-2">

                    {/* Left: Brand / Tagline */}
                    <div className="flex items-center">
                        <Link to="/" className="text-sm font-display font-bold uppercase tracking-widest text-canvas-dark hover:text-canvas-coral transition-colors">
                            THE CANVAS BLOG.
                        </Link>
                    </div>

                    {/* Center: Navigation Links (mimicking reference) */}
                    <div className="hidden md:flex space-x-8 text-xs font-bold uppercase tracking-wider">
                        <Link to="/" className="hover:text-canvas-coral transition-colors">Latest</Link>
                        <Link to="/trending" className="hover:text-canvas-coral transition-colors">Trending</Link>
                        <Link to="/doom-scroll" className="hover:text-canvas-coral transition-colors">Doom Scroll</Link>
                        <Link to={isAuthenticated ? "/dashboard/posts" : "/login"} className="hover:text-canvas-coral transition-colors">Create Blog</Link>
                    </div>

                    {/* Right: Actions / Auth */}
                    <div className="flex items-center space-x-3">
                        <Link to="/search" className="w-10 h-10 rounded-full bg-canvas-coral text-white flex items-center justify-center hover:bg-canvas-dark transition-colors brutal-border border-canvas-dark border-2">
                            <Search size={16} strokeWidth={3} />
                        </Link>

                        {isAuthenticated ? (
                            <>
                                <Link to="/dashboard" className="w-10 h-10 rounded-full bg-canvas-coral text-white flex items-center justify-center hover:bg-canvas-dark transition-colors brutal-border border-canvas-dark border-2">
                                    <User size={16} strokeWidth={3} />
                                </Link>
                                <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-transparent text-canvas-dark flex items-center justify-center hover:bg-canvas-coral hover:text-white transition-colors brutal-border border-canvas-dark border-2">
                                    <LogOut size={16} strokeWidth={3} />
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="px-3 sm:px-5 py-2 rounded-full font-display font-bold uppercase text-[10px] sm:text-xs tracking-widest hover:bg-canvas-coral hover:text-white transition-colors brutal-border border-2 border-canvas-dark">
                                    Log In
                                </Link>
                                <Link to="/register" className="px-5 py-2 rounded-full font-display font-bold uppercase text-xs tracking-widest bg-canvas-coral text-white hover:bg-canvas-dark transition-colors brutal-border border-2 border-canvas-dark hidden sm:block">
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                <div className="md:hidden mt-4 pt-3 border-t-2 border-canvas-dark flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider">
                    <Link to="/" className="hover:text-canvas-coral transition-colors">Latest</Link>
                    <Link to="/trending" className="hover:text-canvas-coral transition-colors">Trending</Link>
                    <Link to="/doom-scroll" className="hover:text-canvas-coral transition-colors">Doom Scroll</Link>
                    <Link to={isAuthenticated ? "/dashboard/posts" : "/login"} className="hover:text-canvas-coral transition-colors">Create Blog</Link>
                </div>
            </div>
        </nav>
    );
}
