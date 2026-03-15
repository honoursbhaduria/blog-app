export const getFullImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1/';
    const backendOrigin = apiBase.replace(/\/api\/v1\/?$/, '');

    if (url.startsWith('/')) {
        return `${backendOrigin}${url}`;
    }
    return url;
};
