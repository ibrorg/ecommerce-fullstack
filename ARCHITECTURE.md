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
