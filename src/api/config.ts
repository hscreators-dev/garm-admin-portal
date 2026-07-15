// Base URL of the real Garm Admin backend for the public deployment.
// The site is hosted on GitHub Pages, so it must target the live Render backend
// explicitly instead of falling back to localhost.
const runtimeApiBase = import.meta.env?.VITE_API_URL || 'https://garm-admin-backend.onrender.com';
export const API_BASE = runtimeApiBase;
