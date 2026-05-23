# Deployment Guide: LeetCode Profile Analyzer SaaS

## 1. Environment Requirements
Create `.env` files for both frontend and backend.

### Backend (`/backend/.env`)
```env
# Change for production
API_V1_STR=/api/v1
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
REDIS_URL=rediss://default:password@host:port
GEMINI_API_KEY=your_gemini_api_key
```

### Frontend (`/frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com/api/v1
```

---

## 2. Infrastructure Setup
1. **Database:** Go to [Supabase](https://supabase.com/) or [Neon](https://neon.tech/), create a new Postgres database, and copy the Connection URI.
2. **Cache:** Go to [Upstash](https://upstash.com/), create a Redis database, and copy the Node connection string.
3. **AI:** Go to [Google AI Studio](https://aistudio.google.com/), generate an API Key.

---

## 3. Backend Deployment (Render or Railway)
1. Push the `/backend` directory to a GitHub repository.
2. Create a new "Web Service" in Render.
3. Configuration:
   - **Environment:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add the `DATABASE_URL`, `REDIS_URL`, and `GEMINI_API_KEY` to the environment variables section in the Render Dashboard.

---

## 4. Frontend Deployment (Vercel)

This repo is a monorepo (`frontend/` + `backend/`). Use **one** of these setups:

### Option A — Recommended (simplest)
1. Import the GitHub repo in [Vercel](https://vercel.com/).
2. **Root Directory:** `frontend`
3. **Build Command:** leave default (`next build`) or `npm run vercel-build`
4. **Install Command:** leave default (`npm install`)
5. Add `NEXT_PUBLIC_API_URL` (your Render backend URL + `/api/v1`).
6. Deploy.

### Option B — Deploy from repository root
If Root Directory is `.` (repo root), the included `vercel.json` runs the build in `frontend/` and copies `.next` to the root for Vercel’s Next.js builder. Do **not** set a custom Output Directory in the Vercel dashboard.

1. Root Directory: `.` (default)
2. Build Command: `npm run vercel-build` (or leave empty to use `vercel.json`)
3. Add `NEXT_PUBLIC_API_URL` as above.
4. Deploy.

## 5. Scaling Considerations
- Redis ensures we don't hit LeetCode API rate limits. Monitor its memory.
- PostgreSQL connections should be pooled via Supavisor (Supabase) if scaling past a few hundred concurrent users.
- FastAPI async handles concurrent requests perfectly without blocking.
