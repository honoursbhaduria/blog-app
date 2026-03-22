import axios from 'axios';

const getBaseURL = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    return 'http://localhost:8001/api/v1/';
};

const api = axios.create({
    baseURL: getBaseURL(),
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        const url = config.url || '';
        const isAuthEndpoint =
            url.includes('auth/login/') ||
            url.includes('auth/register/') ||
            url.includes('auth/refresh/');

        if (token && !isAuthEndpoint) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
    refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
    refreshSubscribers.forEach((callback) => callback(token));
    refreshSubscribers = [];
};

const clearAuthTokens = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isAuthRefreshCall = originalRequest?.url?.includes('auth/refresh/');
        const status = error.response?.status;

        if (!originalRequest || originalRequest._retry || isAuthRefreshCall) {
            return Promise.reject(error);
        }

        const isTokenInvalid = error.response?.data?.code === 'token_not_valid';
        if (status !== 401 && !isTokenInvalid) {
            return Promise.reject(error);
        }

        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            clearAuthTokens();
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                subscribeTokenRefresh((newAccessToken) => {
                    if (!newAccessToken) {
                        reject(error);
                        return;
                    }
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    resolve(api(originalRequest));
                });
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            const response = await api.post('auth/refresh/', { refresh: refreshToken });
            const newAccessToken = response.data?.access;

            if (!newAccessToken) {
                clearAuthTokens();
                onRefreshed(null);
                return Promise.reject(error);
            }

            localStorage.setItem('access_token', newAccessToken);
            onRefreshed(newAccessToken);

            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
        } catch (refreshError) {
            clearAuthTokens();
            onRefreshed(null);
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

// Centralized API Service
export const authService = {
    login: (credentials) => api.post('auth/login/', credentials),
    register: (userData) => api.post('auth/register/', userData),
    refreshToken: (refresh) => api.post('auth/refresh/', { refresh }),
};

export const blogService = {
    getAll: (params) => api.get('blogs/posts/', { params }),
    getTrending: () => api.get('blogs/trending/'),
    getFavorites: (username) => api.get(`profiles/${username}/favorites/`),
    getById: (slug) => api.get(`blogs/posts/${slug}/`),
    create: (formData) => api.post('blogs/posts/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    update: (slug, formData) => api.patch(`blogs/posts/${slug}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    delete: (slug) => api.delete(`blogs/posts/${slug}/`),
    
    toggleLike: (slug) => api.post(`blogs/posts/${slug}/toggle_like/`),
    checkLike: (slug) => api.get(`blogs/posts/${slug}/check_like/`),
    toggleFavorite: (slug) => api.post(`blogs/posts/${slug}/toggle_favorite/`),
    checkFavorite: (slug) => api.get(`blogs/posts/${slug}/check_favorite/`),
    
    getComments: (slug) => api.get(`blogs/comments/${slug}/`),
    addComment: (slug, comment) => api.post(`blogs/comments/${slug}/`, { comment }),
    
    getCategories: () => api.get('blogs/categories/'),
    getTags: () => api.get('blogs/tags/'),
    
    searchWiki: (keyword) => api.get(`blogs/search-wiki/?keyword=${keyword}`),
    getRandomWiki: (limit = 20) => api.get('blogs/random-wiki/', { params: { limit } }),
    getWikiArticle: (title) => api.get(`blogs/wiki/${title}/`),
    
    aiExplain: (data) => api.post('blogs/ai/explain/', data),
    aiWrite: (data) => api.post('blogs/ai/write/', data),
};

export const clusterService = {
    getAll: () => api.get('blogs/clusters/'),
    getById: (id) => api.get(`blogs/clusters/${id}/`),
    create: (data) => api.post('blogs/clusters/', data),
    update: (id, data) => api.patch(`blogs/clusters/${id}/`, data),
    delete: (id) => api.delete(`blogs/clusters/${id}/`),
    chat: (id, data) => api.post(`blogs/clusters/${id}/cluster_chat/`, data),
    createBlogDraft: (id, data) => api.post(`blogs/clusters/${id}/create_blog_draft/`, data),
};

export const wikiLibraryService = {
    getAll: () => api.get('blogs/saved-wiki/'),
    save: (articleData) => api.post('blogs/saved-wiki/', articleData),
    update: (id, data) => api.patch(`blogs/saved-wiki/${id}/`, data),
    delete: (id) => api.delete(`blogs/saved-wiki/${id}/`),
    reorder: (payload) => api.post('blogs/saved-wiki/reorder/', payload),
    toggleLike: (id) => api.post(`blogs/saved-wiki/${id}/toggle_like/`),
    createBlogDraft: (id) => api.post(`blogs/saved-wiki/${id}/create_blog_draft/`),
};

export const profileService = {
    getOwnProfile: () => api.get('profiles/edit/'),
    getPublicProfile: (username) => api.get(`profiles/${username}/`),
    updateProfile: (formData, config) => api.patch('profiles/edit/', formData, config),
    getAuthoredBlogs: (username) => api.get(`profiles/${username}/blogs/`),
    searchUsers: (q) => api.get(`profiles/users/search/?q=${encodeURIComponent(q || '')}`),
    getFriends: () => api.get('profiles/friends/'),
    getFriendRequests: () => api.get('profiles/friends/requests/'),
    inviteFriend: (username) => api.post(`profiles/friends/${username}/invite/`),
    acceptFriend: (username) => api.post(`profiles/friends/${username}/accept/`),
    rejectFriend: (username) => api.post(`profiles/friends/${username}/reject/`),
    removeFriend: (username) => api.post(`profiles/friends/${username}/remove/`),
};

export const dashboardService = {
    getStats: () => api.get('blogs/stats/'),
    getUsers: () => api.get('blogs/users/'),
    createUser: (data) => api.post('blogs/users/', data),
    updateUser: (id, data) => api.patch(`blogs/users/${id}/`, data),
    deleteUser: (id) => api.delete(`blogs/users/${id}/`),
    
    getCategories: () => api.get('blogs/categories/'),
    createCategory: (data) => api.post('blogs/categories/', data),
    updateCategory: (id, data) => api.patch(`blogs/categories/${id}/`, data),
    deleteCategory: (id) => api.delete(`blogs/categories/${id}/`),
    
    getPosts: () => api.get('blogs/posts/?mine=true'),
    createPost: (formData) => api.post('blogs/posts/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    updatePost: (slug, formData) => api.patch(`blogs/posts/${slug}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    deletePost: (slug) => api.delete(`blogs/posts/${slug}/`),
};

export default api;
