# MEDRecords — Deployment Bundle

This folder contains a deployable snapshot of the MEDRecords application.

```
deploy/
├─ dist/        # Built React frontend (static files) — serve as-is
├─ app/         # FastAPI backend (clean-architecture `src` + legacy `app`)
├─ nginx.conf   # Reference nginx config for serving the frontend (SPA)
└─ README.md    # This file
```

---

## 1. Frontend (`dist/`)

`dist/` is a production build of the React app (Vite). It is a set of static
files — serve it with any static host or nginx.

Key points:
- Single-page app: **all routes must fall back to `index.html`** (see `nginx.conf`).
- **The API URL is runtime-configurable — no rebuild needed.** Edit
  `dist/config.js` on the server and set `apiUrl`, then reload the browser:
  ```js
  window.__MEDRECORDS_CONFIG__ = {
    apiUrl: "/api/v1",   // same-origin — nginx proxies /api/ -> 127.0.0.1:8006
  };
  ```
  It currently points to the same-origin path `/api/v1`. The backend binds to
  `127.0.0.1:8006` (loopback only) and is reached through the nginx `/api/`
  reverse proxy, so no CORS is needed and the browser never hits the backend
  port directly. `config.js` is loaded before the app bundle. If it's unset, the
  app falls back to the build-time `VITE_API_URL`.

### Serve with nginx
Copy `dist/` to the nginx web root and use the provided `nginx.conf`:
```
cp -r dist/* /usr/share/nginx/html/
cp nginx.conf /etc/nginx/nginx.conf
nginx -s reload
```

### Quick local preview (no nginx)
```
npx serve -s dist          # or: python -m http.server --directory dist 8080
```

---

## 2. Backend (`app/`)

FastAPI service. The active app is `src.main:app` (clean architecture); the
legacy `app.main:app` is included for reference.

### Install
```
cd app
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

### Configure
Create a `.env` in `app/` (or set environment variables). Defaults live in
`app/src/config/settings.py`. Typical values:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medrecords
DB_USER=postgres
DB_PASSWORD=<your-password>
SECRET_KEY=<a-strong-random-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Database migrations
```
alembic upgrade head
```

### Seed reference data (optional, first run)
```
python seed.py
python seed_analytics_data.py   # optional demo analytics data
```

### Run
On the server the backend runs under systemd (service `medrecords-backend`)
via gunicorn+uvicorn workers bound to `127.0.0.1:8006` (loopback only). Manage
it with:
```
sudo systemctl restart medrecords-backend
sudo systemctl status medrecords-backend
```
For local/manual runs:
```
python run.py --host 127.0.0.1 --port 8006          # production-like (src.main)
python run.py --dev --port 8006                      # dev with auto-reload
# or directly:
uvicorn src.main:app --host 127.0.0.1 --port 8006
```

---

## 3. Wiring frontend ↔ backend  (IMPORTANT — this is what blocked login)

The current server uses a **same-origin nginx reverse proxy**, which is the
recommended setup and avoids CORS entirely:

- Frontend served at `http://10.21.191.52:8083`
- nginx proxies `/api/` → `127.0.0.1:8006` (see `nginx.conf` `location /api/`)
- `dist/config.js` → `apiUrl: "/api/v1"` (same-origin path)
- Backend binds loopback only: `127.0.0.1:8006` (systemd `medrecords-backend`)

Because the API is same-origin, **no CORS config is required**. The backend's
`ALLOWED_ORIGINS` only matters if you expose the backend on a public host:port
and point `config.js` at an absolute URL. In that case set it to the exact
origin serving the frontend:
```
ALLOWED_ORIGINS=http://10.21.191.52:8083
```
(Accepts a comma-separated list or a JSON array; origin must match
scheme + host + port exactly.)

## Notes on this build
- Auth token is persisted to `sessionStorage` (survives reload, tab-scoped).
- There is no `/auth/refresh` endpoint; sessions end at token expiry
  (`ACCESS_TOKEN_EXPIRE_MINUTES`) or when the tab closes.
