import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

export default function Register() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match!");
            return;
        }

        try {
            await authService.register({
                username: formData.username,
                email: formData.email,
                password: formData.password
            });
            navigate('/login');
        } catch (err) {
            console.error("Registration Error Details:", err);
            const backendErrors = err.response?.data;
            if (backendErrors) {
                const message = Object.entries(backendErrors)
                    .map(([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(', ') : msg}`)
                    .join(' | ');
                setError(message);
            } else if (err.message === "Network Error") {
                setError("Network Error: Could not connect to API server. Is the backend running?");
            } else {
                setError('Registration failed: ' + (err.message || 'Unknown error'));
            }
        }
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center bg-canvas-light py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full p-10 bg-white brutal-border border-2">
                <div className="mb-8 border-b-2 border-canvas-dark pb-6">
                    <h2 className="text-center text-4xl font-display font-black tracking-tighter uppercase text-canvas-dark">
                        Register
                    </h2>
                    <p className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-canvas-coral">
                        Create your account
                    </p>
                </div>

                {error && <div className="text-white text-sm font-bold uppercase tracking-widest text-center bg-red-600 p-3 mb-6 brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]">{error}</div>}

                <form className="space-y-6" onSubmit={handleRegister}>
                    <div className="space-y-5">
                        <input
                            name="username" type="text" required
                            className="block w-full px-4 py-3 brutal-border border-2 border-canvas-dark placeholder-gray-400 bg-canvas-light text-canvas-dark focus:outline-none focus:ring-0 focus:border-canvas-coral font-medium transition-colors"
                            placeholder="USERNAME" onChange={handleChange}
                        />
                        <input
                            name="email" type="email" required
                            className="block w-full px-4 py-3 brutal-border border-2 border-canvas-dark placeholder-gray-400 bg-canvas-light text-canvas-dark focus:outline-none focus:ring-0 focus:border-canvas-coral font-medium transition-colors"
                            placeholder="EMAIL ADDRESS" onChange={handleChange}
                        />
                        <input
                            name="password" type="password" required
                            className="block w-full px-4 py-3 brutal-border border-2 border-canvas-dark placeholder-gray-400 bg-canvas-light text-canvas-dark focus:outline-none focus:ring-0 focus:border-canvas-coral font-medium transition-colors"
                            placeholder="PASSWORD" onChange={handleChange}
                        />
                        <input
                            name="confirmPassword" type="password" required
                            className="block w-full px-4 py-3 brutal-border border-2 border-canvas-dark placeholder-gray-400 bg-canvas-light text-canvas-dark focus:outline-none focus:ring-0 focus:border-canvas-coral font-medium transition-colors"
                            placeholder="CONFIRM PASSWORD" onChange={handleChange}
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full flex justify-center py-4 px-4 border-2 border-canvas-dark text-sm font-bold rounded-full uppercase tracking-widest text-white bg-canvas-coral hover:bg-canvas-dark focus:outline-none transition-colors shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                        >
                            Sign Up Now
                        </button>
                    </div>

                    <div className="text-center text-xs font-bold uppercase tracking-widest pt-4 border-t-2 border-canvas-dark mt-6">
                        <span className="text-gray-500">Already a member? </span>
                        <Link to="/login" className="text-canvas-coral hover:text-canvas-dark transition-colors">
                            Sign in here
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
