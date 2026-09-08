/**
 * Runtime configuration for MEDRecords frontend.
 *
 * Served as a static asset (NOT bundled) — edit it directly on the server after
 * deployment, then reload the browser. No rebuild needed.
 *
 * The backend (gunicorn/uvicorn) binds to 127.0.0.1:8006 on the server, so it is
 * NOT reachable directly from the browser. The frontend therefore talks to the
 * API through a same-origin reverse proxy: nginx forwards /api/ -> 127.0.0.1:8006.
 *
 * Keep this as the same-origin path "/api/v1" (recommended — no CORS needed) as
 * long as nginx proxies /api/ to the backend (see nginx.conf `location /api/`).
 *
 * If instead you expose the backend on a public host:port, set the absolute URL:
 *   apiUrl: "http://10.21.191.52:8006/api/v1"
 */
window.__MEDRECORDS_CONFIG__ = {
  apiUrl: "/api/v1",
};
