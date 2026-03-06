ShopSphere E‑commerce — Project Overview
=====================================

This repository contains a full-stack e‑commerce application.

Folders
-------
- `backend` — Node.js + Express backend (MySQL)
- `frontend` — React + Vite frontend
- `docs` — project documentation (API reference)

Prerequisites
-------------
- Node.js (v14+)
- npm
- MySQL server running locally

Quick start
-----------
1. Create a `.env` file in `backend/` (example shown below).

2. Start backend and frontend in separate terminals.

Backend (terminal 1):

```bash
cd backend
npm install
# ensure .env is configured (see example below)
npm run dev
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Backend environment (.env.example)
----------------------------------
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=ecommerce_db
PORT=3001

Notes
-----
- The backend will attempt to create missing tables/columns on startup (lightweight migrations).
- The frontend expects the API at `http://localhost:3001/api` by default; change `frontend/src/services/api.js` if needed.
- Passwords are stored in plaintext in this development setup — do not use real credentials.

Documentation
-------------
- API reference: docs/API.md
- Frontend README: frontend/README.md


