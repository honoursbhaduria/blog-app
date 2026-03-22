import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService, profileService } from '../services/api';
import { Users, ShieldAlert, ShieldCheck, Search as SearchIcon, UserPlus } from 'lucide-react';

export default function DashboardUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [friendSearchInput, setFriendSearchInput] = useState('');
    const [friendSearchResults, setFriendSearchResults] = useState([]);
    const [socialLoading, setSocialLoading] = useState(false);
    const [socialMessage, setSocialMessage] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await dashboardService.getUsers();
            setUsers(res.data);
            setAccessDenied(false);
        } catch (error) {
            console.error("Failed to fetch users", error);
            if (error?.response?.status === 403) {
                setAccessDenied(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const runFriendSearch = async (event) => {
        event.preventDefault();
        const query = friendSearchInput.trim();
        if (!query) {
            setFriendSearchResults([]);
            return;
        }

        setSocialLoading(true);
        try {
            const res = await profileService.searchUsers(query);
            setFriendSearchResults(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Friend search failed', error);
            setFriendSearchResults([]);
            setSocialMessage('User search failed. Try again.');
        } finally {
            setSocialLoading(false);
        }
    };

    const refreshFriendSearchResults = async () => {
        const query = friendSearchInput.trim();
        if (!query) return;
        const res = await profileService.searchUsers(query);
        setFriendSearchResults(Array.isArray(res.data) ? res.data : []);
    };

    const handleFriendAction = async (username, action) => {
        setSocialLoading(true);
        setSocialMessage('');
        try {
            if (action === 'invite') await profileService.inviteFriend(username);
            if (action === 'accept') await profileService.acceptFriend(username);
            if (action === 'reject') await profileService.rejectFriend(username);
            if (action === 'remove') await profileService.removeFriend(username);

            await refreshFriendSearchResults();
            setSocialMessage('Friend action completed.');
        } catch (error) {
            console.error('Friend action failed', error);
            const detail = error?.response?.data?.detail;
            setSocialMessage(detail || 'Failed to perform friend action.');
        } finally {
            setSocialLoading(false);
            setTimeout(() => setSocialMessage(''), 2500);
        }
    };

    const renderFriendButton = (targetUsername, state) => {
        if (state === 'self') {
            return <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">You</span>;
        }

        if (state === 'friends') {
            return (
                <button
                    onClick={() => handleFriendAction(targetUsername, 'remove')}
                    disabled={socialLoading}
                    className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50"
                >
                    Remove
                </button>
            );
        }

        if (state === 'incoming_pending') {
            return (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleFriendAction(targetUsername, 'accept')}
                        disabled={socialLoading}
                        className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50"
                    >
                        Accept
                    </button>
                    <button
                        onClick={() => handleFriendAction(targetUsername, 'reject')}
                        disabled={socialLoading}
                        className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors disabled:opacity-50"
                    >
                        Reject
                    </button>
                </div>
            );
        }

        if (state === 'outgoing_pending') {
            return (
                <button
                    onClick={() => handleFriendAction(targetUsername, 'invite')}
                    disabled={socialLoading}
                    className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors disabled:opacity-50"
                >
                    Cancel Invite
                </button>
            );
        }

        return (
            <button
                onClick={() => handleFriendAction(targetUsername, 'invite')}
                disabled={socialLoading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50"
            >
                <UserPlus size={12} /> Invite Friend
            </button>
        );
    };

    if (loading) return <div className="p-8 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Scanning User Registry...</div>;

    if (accessDenied) {
        return (
            <div className="p-8 bg-white brutal-border border-4 border-canvas-dark shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                <h2 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tighter text-canvas-dark mb-2">System Users</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-canvas-coral">Access denied. Only admins can manage system users.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8 border-b-4 border-canvas-dark pb-4">
                <h2 className="text-2xl md:text-4xl font-display font-black text-canvas-dark uppercase tracking-tighter flex items-center gap-3 md:gap-4">
                    <Users className="text-canvas-coral" size={32} strokeWidth={3} />
                    System Users
                </h2>
            </div>

            <div className="mb-8 bg-white brutal-border border-4 border-canvas-dark p-6 shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                <h3 className="text-2xl font-display font-black text-canvas-dark uppercase tracking-tighter mb-4">Friend Search</h3>
                <form onSubmit={runFriendSearch} className="flex flex-col md:flex-row gap-3 mb-4">
                    <input
                        type="text"
                        value={friendSearchInput}
                        onChange={(event) => setFriendSearchInput(event.target.value)}
                        placeholder="Type username or name"
                        className="flex-1 px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark text-xs font-bold uppercase tracking-widest focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={socialLoading}
                        className="px-5 py-3 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <SearchIcon size={14} /> Search
                    </button>
                </form>

                {socialMessage && (
                    <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-canvas-coral">{socialMessage}</p>
                )}

                {friendSearchResults.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {friendSearchResults.map((userItem) => (
                            <div key={userItem.id} className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <Link to={`/profile/${userItem.username}`} className="font-display font-black uppercase text-sm text-canvas-dark hover:text-canvas-coral">
                                        {userItem.first_name || userItem.last_name
                                            ? `${userItem.first_name || ''} ${userItem.last_name || ''}`.trim()
                                            : userItem.username}
                                    </Link>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">@{userItem.username}</div>
                                </div>
                                <div className="w-full sm:w-auto">{renderFriendButton(userItem.username, userItem.friend_state)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="md:hidden space-y-3">
                {users.map((user) => (
                    <div key={user.id} className="p-4 bg-white brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                                <div className="text-sm font-display font-black text-canvas-dark uppercase">{user.username}</div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 break-all">{user.email}</div>
                            </div>
                            <div>
                                {user.is_superuser ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-canvas-coral text-white text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark">
                                        <ShieldAlert size={12} /> Admin
                                    </span>
                                ) : user.is_staff ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark">
                                        <ShieldCheck size={12} /> Staff
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Regular</span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                Joined {new Date(user.date_joined).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden md:block brutal-border border-4 border-canvas-dark overflow-x-auto shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-canvas-dark text-white">
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">User</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">Role</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, idx) => (
                            <tr key={user.id} className={`border-t-2 border-canvas-dark hover:bg-canvas-light transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-canvas-light/50'}`}>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-display font-black text-canvas-dark uppercase">{user.username}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{user.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {user.is_superuser ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-canvas-coral text-white text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark">
                                            <ShieldAlert size={12} /> Admin
                                        </span>
                                    ) : user.is_staff ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark">
                                            <ShieldCheck size={12} /> Staff
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Regular</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    {new Date(user.date_joined).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && (
                    <div className="text-center py-16 bg-canvas-light">
                        <p className="font-display font-black text-xl uppercase tracking-[0.2em] text-gray-400">Zero Users Found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
