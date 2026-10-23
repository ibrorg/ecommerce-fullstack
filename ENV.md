# Environment variables

This document lists every environment variable the platform understands, grouped by subsystem. Variables marked **required** must be set before the backend starts; variables marked **optional** have a sensible default or activate a fail-open feature.

## Backend

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | no | `development` | Runtime mode (`development` / `production` / `test`). |
| `PORT` | no | `5000` | Backend listen port. |
| `MONGODB_URI` | yes | — | MongoDB connection string. Must point at a replica set for transactions (`?replicaSet=rs0`). |
| `CLIENT_URL` | no | `http://localhost:5173` | Frontend origin, used for CORS and Stripe Connect return URLs. |
| `CORS_ORIGINS` | no | — | Comma-separated extra allowed CORS origins. |

### Auth (JWT)

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | yes | — | 64-char hex secret for access tokens. Generate with `openssl rand -hex 32`. |
| `JWT_REFRESH_SECRET` | yes | — | Separate secret for refresh tokens. |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Access token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | no | `7d` | Refresh token lifetime. |

### BullMQ + Redis (job queue) — optional, fail-open

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_URL` | no | — | Redis connection for BullMQ. If unset, the queue is disabled and background work falls back to node-cron + inline execution. |

### Typesense (semantic search) — optional, fail-open

| Variable | Required | Default | Description |
|---|---|---|---|
| `TYPESENSE_URL` | no | — | Typesense base URL (e.g. `http://localhost:8108`). If unset, search falls back to MongoDB text search. |
| `TYPESENSE_API_KEY` | no | — | Typesense API key (must match the server's `TYPESENSE_API_KEY`). |

### OpenAI + Qdrant (AI recommendations) — optional, fail-open

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | no | — | OpenAI API key for `text-embedding-3-small` embeddings. If unset, recommendations fall back to category-based matching. |
| `QDRANT_URL` | no | — | Qdrant base URL (e.g. `http://localhost:6333`). |

### Stripe (payments + Connect marketplace)

| Variable | Required | Default | Description |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | yes | — | Platform Stripe secret key. |
| `STRIPE_WEBHOOK_SECRET` | yes | — | Stripe webhook signing secret. The webhook handler rejects requests if this is unset. |
| `STRIPE_CONNECT_CLIENT_ID` | no | — | Stripe Connect client id (for marketplace seller onboarding). Required for the `/api/connect/*` routes. |
| `PLATFORM_FEE_PERCENT` | no | `5` | Percent taken from each order as the platform fee. |

### Razorpay (UPI payments — India)

| Variable | Required | Default | Description |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | no | — | Razorpay key id. |
| `RAZORPAY_KEY_SECRET` | no | — | Razorpay key secret. |

### GST invoice (India)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SELLER_STATE` | no | `Maharashtra` | Seller's state for GST invoice split. |
| `SELLER_GSTIN` | no | — | Seller's GSTIN. |

### Email (SMTP) — optional

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMTP_HOST` | no | `smtp.gmail.com` | SMTP host. |
| `SMTP_PORT` | no | `587` | SMTP port. |
| `SMTP_USER` | no | — | SMTP username. If unset, email sending is skipped (jobs log and exit). |
| `SMTP_PASS` | no | — | SMTP password / app password. |
| `FROM_NAME` | no | `E-Shop` | Sender display name. |
| `FROM_EMAIL` | no | — | Sender email address. |

## Frontend

The frontend reads no env vars at runtime in development (Vite proxies `/api` to the backend). For production builds, set these at build time:

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | no | (same origin) | Backend API base URL. |
| `VITE_STRIPE_PUBLIC_KEY` | no | — | Stripe publishable key (for client-side Stripe.js). |

## Docker Compose

`docker-compose.yml` reads the backend variables from your shell environment. Copy `backend/.env.example` to `backend/.env` and fill in the secrets, then `docker-compose up --build` picks them up.
