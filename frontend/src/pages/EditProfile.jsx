import { useState, useEffect } from 'react';
import { profileService, dashboardService } from '../services/api';
import { User, AtSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFullImageUrl } from '../utils/helpers';

export default function EditProfile() {
    const [profile, setProfile] = useState({
        user: { id: '', first_name: '', last_name: '' },
        about: '',
        phone: '',
        github_handle: '',
        linkedin_handle: '',
        facebook_link: '',
        twitter_link: '',
        instagram_link: '',
        youtube_link: '',
        current_role: 'Developer',
        company: '',
        university: '',
        degree: '',
        field_of_study: '',
        years_of_experience: 0,
        open_to_opportunities: false,
        location: '',
        website: '',
        public_email: '',
        profile_image: null,
        profile_banner: null
    });
    const [imageFile, setImageFile] = useState(null);
    const [bannerFile, setBannerFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await profileService.getOwnProfile();
                setProfile({
                    ...res.data,
                    user: res.data.user || { id: '', first_name: '', last_name: '' },
                    about: res.data.about || '',
                    phone: res.data.phone || '',
                    github_handle: res.data.github_handle || '',
                    linkedin_handle: res.data.linkedin_handle || '',
                    facebook_link: res.data.facebook_link || '',
                    twitter_link: res.data.twitter_link || '',
                    instagram_link: res.data.instagram_link || '',
                    youtube_link: res.data.youtube_link || '',
                    current_role: res.data.current_role || 'Developer',
                    company: res.data.company || '',
                    university: res.data.university || '',
                    degree: res.data.degree || '',
                    field_of_study: res.data.field_of_study || '',
                    years_of_experience: res.data.years_of_experience || 0,
                    open_to_opportunities: res.data.open_to_opportunities || false,
                    location: res.data.location || '',
                    website: res.data.website || '',
                    public_email: res.data.public_email || ''
                });
            } catch (error) {
                console.error("Failed to fetch profile", error);
                if (error.response?.status === 401) {
                    navigate('/login');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [navigate]);

    const handleFileChange = (e) => {
        if (e.target.name === 'profile_image') setImageFile(e.target.files[0]);
        if (e.target.name === 'profile_banner') setBannerFile(e.target.files[0]);
    };

    const handleNestedChange = (e) => {
        setProfile(prev => ({
            ...prev,
            user: { ...prev.user, [e.target.name]: e.target.value }
        }));
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setProfile(prev => ({ ...prev, [e.target.name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        const formData = new FormData();
        if (imageFile) formData.append('profile_image', imageFile);
        if (bannerFile) formData.append('profile_banner', bannerFile);
        
        formData.append('about', profile.about);
        formData.append('phone', profile.phone);
        formData.append('github_handle', profile.github_handle);
        formData.append('linkedin_handle', profile.linkedin_handle);
        formData.append('facebook_link', profile.facebook_link);
        formData.append('twitter_link', profile.twitter_link);
        formData.append('instagram_link', profile.instagram_link);
        formData.append('youtube_link', profile.youtube_link);
        
        formData.append('current_role', profile.current_role);
        formData.append('company', profile.company);
        formData.append('university', profile.university);
        formData.append('degree', profile.degree);
        formData.append('field_of_study', profile.field_of_study);
        formData.append('years_of_experience', profile.years_of_experience);
        formData.append('open_to_opportunities', profile.open_to_opportunities);
        formData.append('location', profile.location);
        formData.append('website', profile.website);
        formData.append('public_email', profile.public_email || '');

        const config = (imageFile || bannerFile) ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};

        try {
            await profileService.updateProfile(formData, config);
            if (profile.user.id) {
                await dashboardService.updateUser(profile.user.id, {
                    first_name: profile.user.first_name,
                    last_name: profile.user.last_name
                });
            }
            alert("Identity updated successfully!");
        } catch (error) {
            console.error("Failed to save profile", error);
            alert("Failed to save profile.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 font-display font-bold uppercase tracking-widest text-canvas-coral animate-pulse">Loading Identity Data...</div>;

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 mb-20">
            <div className="brutal-border border-4 border-canvas-dark bg-white shadow-[12px_12px_0px_0px_rgba(28,28,28,1)] overflow-hidden">
                {/* Header */}
                <div className="px-8 py-6 border-b-4 border-canvas-dark bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">Configure Identity</h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-canvas-coral mt-1">Advanced Profile System</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-12">

                    {/* Banner Section */}
                    <div>
                        <h3 className="text-xl font-display font-black text-canvas-dark uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest">01</span>
                            Visual Branding
                        </h3>
                        <div className="space-y-6">
                            <div className="relative w-full h-48 brutal-border border-4 border-canvas-dark bg-canvas-light overflow-hidden">
                                {bannerFile ? (
                                    <img src={URL.createObjectURL(bannerFile)} alt="Banner Preview" className="w-full h-full object-cover" />
                                ) : profile.profile_banner ? (
                                    <img src={getFullImageUrl(profile.profile_banner)} alt="Current Banner" className="w-full h-full object-cover grayscale" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center opacity-10" style={{ backgroundImage: 'radial-gradient(#1C1C1C 2px, transparent 2px)', backgroundSize: '20px 20px' }}></div>
                                )}
                                <div className="absolute bottom-4 right-4">
                                    <label className="bg-white px-4 py-2 brutal-border border-2 border-canvas-dark text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-canvas-dark hover:text-white transition-colors">
                                        Upload Banner
                                        <input type="file" name="profile_banner" accept="image/*" onChange={handleFileChange} className="hidden" />
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="relative w-32 h-32 brutal-border border-4 border-canvas-dark overflow-hidden bg-white flex items-center justify-center shadow-[6px_6px_0px_0px_rgba(224,106,89,1)]">
                                    {imageFile ? (
                                        <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                                    ) : profile.profile_image ? (
                                        <img src={getFullImageUrl(profile.profile_image)} alt="Avatar" className="w-full h-full object-cover grayscale" />
                                    ) : (
                                        <User className="text-gray-400" size={48} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-3">Profile Photo</label>
                                    <input type="file" name="profile_image" accept="image/*" onChange={handleFileChange} className="text-xs font-bold uppercase tracking-widest text-gray-500 file:mr-4 file:py-2 file:px-4 file:bg-canvas-dark file:text-white file:border-0 file:font-black file:uppercase file:text-[10px] file:cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Personal Details */}
                    <div>
                        <h3 className="text-xl font-display font-black text-canvas-dark uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-canvas-coral text-white text-[10px] font-bold uppercase tracking-widest">02</span>
                            Core Identity
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Username / Handle</label>
                                <div className="w-full px-4 py-3 bg-gray-100 brutal-border border-2 border-canvas-dark font-bold uppercase text-xs tracking-widest text-gray-600 flex items-center gap-2">
                                    <AtSign size={14} /> {profile.user.username}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">First Name</label>
                                <input type="text" name="first_name" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={profile.user.first_name} onChange={handleNestedChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Last Name</label>
                                <input type="text" name="last_name" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={profile.user.last_name} onChange={handleNestedChange} />
                            </div>
                        </div>
                        <div className="mt-6">
                            <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">About Me</label>
                            <textarea name="about" rows="4" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark focus:outline-none focus:border-canvas-coral font-medium" value={profile.about} onChange={handleChange} />
                        </div>
                    </div>

                    {/* Professional Details */}
                    <div>
                        <h3 className="text-xl font-display font-black text-canvas-dark uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest">03</span>
                            Professional Node
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Current Role</label>
                                <select name="current_role" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark text-xs font-bold uppercase" value={profile.current_role} onChange={handleChange}>
                                    <option value="Student">Student</option>
                                    <option value="Developer">Developer</option>
                                    <option value="Researcher">Researcher</option>
                                    <option value="Engineer">Engineer</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Organization / Company</label>
                                <input type="text" name="company" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark focus:outline-none" value={profile.company} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Years of Exp</label>
                                <input type="number" name="years_of_experience" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.years_of_experience} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Location</label>
                                <input type="text" name="location" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.location} onChange={handleChange} placeholder="e.g. San Francisco, CA" />
                            </div>
                        </div>
                        <div className="mt-6 p-4 bg-canvas-dark text-white brutal-border border-2 border-canvas-dark flex items-center justify-between">
                            <span className="text-[10px] font-display font-black uppercase tracking-widest">Open to New Opportunities</span>
                            <input type="checkbox" name="open_to_opportunities" className="w-6 h-6 text-canvas-coral bg-transparent border-white focus:ring-canvas-coral" checked={profile.open_to_opportunities} onChange={handleChange} />
                        </div>
                    </div>

                    {/* Academic History */}
                    <div>
                        <h3 className="text-xl font-display font-black text-canvas-dark uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-canvas-coral text-white text-[10px] font-bold uppercase tracking-widest">04</span>
                            Academic History
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">University</label>
                                <input type="text" name="university" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.university} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Degree</label>
                                <input type="text" name="degree" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.degree} onChange={handleChange} placeholder="e.g. Bachelor of Science" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Field of Study</label>
                                <input type="text" name="field_of_study" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.field_of_study} onChange={handleChange} placeholder="e.g. Computer Science" />
                            </div>
                        </div>
                    </div>

                    {/* Links & Socials */}
                    <div>
                        <h3 className="text-xl font-display font-black text-canvas-dark uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-canvas-dark text-white text-[10px] font-bold uppercase tracking-widest">05</span>
                            Digital Connectivity
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Website</label>
                                <input type="url" name="website" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.website} onChange={handleChange} placeholder="https://..." />
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Public Email (Optional)</label>
                                <input type="email" name="public_email" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.public_email} onChange={handleChange} placeholder="name@example.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">GitHub</label>
                                <input type="text" name="github_handle" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.github_handle} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">LinkedIn</label>
                                <input type="text" name="linkedin_handle" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.linkedin_handle} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-display font-black uppercase tracking-widest text-canvas-dark mb-2">Phone</label>
                                <input type="text" name="phone" className="w-full px-4 py-3 bg-canvas-light brutal-border border-2 border-canvas-dark" value={profile.phone} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="pt-6 border-t-4 border-canvas-dark flex justify-end">
                        <button type="submit" disabled={saving} className={`px-10 py-4 bg-canvas-coral text-white font-display font-black uppercase text-xs tracking-[0.2em] brutal-border border-2 border-canvas-dark shadow-[6px_6px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                            {saving ? 'Syncing...' : 'COMMIT IDENTITY'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
