import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { profileService, blogService } from '../services/api';
import { User, Mail, Link as LinkIcon, Instagram, Twitter, Youtube, Facebook, Bookmark, FileText, MapPin, Briefcase, Globe, GraduationCap, CheckCircle2, Users, UserPlus, Search as SearchIcon } from 'lucide-react';
import { getFullImageUrl } from '../utils/helpers';

export default function Profile() {
    const { username } = useParams();
    const [profile, setProfile] = useState(null);
    const [blogs, setBlogs] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
    const [friends, setFriends] = useState([]);
    const [socialLoading, setSocialLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('published'); // 'published' or 'favorites'

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const [profileRes, blogsRes, favRes] = await Promise.all([
                    profileService.getPublicProfile(username),
                    profileService.getAuthoredBlogs(username),
                    blogService.getFavorites(username)
                ]);
                setProfile(profileRes.data);
                setBlogs(blogsRes.data);
                setFavorites(favRes.data);
            } catch (error) {
                console.error("Error fetching profile", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [username]);

    useEffect(() => {
        const fetchSocial = async () => {
            try {
                const [friendsRes, requestsRes] = await Promise.all([
                    profileService.getFriends(),
                    profileService.getFriendRequests(),
                ]);
                setFriends(Array.isArray(friendsRes.data) ? friendsRes.data : []);
                setFriendRequests(requestsRes.data || { incoming: [], outgoing: [] });
            } catch (error) {
                console.error('Failed to fetch social data', error);
            }
        };

        fetchSocial();
    }, []);

    const refreshSocialData = async () => {
        const [friendsRes, requestsRes] = await Promise.all([
            profileService.getFriends(),
            profileService.getFriendRequests(),
        ]);
        setFriends(Array.isArray(friendsRes.data) ? friendsRes.data : []);
        setFriendRequests(requestsRes.data || { incoming: [], outgoing: [] });
    };

    const runUserSearch = async (event) => {
        event.preventDefault();
        const query = searchInput.trim();
        if (!query) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await profileService.searchUsers(query);
            setSearchResults(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('User search failed', error);
            setSearchResults([]);
        }
    };

    const handleFriendAction = async (usernameValue, action) => {
        setSocialLoading(true);
        try {
            if (action === 'invite') await profileService.inviteFriend(usernameValue);
            if (action === 'accept') await profileService.acceptFriend(usernameValue);
            if (action === 'reject') await profileService.rejectFriend(usernameValue);
            if (action === 'remove') await profileService.removeFriend(usernameValue);

            await refreshSocialData();
            if (searchInput.trim()) {
                const refreshedSearch = await profileService.searchUsers(searchInput.trim());
                setSearchResults(Array.isArray(refreshedSearch.data) ? refreshedSearch.data : []);
            }

            if (usernameValue === username) {
                const profileRes = await profileService.getPublicProfile(username);
                setProfile(profileRes.data);
            }
        } catch (error) {
            console.error('Friend action failed', error);
            const detail = error?.response?.data?.detail;
            alert(detail || 'Failed to perform friend action.');
        } finally {
            setSocialLoading(false);
        }
    };

    const renderFriendButton = (targetUsername, state) => {
        if (state === 'self') return null;
        if (state === 'friends') {
            return (
                <button
                    onClick={() => handleFriendAction(targetUsername, 'remove')}
                    disabled={socialLoading}
                    className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50"
                >
                    Remove Friend
                </button>
            );
        }
        if (state === 'incoming_pending') {
            return (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleFriendAction(targetUsername, 'accept')}
                        disabled={socialLoading}
                        className="px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50"
                    >
                        Accept
                    </button>
                    <button
                        onClick={() => handleFriendAction(targetUsername, 'reject')}
                        disabled={socialLoading}
                        className="px-4 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors disabled:opacity-50"
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
                    className="px-4 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors disabled:opacity-50"
                >
                    Cancel Invite
                </button>
            );
        }

        return (
            <button
                onClick={() => handleFriendAction(targetUsername, 'invite')}
                disabled={socialLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50"
            >
                <UserPlus size={12} /> Invite Friend
            </button>
        );
    };

    if (loading) return <div className="flex justify-center items-center h-64 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Scanning Identity...</div>;
    if (!profile) return <div className="text-center font-display font-bold uppercase text-2xl py-12 text-canvas-dark">Identity Not Found.</div>;

    const fullName = `${profile.user?.first_name || ''} ${profile.user?.last_name || ''}`.trim() || profile.user?.username;

    const renderBlogGrid = (postsList, emptyMessage) => {
        if (!Array.isArray(postsList) || postsList.length === 0) return (
            <div className="text-center py-20 brutal-border border-4 bg-canvas-light shadow-[8px_8px_0px_0px_rgba(224,106,89,1)]">
                <p className="font-display font-black text-xl uppercase tracking-[0.2em] text-gray-400">{emptyMessage}</p>
            </div>
        );

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 brutal-border border-l-4 border-t-4 border-r-0 border-b-0">
                {postsList.map(post => (
                    <article key={post.id} className="brutal-border border-r-4 border-b-4 border-t-0 border-l-0 bg-white group hover:bg-canvas-light transition-colors flex flex-col h-full">
                        <div className="relative h-48 border-b-4 border-canvas-dark overflow-hidden bg-canvas-dark">
                            <img src={getFullImageUrl(post.featured_image)} alt={post.title} className="w-full h-full object-cover grayscale mix-blend-luminosity group-hover:grayscale-0 group-hover:mix-blend-normal transition-all duration-500 hover:scale-105" />
                        </div>
                        <div className="p-6 flex flex-col flex-grow">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mb-4">{post.category?.category_name}</span>
                            <Link to={`/post/${post.slug}`} className="block mb-6 flex-grow">
                                <h3 className="text-2xl font-display font-black text-canvas-dark leading-tight group-hover:text-canvas-coral transition-colors uppercase tracking-tight">
                                    {post.title}
                                </h3>
                            </Link>
                            <Link to={`/post/${post.slug}`} className="w-full py-3 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-[0.2em] text-center hover:bg-canvas-coral transition-colors brutal-border border-2 border-canvas-dark shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none translate-x-0 hover:translate-x-1 hover:translate-y-1">
                                View Artifact
                            </Link>
                        </div>
                    </article>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mb-20">
            {/* Profile Header (Brutalist) */}
            <div className="brutal-border border-4 border-canvas-dark bg-white shadow-[16px_16px_0px_0px_rgba(28,28,28,1)] mb-16 overflow-hidden">
                {/* Banner Area */}
                <div className="h-64 md:h-80 bg-canvas-dark relative border-b-4 border-canvas-dark overflow-hidden">
                    {profile.profile_banner ? (
                        <img src={getFullImageUrl(profile.profile_banner)} className="w-full h-full object-cover grayscale opacity-60" alt="Banner" />
                    ) : (
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#E06A59 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
                    )}
                    
                    {/* Opportunity Badge */}
                    {profile.open_to_opportunities && (
                        <div className="absolute top-6 right-6 bg-canvas-coral text-white brutal-border border-2 border-white px-4 py-2 font-display font-black uppercase text-[10px] tracking-widest shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] flex items-center gap-2">
                            <CheckCircle2 size={14} /> Open to Opportunities
                        </div>
                    )}
                </div>
                
                <div className="p-8 md:p-12 relative flex flex-col lg:flex-row gap-12 items-start bg-white">
                    {/* Avatar Column */}
                    <div className="flex flex-col items-center">
                        <div className="w-48 h-48 brutal-border border-4 border-canvas-dark bg-white -mt-32 relative z-10 shadow-[8px_8px_0px_0px_rgba(224,106,89,1)] overflow-hidden">
                            {profile.profile_image ? (
                                <img src={getFullImageUrl(profile.profile_image)} alt={username} className="w-full h-full object-cover grayscale" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-canvas-light text-canvas-dark">
                                    <User size={80} />
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-8 w-full space-y-4">
                            <div className="p-4 bg-canvas-light brutal-border border-2 border-canvas-dark">
                                <h3 className="font-display font-black uppercase text-[10px] tracking-widest text-gray-400 mb-3 border-b border-gray-300 pb-1">Connections</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                                    {profile.github_handle && <a href={`https://github.com/${profile.github_handle}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest hover:text-canvas-coral flex items-center gap-2 truncate"><Globe size={12} /> GitHub</a>}
                                    {profile.linkedin_handle && <a href={`https://linkedin.com/in/${profile.linkedin_handle}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest hover:text-canvas-coral flex items-center gap-2 truncate"><LinkIcon size={12} /> LinkedIn</a>}
                                    {profile.facebook_link && <a href={profile.facebook_link} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest hover:text-canvas-coral flex items-center gap-2 truncate"><Facebook size={12} /> Facebook</a>}
                                    {profile.twitter_link && <a href={profile.twitter_link} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest hover:text-canvas-coral flex items-center gap-2 truncate"><Twitter size={12} /> Twitter</a>}
                                    {profile.instagram_link && <a href={profile.instagram_link} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest hover:text-canvas-coral flex items-center gap-2 truncate"><Instagram size={12} /> Instagram</a>}
                                    {profile.youtube_link && <a href={profile.youtube_link} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest hover:text-canvas-coral flex items-center gap-2 truncate"><Youtube size={12} /> YouTube</a>}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Details Column */}
                    <div className="flex-1 space-y-8">
                        <div>
                            <div className="flex flex-wrap items-center gap-4 mb-4">
                                <span className="px-4 py-1 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark">
                                    {profile.current_role}
                                </span>
                                {profile.years_of_experience > 0 && (
                                    <span className="px-4 py-1 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark shadow-[3px_3px_0px_0px_rgba(28,28,28,1)]">
                                        {profile.years_of_experience} YRS EXP
                                    </span>
                                )}
                            </div>
                            <h1 className="text-5xl md:text-8xl font-display font-black text-canvas-dark uppercase tracking-tighter leading-[0.8] mb-4">
                                {fullName}
                            </h1>
                            <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-canvas-coral font-display">
                                <span className="flex items-center gap-2">@{profile.user?.username}</span>
                                {profile.location && <span className="flex items-center gap-2 text-gray-500"><MapPin size={14}/> {profile.location}</span>}
                                {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-gray-500 hover:text-canvas-dark transition-colors"><Globe size={14}/> {profile.website.replace(/^https?:\/\//, '')}</a>}
                                {profile.public_email && <a href={`mailto:${profile.public_email}`} className="flex items-center gap-2 text-gray-500 hover:text-canvas-dark transition-colors"><Mail size={14}/> {profile.public_email}</a>}
                            </div>
                            <div className="mt-4 flex items-center gap-3">
                                {renderFriendButton(profile.user?.username, profile.friend_state)}
                                <span className="px-3 py-2 bg-canvas-light text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border border-canvas-dark">
                                    Friends: {profile.friends_count || 0}
                                </span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-t-2 border-b-2 border-canvas-dark">
                            <div className="space-y-4">
                                <h3 className="font-display font-black uppercase text-xs tracking-[0.2em] text-gray-400">Biography</h3>
                                <p className="text-lg font-medium text-canvas-dark leading-relaxed">
                                    {profile.about || "IDENTITY PROFILE UNINITIALIZED. NO BIOGRAPHICAL DATA DETECTED IN LOCAL BUFFER."}
                                </p>
                            </div>
                            <div className="space-y-6">
                                {profile.company && (
                                    <div className="flex items-start gap-4">
                                        <Briefcase className="text-canvas-coral mt-1" size={20} />
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current Node</div>
                                            <div className="font-display font-black uppercase text-sm">{profile.company}</div>
                                        </div>
                                    </div>
                                )}
                                {(profile.university || profile.degree) && (
                                    <div className="flex items-start gap-4">
                                        <GraduationCap className="text-canvas-coral mt-1" size={20} />
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Academic Foundation</div>
                                            <div className="font-display font-black uppercase text-sm">{profile.degree}</div>
                                            <div className="text-xs font-bold text-gray-500 uppercase">{profile.university}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <section className="mb-16 bg-white brutal-border border-4 border-canvas-dark p-8 shadow-[10px_10px_0px_0px_rgba(28,28,28,1)]">
                <h2 className="text-3xl font-display font-black uppercase tracking-tighter text-canvas-dark mb-6 flex items-center gap-3">
                    <Users className="text-canvas-coral" size={26} /> Friends & Invites
                </h2>

                <form onSubmit={runUserSearch} className="flex gap-3 mb-8">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search users by username or name"
                        className="flex-1 px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark text-xs font-bold uppercase tracking-widest focus:outline-none"
                    />
                    <button type="submit" className="px-5 py-3 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors inline-flex items-center gap-2">
                        <SearchIcon size={14} /> Search
                    </button>
                </form>

                {searchResults.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-xs font-display font-black uppercase tracking-widest text-canvas-coral mb-3">Search Results</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.map((userItem) => (
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
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div>
                        <h3 className="text-xs font-display font-black uppercase tracking-widest text-canvas-coral mb-3">Incoming Requests</h3>
                        <div className="space-y-3">
                            {(friendRequests.incoming || []).map((item) => (
                                <div key={item.id} className="p-3 bg-canvas-light brutal-border border-2 border-canvas-dark">
                                    <Link to={`/profile/${item.sender.username}`} className="text-xs font-display font-black uppercase text-canvas-dark hover:text-canvas-coral">
                                        @{item.sender.username}
                                    </Link>
                                    <div className="mt-2 flex gap-2">
                                        <button onClick={() => handleFriendAction(item.sender.username, 'accept')} disabled={socialLoading} className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50">Accept</button>
                                        <button onClick={() => handleFriendAction(item.sender.username, 'reject')} disabled={socialLoading} className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors disabled:opacity-50">Reject</button>
                                    </div>
                                </div>
                            ))}
                            {(friendRequests.incoming || []).length === 0 && <p className="text-xs font-bold uppercase tracking-widest text-gray-400">No incoming requests.</p>}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-display font-black uppercase tracking-widest text-canvas-coral mb-3">Sent Invites</h3>
                        <div className="space-y-3">
                            {(friendRequests.outgoing || []).map((item) => (
                                <div key={item.id} className="p-3 bg-canvas-light brutal-border border-2 border-canvas-dark flex items-center justify-between gap-2">
                                    <Link to={`/profile/${item.receiver.username}`} className="text-xs font-display font-black uppercase text-canvas-dark hover:text-canvas-coral">
                                        @{item.receiver.username}
                                    </Link>
                                    <button onClick={() => handleFriendAction(item.receiver.username, 'invite')} disabled={socialLoading} className="px-3 py-2 bg-white text-canvas-dark text-[10px] font-bold uppercase tracking-widest brutal-border border-2 border-canvas-dark hover:bg-canvas-light transition-colors disabled:opacity-50">Cancel</button>
                                </div>
                            ))}
                            {(friendRequests.outgoing || []).length === 0 && <p className="text-xs font-bold uppercase tracking-widest text-gray-400">No outgoing invites.</p>}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-display font-black uppercase tracking-widest text-canvas-coral mb-3">My Friends</h3>
                        <div className="space-y-3">
                            {friends.map((item) => (
                                <div key={item.id} className="p-3 bg-canvas-light brutal-border border-2 border-canvas-dark flex items-center justify-between gap-2">
                                    <Link to={`/profile/${item.username}`} className="text-xs font-display font-black uppercase text-canvas-dark hover:text-canvas-coral">
                                        @{item.username}
                                    </Link>
                                    <button onClick={() => handleFriendAction(item.username, 'remove')} disabled={socialLoading} className="px-3 py-2 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-canvas-coral transition-colors disabled:opacity-50">Remove</button>
                                </div>
                            ))}
                            {friends.length === 0 && <p className="text-xs font-bold uppercase tracking-widest text-gray-400">No friends yet.</p>}
                        </div>
                    </div>
                </div>
            </section>

            {/* Content Tabs */}
            <div className="flex border-b-8 border-canvas-dark mb-16">
                <button 
                    onClick={() => setActiveTab('published')}
                    className={`flex-1 py-8 text-center font-display font-black uppercase tracking-widest text-sm md:text-2xl transition-all border-r-4 border-canvas-dark flex items-center justify-center gap-4 ${activeTab === 'published' ? 'bg-canvas-dark text-white' : 'bg-white text-canvas-dark hover:bg-canvas-light'}`}
                >
                    <FileText size={28} className={activeTab === 'published' ? 'text-canvas-coral' : ''} />
                    Publications ({Array.isArray(blogs) ? blogs.length : 0})
                </button>
                <button 
                    onClick={() => setActiveTab('favorites')}
                    className={`flex-1 py-8 text-center font-display font-black uppercase tracking-widest text-sm md:text-2xl transition-all flex items-center justify-center gap-4 ${activeTab === 'favorites' ? 'bg-canvas-dark text-white' : 'bg-white text-canvas-dark hover:bg-canvas-light'}`}
                >
                    <Bookmark size={28} className={activeTab === 'favorites' ? 'text-canvas-coral' : ''} />
                    Archives ({Array.isArray(favorites) ? favorites.length : 0})
                </button>
            </div>

            {/* Tab Content */}
            <div className="mb-32">
                {activeTab === 'published' && renderBlogGrid(blogs, "ZERO AUTHORED ARTIFACTS DETECTED.")}
                {activeTab === 'favorites' && renderBlogGrid(favorites, "SAVED KNOWLEDGE ARCHIVE EMPTY.")}
            </div>
        </div>
    );
}
