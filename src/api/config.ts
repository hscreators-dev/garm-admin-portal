// Base URL of the real Garm Admin backend (server/ folder — see server/README.md).
// Override with VITE_API_URL in a .env file if the backend runs somewhere else.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
