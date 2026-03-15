import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/api';
import { LayoutDashboard, FileText, FolderTree, MessageSquare, Heart } from 'lucide-react';

function StatCard({ title, value, icon }) {
    return (
        <div className="bg-white brutal-border border-4 border-canvas-dark p-6 flex items-center justify-between shadow-[8px_8px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
            <div>
                <p className="text-[10px] font-bold font-display uppercase tracking-widest text-gray-500 mb-2">{title}</p>
                <p className="text-4xl font-display font-black text-canvas-dark">{value ?? '—'}</p>
            </div>
            <div className="p-4 brutal-border border-2 border-canvas-dark bg-canvas-light text-canvas-coral">
                {icon}
            </div>
        </div>
    );
}

export default function DashboardOverview() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await dashboardService.getStats();
                setStats(response.data);
            } catch (error) {
                console.error("Failed to fetch stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="p-8 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Loading Statistics...</div>;

    return (
        <div>
            <div className="mb-10 border-b-4 border-canvas-dark pb-4">
                <h1 className="text-4xl font-display font-black text-canvas-dark uppercase tracking-tighter">Welcome Back</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mt-2">System Overview</p>
            </div>

            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard title="Total Posts" value={stats.blogs_count} icon={<FileText size={24} strokeWidth={2.5} />} />
                    <StatCard title="Categories" value={stats.category_count} icon={<FolderTree size={24} strokeWidth={2.5} />} />
                    <StatCard title="Total Comments" value={stats.total_comments} icon={<MessageSquare size={24} strokeWidth={2.5} />} />
                    <StatCard title="Total Likes" value={stats.total_likes} icon={<Heart size={24} strokeWidth={2.5} />} />
                </div>
            )}

            <div className="bg-white brutal-border border-4 border-canvas-dark p-8 shadow-[8px_8px_0px_0px_rgba(224,106,89,1)]">
                <h3 className="text-2xl font-display font-black text-canvas-dark uppercase tracking-tighter mb-4">Quick Actions</h3>
                <p className="text-sm font-medium text-gray-600 mb-8 border-l-4 border-canvas-coral pl-4">
                    Manage your content using the side navigation. You can view and edit your posts directly from the dashboard.
                </p>
                <Link to="/dashboard/posts" className="inline-flex items-center px-8 py-4 bg-canvas-coral text-white font-display font-black uppercase text-xs tracking-[0.2em] brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                    Go to Knowledge Base →
                </Link>
            </div>
        </div>
    );
}
