# Architecture

This document describes the system design, request flow, and key engineering decisions for the E-Shop full-stack e-commerce platform. It is intended for maintainers and contributors who need to understand how the pieces fit together before making non-trivial changes.

## High-level diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend (Vite SPA)                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │  React  │  │  Redux  │  │ Router  │  │  i18n   │  │ Currency │  │
│  │   19    │  │ Toolkit │  │   7     │  │ EN/HI   │  │ Context  │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └─────────┘  └─────────┘  │
│       └───────────┴───────────┘                                   │
│                    │ Axios (token refresh + failed-request queue) │
└────────────────────┼───────────────────────────────────────────────┘
                     │ HTTP /api/
┌────────────────────┼───────────────────────────────────────────────┐
│                 Backend (Express 4 + TypeScript)                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │  Auth   │  │ Products│  │  Orders │  │ Seller  │  │ Payments│   │
│  │  middw  │  │ service │  │ service │  │ service │  │ service │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
│       └───────────┴───────────┴───────────┴───────────┘            │
│                          │                                         │
│                 ┌────────┴────────┐                                 │
│                 │  Mongoose 8     │                                │
│                 │  (25 models)    │                                │
│                 └────────┬────────┘                                 │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                  ┌────────┴────────┐
                  │   MongoDB 7       │
                  │  (Replica Set)    │
                  └───────────────────┘
