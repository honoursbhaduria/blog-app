import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await authService.login({ username, password });
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
            navigate('/dashboard');
        } catch {
            setError('Invalid credentials.');
        }
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center bg-canvas-light py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full p-10 bg-white brutal-border border-2">
                <div className="mb-8 border-b-2 border-canvas-dark pb-6">
                    <h2 className="text-center text-4xl font-display font-black tracking-tighter uppercase text-canvas-dark">
                        Log In
                    </h2>
                    <p className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-canvas-coral">
                        Enter your credentials
                    </p>
                </div>

                {error && <div className="text-white text-sm font-bold uppercase tracking-widest text-center bg-red-600 p-3 mb-6 brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]">{error}</div>}

                <form className="space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-canvas-dark mb-2">Username</label>
                            <input
                                type="text"
                                required
                                className="block w-full px-4 py-3 brutal-border border-2 border-canvas-dark placeholder-gray-400 bg-canvas-light text-canvas-dark focus:outline-none focus:ring-0 focus:border-canvas-coral font-medium transition-colors"
                                placeholder="..."
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-canvas-dark mb-2">Password</label>
                            <input
                                type="password"
                                required
                                className="block w-full px-4 py-3 brutal-border border-2 border-canvas-dark placeholder-gray-400 bg-canvas-light text-canvas-dark focus:outline-none focus:ring-0 focus:border-canvas-coral font-medium transition-colors"
                                placeholder="..."
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full flex justify-center py-4 px-4 border-2 border-canvas-dark text-sm font-bold rounded-full uppercase tracking-widest text-white bg-canvas-coral hover:bg-canvas-dark focus:outline-none transition-colors shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                        >
                            Log Into Session
                        </button>
                    </div>

                    <div className="text-center text-xs font-bold uppercase tracking-widest pt-4 border-t-2 border-canvas-dark mt-6">
                        <span className="text-gray-500">Don't have an account? </span>
                        <Link to="/register" className="text-canvas-coral hover:text-canvas-dark transition-colors">
                            Sign up here
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
