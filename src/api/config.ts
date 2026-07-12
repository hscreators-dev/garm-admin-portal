// Base URL of the real Garm Admin backend (server/ folder — see server/README.md).
// Override with VITE_API_URL. Use `??` (not `||`) so an EMPTY string means
// "same origin" — i.e. call `/api/...` relative and let a reverse proxy
// (nginx in the Docker deploy) forward it to the backend. Defaults to the local
// dev backend when the var is unset.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5050';
