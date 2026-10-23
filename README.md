<div align="center">

# E-Shop — Full Stack E-Commerce Platform

![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=flat-square&logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-140%2B%20unit%20%2B%20E2E-success?style=flat-square)
![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=flat-square)

A production-ready, three-sided e-commerce marketplace with buyer, seller, and admin flows. Built with React 19 + Vite + Express + MongoDB — no external services required to run locally.

[Features](#-features) · [Tech Stack](#-tech-stack) · [Quick Start](#-quick-start) · [Architecture](./ARCHITECTURE.md) · [Env Vars](./ENV.md) · [API Reference](#-api-reference) · [Contributing](./CONTRIBUTING.md)

</div>

---

## Overview

E-Shop is a full-stack e-commerce marketplace where:

- **Buyers** browse products, compare side-by-side, read reviews with photos, check out via Stripe / Razorpay / COD, track orders, request returns, and download GST invoices.
- **Sellers** register a store, list products, manage orders, and track earnings.
- **Admins** view analytics dashboards, verify sellers, and manage products, orders, users, coupons, and returns.

---

## Features

### Buyer experience

| Feature | Description |
|---------|-------------|
| **Advanced search** | Full-text search with autocomplete suggestions |
| **Smart filtering** | Filter by price, brand, rating, and badges (Sale / New / Top Rated / Bestseller / Low Stock), with in-stock toggle — all URL-synced and shareable |
| **Sorting** | 5 modes: newest, oldest, price asc/desc, top rated |
| **Product comparison** | Compare up to 4 products side-by-side with best-value highlighting |
| **Quick view** | Preview products in a modal without leaving the catalog |
| **Image zoom** | Hover-to-magnify + fullscreen lightbox on product images |
| **Reviews** | Photos, helpful votes (one per user), verified-purchase badges, seller replies |
| **Wishlist** | Save products for later with cross-device sync |
| **Smart cart** | Server-side sync, guest merge, undo-on-remove, free-shipping progress |
| **Multi-payment** | Stripe (checkout sessions), Razorpay UPI (timing-safe verification), Cash on Delivery |
| **Order tracking** | Status timeline (pending → processing → shipped → delivered) |
| **GST invoices** | PDF invoices with CGST / SGST / IGST split |
| **Returns** | Request returns with Stripe refund + stock reversal in a transaction |
| **Address book** | Multiple saved addresses with default shipping / billing |
| **Multi-currency** | Live currency switcher (USD, EUR, GBP, INR, JPY, AED, AUD, CAD) with locale-aware formatting — applied across product cards, product detail, cart, checkout, wishlist, and order history. Persisted per user. |
| **Dark mode** | Class-based, anti-FOUC, system preference detection |
| **Internationalization** | English + Hindi with instant language switcher |
| **PWA** | Installable on mobile with manifest + theme color |

### Seller experience

| Feature | Description |
|---------|-------------|
| **Store registration** | Seller onboarding with admin verification |
| **Product management** | Create, edit, delete products with images |
| **Seller dashboard** | Revenue, orders, and product stats |
| **Order management** | View and update order statuses |

### Admin experience

| Feature | Description |
|---------|-------------|
| **Analytics dashboard** | Revenue charts, order-status breakdown, top products |
| **Seller verification** | Approve / reject seller applications |
| **Product management** | Full CRUD on all products |
| **Order management** | View all orders, update statuses |
| **User management** | View, search, manage users |
| **Coupon system** | Create percentage / flat coupons with usage limits |
| **Returns management** | Process return requests with refund tracking |

### Performance, accessibility & DX

| Feature | Description |
|---------|-------------|
| **Code splitting** | Route-level lazy loading + vendor chunk splitting (react-vendor, app-vendor, icons) |
| **Skeleton loaders** | Every page has layout-matching skeletons (no spinners) |
| **Toast notifications** | Rich toasts with undo actions for cart / wishlist |
| **Keyboard shortcuts** | Press `/` to focus search |
| **Infinite scroll** | Plus an explicit "Load More" button for accessibility |
| **Debounced search** | 350 ms debounce prevents API spam |
| **Error recovery** | `ErrorState` component with retry on every API-dependent surface |
| **Back to top** | Floating button appears on scroll |
| **Design system** | Consistent neutral palette, spacing rhythm, Inter font |
| **Motion design** | Scroll-reveal sections, staggered card entrances, route-change transitions, animated nav underline — all disabled under `prefers-reduced-motion` |
| **Accessibility** | Skip-to-content link, focus traps, ARIA labels, reduced-motion support |

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| Vite | 7 | Build tool + dev server |
| TypeScript | 5.8 | Type safety |
| Redux Toolkit | 2 | State management |
| React Router | 7 | Routing |
| Tailwind CSS | 4 | Styling |
| react-hook-form + zod | — | Forms + validation |
| react-hot-toast | 2 | Notifications |
| react-i18next | — | Internationalization (EN / HI) |
| recharts | 3 | Charts |
| Playwright | 1.48 | End-to-end tests |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 22 | Runtime |
| Express | 4 | Web framework |
| TypeScript | 5.3 | Type safety |
| MongoDB | 7 | Database |
| Mongoose | 8 | ODM |
| Stripe | 14 | Payment processing |
| Razorpay | — | UPI payments (India) |
| Helmet | 7 | Security headers |
| pino | 8 | Structured logging |
| PDFKit | — | Invoice generation |
| node-cron | — | Background jobs |

---

## Quick Start

### Prerequisites

- Node.js 22+
- MongoDB 7+ (or use Docker Compose)
- npm or bun

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/ibrorg/ecommerce-fullstack.git
cd ecommerce-fullstack

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env: MONGO_URI, JWT secrets, Stripe keys

docker-compose up --build
# Frontend:  http://localhost:5173
# Backend:   http://localhost:5000
# API docs:  http://localhost:5000/api-docs
```

### Option B — Manual dev servers

```bash
git clone https://github.com/ibrorg/ecommerce-fullstack.git
cd ecommerce-fullstack

# Install
(cd backend  && npm install)
(cd frontend && npm install)

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env: MONGO_URI, JWT secrets, Stripe keys

# Terminal 1 — backend (port 5000)
cd backend && npm run dev

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

---

## API Reference

### Base URL

```
Development: http://localhost:5000/api
Versioned:   http://localhost:5000/api/v1
```

### Key endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login | Public |
| GET | `/api/auth/me` | Get current user | Private |
| GET | `/api/products` | List products (filter, sort, paginate) | Public |
| GET | `/api/products/:id` | Get product detail | Public |
| POST | `/api/products/:id/reviews` | Add review | Private |
| POST | `/api/products/:id/reviews/:reviewId/vote` | Vote review helpful | Private |
| POST | `/api/products/:id/reviews/:reviewId/reply` | Seller reply | Seller / Admin |
| GET | `/api/products/bulk?ids=` | Fetch by IDs (recently viewed) | Public |
| GET | `/api/products/compare?ids=` | Fetch for comparison | Public |
| GET | `/api/products?cursor=` | Cursor pagination | Public |
| POST | `/api/orders` | Create order (Idempotency-Key supported) | Private |
| GET | `/api/orders/myorders` | Get user's orders | Private |
| PUT | `/api/orders/:id/status` | Update order status | Admin |
| POST | `/api/coupons/validate` | Validate coupon code | Private |
| GET | `/api/addresses` | List saved addresses | Private |
| POST | `/api/addresses` | Create address | Private |
| GET | `/api/wishlist` | Get wishlist | Private |
| GET | `/api/cart` | Get server cart | Private |

### Response format

```json
// Success
{ "success": true, "data": {}, "message": "..." }

// Error
{ "success": false, "message": "...", "error": { "code": "ERROR_CODE" } }
```

### Custom headers

| Header | Direction | Description |
|--------|-----------|-------------|
| `X-Request-Id` | Response | UUID for log correlation |
| `X-Response-Time` | Response | Request processing time (ms) |
| `X-API-Version` | Response | API version (1.0.0) |
| `Idempotency-Key` | Request | Prevents duplicate order creation |
| `Cache-Control` | Response | `public, max-age=60, stale-while-revalidate=300` on product list |

---

## Database

The backend uses 25 Mongoose models. The most important:

```
User.ts          — buyer / seller / admin with seller profile, capabilities, sessions
Product.ts       — catalog with reviews (photos, helpfulVotes, sellerReply), badges
Order.ts         — orders with items, shipping, payment, GST, status timeline
Coupon.ts        — percentage / flat coupons with usage limits
Store.ts         — seller store profiles
Address.ts       — multi-address with default shipping / billing
Wishlist.ts      — saved products per user
Cart.ts          — server-side cart
Reservation.ts   — inventory reservations (TTL)
ReturnRequest.ts — return / refund requests
Session.ts       — JWT sessions (revocable)
IdempotencyRecord.ts — idempotency key cache (TTL)
ProcessedWebhookEvent.ts — Stripe webhook dedup
```

### Key indexes

```javascript
Product:  { slug: 1 }, { name: 'text', description: 'text', tags: 'text' },
          { isActive: 1, deletedAt: 1, category: 1, price: 1 }, { brand: 1 }
Order:    { user: 1, createdAt: -1 }, { orderStatus: 1, createdAt: -1 }
```

---

## Security

| Feature | Implementation |
|---------|---------------|
| Password hashing | argon2id (via `argon2`) |
| JWT | Access + refresh tokens, session-backed (revocable) |
| Session security | Device fingerprint + IP consistency checks |
| Rate limiting | Tiered: auth (5 / 15min), API (150 / 15min), sensitive (10 / hr) |
| Security headers | Helmet: CSP, HSTS, X-Frame-Options, Permissions-Policy, Referrer-Policy |
| CORS | Origin allowlist, preflight cache (24h) |
| Input validation | express-validator + zod |
| NoSQL injection | Mongoose parametrized queries, no raw `$where` |
| Webhook security | Stripe + Razorpay signature verification (timing-safe) |
| Money safety | Server-side price recalculation, transactional stock decrement |
| Idempotency | `POST /orders` supports `Idempotency-Key` header |

---

## Testing

| Suite | Framework | Scope |
|-------|-----------|-------|
| Backend unit / integration | Jest | Product, Order, Auth, Cart, Coupon, Address, Search, Wishlist, Notifications |
| Frontend unit | Vitest | Components (ErrorState, ProductBadges, NotFound, Breadcrumbs, ScrollToTop, BackToTop), Hooks (useRecentlyViewed, useDebounce, useDocumentMeta, useFocusTrap, useTheme), Store (compareSlice, authSlice, cartSlice) |
| End-to-end | Playwright | Smoke suite (home, navigation, currency switcher, products page, 404) across Chromium, WebKit, and mobile viewports |

```bash
# Backend tests
cd backend && npx jest --detectOpenHandles --forceExit

# Frontend unit tests
cd frontend && npx vitest run

# End-to-end tests (requires the dev server or docker-compose stack running)
cd frontend
npx playwright install --with-deps     # one-time browser install
npx playwright test                     # run the smoke suite
npx playwright test --ui                # interactive mode
npx playwright test --reporter=html     # HTML report
```

---

## Project Structure

```
ecommerce-fullstack/
├── backend/
│   ├── src/
│   │   ├── config/          # database, middleware, rate limits, routes, swagger
│   │   ├── controllers/     # request handlers (auth, product, order, search)
│   │   ├── middleware/      # auth, errorHandler, reqId, requestLogger, responseTime, idempotency
│   │   ├── models/         # 25 Mongoose models
│   │   ├── routes/         # 20 route files
│   │   ├── services/       # business logic (26 services)
│   │   ├── utils/          # logger, cache, response, crypto
│   │   └── server.ts       # entry point
│   ├── tests/              # Jest test suites
│   └── Dockerfile          # multi-stage, distroless, non-root
├── frontend/
│   ├── src/
│   │   ├── components/     # React components (Layout, Product, Cart, etc.)
│   │   ├── context/        # ConfigContext, CurrencyContext
│   │   ├── hooks/          # useTheme, useRecentlyViewed, useDocumentMeta, useFocusTrap, useDebounce, useScrollReveal
│   │   ├── i18n/           # react-i18next (en, hi)
│   │   ├── pages/          # Home, Auth (Login, Register, Profile, Forgot, Reset)
│   │   ├── services/       # Axios client with token refresh
│   │   ├── store/          # Redux Toolkit slices (auth, cart, products, wishlist, compare)
│   │   └── test/           # Vitest test suites
│   ├── e2e/                # Playwright smoke suite
│   ├── playwright.config.ts
│   └── Dockerfile          # nginx static serve
├── docker-compose.yml      # mongo + backend + frontend
├── ARCHITECTURE.md         # system design + key decisions
├── ENV.md                   # environment variables reference
├── ENTERPRISE_AUDIT.md     # 20-phase enterprise audit
├── CONTRIBUTING.md
└── README.md
```

For the full system design, request flow, and key engineering decisions, see **[ARCHITECTURE.md](./ARCHITECTURE.md)**. For the complete environment variables reference, see **[ENV.md](./ENV.md)**.

---

## Contributing

Contributions are welcome. Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the development workflow, commit conventions, and PR checklist before opening a pull request.

---

## License

**All Rights Reserved.** This is private property of [ibrorg](https://github.com/ibrorg). No license is granted. Unauthorized use, copying, modification, distribution, or commercial use is strictly prohibited.

---

<div align="center">

Maintained by the [ibrorg](https://github.com/ibrorg) organization.

</div>