```

## Layers

### Frontend

- **UI**: React 19 components, organized by feature under `src/components` and `src/pages`.
- **State**: Redux Toolkit slices (`auth`, `cart`, `products`, `wishlist`, `compare`). Server state is fetched via an Axios client that handles token refresh and a failed-request queue.
- **Routing**: React Router 7 with route-level code splitting (`React.lazy` + `Suspense`). Admin routes are intentionally rendered outside the public `Layout` so they get a full-screen canvas.
- **Internationalization**: `react-i18next` with English (`en`) and Hindi (`hi`) locale packs under `src/i18n/locales`. The active language persists to `localStorage`.
- **Currency**: `CurrencyContext` exposes the active currency, a `formatPrice` helper, and a setter. Prices are stored in USD across the catalog and backend; conversion happens only at display time so cart math stays exact. The active currency persists to `localStorage`.
- **Motion**: A `useScrollReveal` hook (IntersectionObserver) plus a `<Reveal>` component provide scroll-triggered entrances. A `<PageTransition>` wrapper fades the page in on every route change. All motion is disabled under `prefers-reduced-motion` via a media query in `index.css`.

### Backend

- **HTTP layer**: Express 4 withHelmet security headers, CORS allowlist, and tiered rate limiting (auth, general API, sensitive endpoints).
- **Middleware pipeline**: `reqId` (UUID per request) → `requestLogger` (pino) → `responseTime` → `auth` → route handler → `errorHandler`. Every response carries `X-Request-Id`, `X-Response-Time`, and `X-API-Version`.
- **Business logic**: Services (`src/services`) own the business rules; controllers (`src/controllers`) only translate HTTP ↔ service calls. This keeps routes thin and services testable in isolation.
- **Data**: Mongoose 8 with 25 models. MongoDB must run as a replica set because order creation and returns use multi-document transactions.
- **Background work**: `node-cron` runs periodic cleanup of inventory reservations (TTL) and expired sessions. (A future migration to BullMQ + Redis is tracked in issue #1.)

## Request flow — example: checkout

1. Frontend `Checkout` page collects shipping address, payment method, and coupon.
2. `POST /api/orders` is sent with an `Idempotency-Key` header (generated client-side).
3. Backend `idempotency` middleware checks the `IdempotencyRecord` collection — if the key was seen, the cached response is replayed.
4. `orderService.createOrder` opens a MongoDB transaction:
   - re-reads product prices from the DB (never trusts client prices),
   - decrements stock atomically,
   - creates the `Order` document,
   - releases any held `Reservation`.
5. For Stripe payments, a checkout session is created and returned. On webhook, `ProcessedWebhookEvent` deduplicates by event ID before updating order status.
6. The transaction commits (or rolls back) and the response is cached against the idempotency key.

## Key engineering decisions

- **Session-backed JWT auth.** Access and refresh tokens are stored server-side in a `Session` collection, enabling revocation. Device fingerprint and IP-consistency checks add defense against token theft.
- **MongoDB transactions for order creation and returns.** Atomic stock decrement + refund prevents overselling and double-refunds.
- **Inventory reservations with optimistic concurrency + TTL cleanup.** Stock is held during checkout so two users cannot check out the last item simultaneously; the cron job releases stale reservations.
- **Soft deletes on products.** A `deletedAt` field plus pre-find hooks means deleted products stay out of results without losing historical order references.
- **Money rounding via `Math.round((v + EPSILON) * 100) / 100`.** Avoids float drift in price math.
- **Stripe webhook verification rejects if `STRIPE_WEBHOOK_SECRET` is unset.** Prevents accidental insecure deployments.
- **Idempotency keys on `POST /api/orders`.** Prevents duplicate orders from double-submits or network retries.
- **Cursor pagination.** O(1) deep pages vs O(n) offset skip — important for large catalogs.
- **Optional Redis cache with fail-open pattern.** The cache is a no-op when Redis is absent, so local dev works without it.
- **API versioning via `/api/v1/`.** Backward-compatible changes stay on v1; breaking changes ship under v2.

## Observability

- Every response includes `X-Request-Id`, `X-Response-Time`, and `X-API-Version` headers.
- Structured logs via `pino` carry the request ID for log correlation.
- `ENTERPRISE_AUDIT.md` contains a 20-phase audit of the codebase against enterprise-readiness criteria.

## Deployment

- `docker-compose.yml` brings up MongoDB (replica set), the backend (multi-stage, distroless, non-root), and the frontend (nginx static serve).
- The frontend Dockerfile builds the Vite bundle and serves it via nginx with the SPA fallback and gzip/brotli enabled.
- The backend Dockerfile is multi-stage: build with `tsc`, runtime image is distroless and runs as a non-root user.

## Extending the platform

- **Adding a currency**: append to `CURRENCIES` in `frontend/src/context/CurrencyContext.tsx`. The switcher, formatter, and persistence pick it up automatically.
- **Adding a language**: create `frontend/src/i18n/locales/<code>.json`, import it in `frontend/src/i18n/index.ts`, and add it to the `resources` map.
- **Adding an API route**: create a route file under `backend/src/routes`, register it in `backend/src/config/routes.ts`, and add a controller + service pair.

## Optional infrastructure (BullMQ, Typesense, Qdrant, Stripe Connect)

The platform ships with four optional infrastructure backends. All four are **fail-open**: if their env vars are unset or the service is unreachable, the system degrades gracefully to the existing MongoDB-based paths. This keeps local dev simple (no Redis / Typesense / Qdrant / OpenAI needed) while letting production deployments switch each on independently.

### BullMQ + Redis (job queue)

- **Purpose**: decouples background work (reservation TTL cleanup, email sends, search indexing, embedding generation) from the request path.
- **Config**: `REDIS_URL`. If unset, the queue is a no-op and jobs run inline (or, for reservation cleanup, fall back to the node-cron schedule).
- **Code**: `backend/src/queue/` — `connection.ts` (Redis client), `queues.ts` (queue + enqueue helper), `workers.ts` (worker startup + graceful shutdown), `jobs/` (per-queue handlers).
- **Startup**: `server.ts` calls `startWorkers()` + schedules the reservation-cleanup repeatable job on startup; `SIGTERM`/`SIGINT` close workers + Redis.

### Typesense (semantic search)

- **Purpose**: typo-tolerant, faceted full-text search replacing the MongoDB prefix-regex fallback.
- **Config**: `TYPESENSE_URL` + `TYPESENSE_API_KEY`.
- **Code**: `backend/src/services/typesenseService.ts` — `ensureCollection()`, `upsertProduct()`, `deleteDocument()`, `search()`, `reindexAll()`.
- **Indexing**: product create/update/delete enqueues a `search-index` job (via BullMQ) that syncs the Typesense document. Fail-open: if Typesense is down, the `/api/search` route falls back to the MongoDB autocomplete path.
- **Admin**: `POST /api/admin/infra/reindex/search` bulk-reindexes the catalog.

### OpenAI + Qdrant (AI recommendations)

- **Purpose**: vector-based "similar products" via OpenAI `text-embedding-3-small` embeddings + Qdrant cosine similarity.
- **Config**: `OPENAI_API_KEY` + `QDRANT_URL`.
- **Code**: `backend/src/services/recommendationService.ts` — `indexProduct()` (generate embedding + upsert into Qdrant), `getSimilar()` (vector nearest-neighbour), `reindexAll()`.
- **Indexing**: product create/update enqueues an `embedding` job. Fail-open: if OpenAI or Qdrant is unavailable, `GET /api/recommendations/similar/:id` falls back to the category-based `SearchService.getRelated()`.
- **Admin**: `POST /api/admin/infra/reindex/embeddings` bulk-reindexes.

### Stripe Connect (marketplace seller payouts)

- **Purpose**: Express-account onboarding + transfers + payouts so sellers get paid for their orders.
- **Config**: `STRIPE_SECRET_KEY` (platform key), `STRIPE_CONNECT_CLIENT_ID`, `PLATFORM_FEE_PERCENT` (default 5).
- **Code**: `backend/src/services/stripeConnectService.ts` — `createAccount()`, `getOnboardingLink()`, `getAccountStatus()`, `createTransfer()`, `createPayout()`, `listPayouts()`.
- **Model change**: `User.stripeAccountId` added (sparse index).
- **Routes**: `/api/connect/*` (seller-scoped) — create account, get onboarding link, check status, trigger/list payouts.
- **Platform fee**: `computePlatformFee(orderTotal)` returns the platform's cut; order creation should call `createTransfer(sellerStripeAccountId, orderTotal - fee, orderId)` after payment succeeds.

### Health + reindex endpoints

- `GET /api/admin/infra/health` — status of each backend (queue, typesense, qdrant).
- `POST /api/admin/infra/reindex/search` — bulk reindex Typesense.
- `POST /api/admin/infra/reindex/embeddings` — bulk reindex Qdrant.

### SSR migration (Next.js)

Deferred to a separate branch + PR series — it is a multi-week rewrite of the frontend (Vite SPA → Next.js App Router) that touches routing, data fetching, auth, i18n, and SEO. Tracked in issue #1.
