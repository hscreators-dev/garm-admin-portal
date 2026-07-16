// Which admin backend the portal talks to.
// Priority:
//   1. VITE_API_URL if explicitly set (production builds set this on Render /
//      GitHub Pages to the live backend).
//   2. Otherwise, if the page is being served from localhost (local dev), talk
//      to the LOCAL admin backend on :5050 — previously this fell back to the
//      live Render backend, so local sign-in hit production (CORS-blocked from
//      localhost + cold starts) and appeared broken.
//   3. Otherwise (hosted with no env set), the live Render backend.
// Hostname-based rather than import.meta.env.DEV so it's robust even if NODE_ENV
// is set in an .env file.
const isLocalhost =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

const runtimeApiBase =
  import.meta.env?.VITE_API_URL ||
  (isLocalhost ? 'http://localhost:5050' : 'https://garm-admin-backend.onrender.com');

export const API_BASE = runtimeApiBase;
