import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService, profileService } from '../services/api';
import { Pencil, Trash2, Plus, X, Users, ShieldAlert, ShieldCheck, Search as SearchIcon, UserPlus } from 'lucide-react';

export default function DashboardUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [friendSearchInput, setFriendSearchInput] = useState('');
    const [friendSearchResults, setFriendSearchResults] = useState([]);
    const [socialLoading, setSocialLoading] = useState(false);
    const [socialMessage, setSocialMessage] = useState('');
    const [currentUser, setCurrentUser] = useState({
        id: null, username: '', email: '', first_name: '', last_name: '', password: '', is_staff: false, is_superuser: false, is_active: true
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await dashboardService.getUsers();
            setUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...currentUser };
            if (!payload.password) delete payload.password;

            if (currentUser.id) {
                await dashboardService.updateUser(currentUser.id, payload);
            } else {
                await dashboardService.createUser(payload);
            }
            setShowModal(false);
            fetchUsers();
        } catch (error) {
            console.error("Failed to save user", error);
            alert("Failed to save user. Ensure username/email are unique.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            try {
                await dashboardService.deleteUser(id);
                fetchUsers();
            } catch (error) {
                console.error("Failed to delete user", error);
            }
        }
    };

    const openEditModal = (user) => {
        setCurrentUser({ ...user, password: '' });
        setShowModal(true);
    };

    const openAddModal = () => {
        setCurrentUser({ id: null, username: '', email: '', first_name: '', last_name: '', password: '', is_staff: false, is_superuser: false, is_active: true });
        setShowModal(true);
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

    return (
        <div>
            <div className="flex justify-between items-center mb-8 border-b-4 border-canvas-dark pb-4">
                <h2 className="text-4xl font-display font-black text-canvas-dark uppercase tracking-tighter flex items-center gap-4">
                    <Users className="text-canvas-coral" size={32} strokeWidth={3} />
                    System Users
                </h2>
                <button onClick={openAddModal} className="flex items-center space-x-2 bg-canvas-dark hover:bg-canvas-coral text-white px-6 py-3 font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                    <Plus size={18} />
                    <span>Add User</span>
                </button>
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
                            <div key={userItem.id} className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark flex items-center justify-between gap-3">
                                <div>
                                    <Link to={`/profile/${userItem.username}`} className="font-display font-black uppercase text-sm text-canvas-dark hover:text-canvas-coral">
                                        {userItem.first_name || userItem.last_name
                                            ? `${userItem.first_name || ''} ${userItem.last_name || ''}`.trim()
                                            : userItem.username}
                                    </Link>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">@{userItem.username}</div>
                                </div>
                                {renderFriendButton(userItem.username, userItem.friend_state)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="brutal-border border-4 border-canvas-dark overflow-hidden shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-canvas-dark text-white">
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">User</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">Role</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black font-display uppercase tracking-widest">Joined</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black font-display uppercase tracking-widest">Actions</th>
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
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => openEditModal(user)} className="p-2 text-canvas-dark hover:text-canvas-coral hover:bg-canvas-light brutal-border border-2 border-canvas-dark transition-colors">
                                            <Pencil size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(user.id)} className="p-2 text-white bg-canvas-dark hover:bg-red-600 brutal-border border-2 border-canvas-dark transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
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

            {/* Canvas-styled Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-canvas-light brutal-border border-4 border-canvas-dark w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-[16px_16px_0px_0px_rgba(224,106,89,1)]">
                        <div className="sticky top-0 bg-white border-b-4 border-canvas-dark p-6 flex justify-between items-center z-10">
                            <h3 className="text-3xl font-display font-black text-canvas-dark uppercase tracking-tighter">{currentUser.id ? 'Edit User' : 'Register User'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-canvas-dark hover:text-canvas-coral"><X size={32} /></button>
                        </div>

                        <div className="p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Username</label>
                                        <input type="text" required className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium uppercase" value={currentUser.username} onChange={(e) => setCurrentUser({ ...currentUser, username: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Email</label>
                                        <input type="email" required className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={currentUser.email} onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">First Name</label>
                                        <input type="text" className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={currentUser.first_name} onChange={(e) => setCurrentUser({ ...currentUser, first_name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Last Name</label>
                                        <input type="text" className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={currentUser.last_name} onChange={(e) => setCurrentUser({ ...currentUser, last_name: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">
                                            Password {currentUser.id && <span className="text-gray-400">(Leave blank to keep unchanged)</span>}
                                        </label>
                                        <input type="password" required={!currentUser.id} className="w-full px-4 py-3 bg-white brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={currentUser.password} onChange={(e) => setCurrentUser({ ...currentUser, password: e.target.value })} />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-6 p-6 bg-white brutal-border border-2 border-canvas-dark">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" className="w-5 h-5 accent-canvas-coral" checked={currentUser.is_active} onChange={(e) => setCurrentUser({ ...currentUser, is_active: e.target.checked })} />
                                        <span className="text-xs font-display font-black uppercase tracking-widest text-canvas-dark">Active</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" className="w-5 h-5 accent-canvas-coral" checked={currentUser.is_staff} onChange={(e) => setCurrentUser({ ...currentUser, is_staff: e.target.checked })} />
                                        <span className="text-xs font-display font-black uppercase tracking-widest text-canvas-dark">Staff</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" className="w-5 h-5 accent-canvas-coral" checked={currentUser.is_superuser} onChange={(e) => setCurrentUser({ ...currentUser, is_superuser: e.target.checked })} />
                                        <span className="text-xs font-display font-black uppercase tracking-widest text-canvas-coral">Superuser</span>
                                    </label>
                                </div>

                                <div className="flex justify-end space-x-4 pt-6 border-t-4 border-canvas-dark">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 bg-white text-canvas-dark font-display font-black uppercase text-xs tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors">Cancel</button>
                                    <button type="submit" className="px-10 py-3 bg-canvas-coral text-white font-display font-black uppercase text-xs tracking-[0.2em] brutal-border border-2 border-canvas-dark shadow-[6px_6px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                                        {currentUser.id ? 'Update User' : 'Create User'}
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
