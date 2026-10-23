<div align="center">

# 🛒 E-Shop — Full Stack E-Commerce Platform

![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-140%2B%20passing-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=for-the-badge)

### A production-ready, three-sided e-commerce marketplace with buyer, seller, and admin flows.

[Features](#-features) · [Tech Stack](#-tech-stack) · [Quick Start](#-quick-start) · [Screenshots](#-screenshots) · [Architecture](#-architecture) · [API](#-api-reference)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Screenshots](#-screenshots)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Security](#-security)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

A full-stack e-commerce marketplace where:

- **🛍️ Buyers** browse products, compare side-by-side, read reviews with photos, checkout via Stripe/Razorpay/COD, track orders, request returns, download GST invoices
- **🏪 Sellers** register a store, list products, manage orders, track earnings
- **🔧 Admins** view analytics dashboards, verify sellers, manage products/orders/users/coupons/returns

Built with **React 19 + Vite + Express + MongoDB** — no external services required.

---

## ✨ Features

### 🛍️ Buyer Experience
| Feature | Description |
|---------|-------------|
| 🔍 **Advanced Search** | Full-text search with autocomplete suggestions |
| 🎛️ **Smart Filtering** | Filter by price, brand, rating, badges (Sale/New/Top Rated/Bestseller/Low Stock), in-stock — all URL-synced and shareable |
| ↕️ **Sorting** | 5 sort modes: newest, oldest, price asc/desc, top rated |
| ⚖️ **Product Comparison** | Compare up to 4 products side-by-side with best-value highlighting |
| 👁️ **Quick View** | Preview products in a modal without leaving the catalog |
| 🔍 **Image Zoom** | Hover-to-magnify + fullscreen lightbox on product images |
| ⭐ **Reviews** | Photos, helpful votes (one per user), verified-purchase badges, seller replies |
| ❤️ **Wishlist** | Save products for later, cross-device sync |
| 🛒 **Smart Cart** | Server-side sync, guest merge, undo-on-remove, free-shipping progress |
| 💳 **Multi-Payment** | Stripe (checkout sessions), Razorpay UPI (timing-safe verification), Cash on Delivery |
| 📦 **Order Tracking** | Status timeline (pending → processing → shipped → delivered) |
| 📄 **GST Invoices** | PDF invoices with CGST/SGST/IGST split |
| 🔄 **Returns** | Request returns with Stripe refund + stock reversal in a transaction |
| 🏠 **Address Book** | Multiple saved addresses with default shipping/billing |
| 🌙 **Dark Mode** | Class-based, anti-FOUC, system preference detection |
| 🌐 **i18n** | English + Hindi with instant language switcher |
| 📱 **PWA** | Installable on mobile with manifest + theme color |

### 🏪 Seller Experience
| Feature | Description |
|---------|-------------|
| 📝 **Store Registration** | Seller onboarding with admin verification |
| 📦 **Product Management** | Create, edit, delete products with images |
| 📊 **Seller Dashboard** | Revenue, orders, product stats |
| 📋 **Order Management** | View and update order statuses |

### 🔧 Admin Experience
| Feature | Description |
|---------|-------------|
| 📊 **Analytics Dashboard** | Revenue charts, order status breakdown, top products |
| ✅ **Seller Verification** | Approve/reject seller applications |
| 📦 **Product Management** | Full CRUD on all products |
| 📋 **Order Management** | View all orders, update statuses |
| 👥 **User Management** | View, search, manage users |
| 🎟️ **Coupon System** | Create percentage/flat coupons with usage limits |
| 🔄 **Returns Management** | Process return requests with refund tracking |

### ⚡ Performance & DX
| Feature | Description |
|---------|-------------|
| 🧩 **Code Splitting** | Route-level lazy loading + vendor chunk splitting (react-vendor, app-vendor, icons) |
| 🦴 **Skeleton Loaders** | Every page has layout-matching skeletons (no spinners) |
| 🔔 **Toast Notifications** | Rich toasts with undo actions for cart/wishlist |
| ⌨️ **Keyboard Shortcuts** | Press `/` to focus search |
| 📜 **Infinite Scroll** | + explicit "Load More" button for accessibility |
| 🎯 **Debounced Search** | 350ms debounce prevents API spam |
| 🔄 **Error Recovery** | ErrorState component with retry on every API-dependent surface |
| ⬆️ **Back to Top** | Floating button appears on scroll |
| 🎨 **Design System** | Consistent neutral palette, spacing rhythm, Inter font |

---

## 🛠️ Tech Stack

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
| react-i18next | — | Internationalization |
| recharts | 3 | Charts |

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

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- MongoDB 7+ (or use Docker Compose)
- npm or bun

### 1. Clone & Install
```bash
git clone https://github.com/ibrorg/ecommerce-fullstack.git
cd ecommerce-fullstack

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Setup
```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secrets, Stripe keys

# Frontend (Vite proxy handles API routing in dev)
cd ../frontend
# No env file needed for development
```

### 3. Run Development Servers
```bash
# Terminal 1 — Backend (port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

### 4. Or Use Docker Compose
```bash
docker-compose up --build
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
# API Docs: http://localhost:5000/api-docs
```

---

## 📸 Screenshots

### Home Page
- Hero section with curated collections
- Trending products grid
- Trust badges (Free Shipping, 30-Day Returns, Secure Payment)
- Stats band (10K+ customers, 500+ products, 4.8★ rating)
- Newsletter signup section
- Recently viewed products

### Product Listing
- Advanced filter sidebar (sort, category, price, brand, rating, badges, availability)
- Active filter chips with one-click removal
- URL-synced filters (shareable links)
- Product cards with badges, quick view, compare toggle, wishlist
- Infinite scroll + Load More button
- Dark mode support

### Product Detail
- Image zoom + fullscreen lightbox
- Breadcrumbs with Schema.org JSON-LD
- Product badges (New, Sale, Top Rated, Bestseller, Low Stock)
- Quantity selector
- Add to cart with toast + undo
- Reviews with photos, helpful votes, verified badges, seller replies
- Recently viewed cross-sell

### Cart
- Quantity steppers
- Undo on remove (5s toast)
- Free shipping progress bar
- Recently viewed cross-sell
- Dark mode

### Checkout
- 3-step flow (Shipping → Payment → Review)
- Saved address picker
- Coupon application
- Inventory reservation (stock held during checkout)
- Stripe / Razorpay / COD payment options

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vite SPA)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  React   │  │  Redux   │  │  Router  │  │   i18n   │   │
│  │   19     │  │  Toolkit │  │    7     │  │  EN/HI   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘   │
│       └──────────────┴─────────────┘                        │
│                      │ Axios (token refresh + failed queue)  │
└──────────────────────┼──────────────────────────────────────┘
                       │ HTTP /api/
┌──────────────────────┼──────────────────────────────────────┐
│                   Backend (Express 4)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │ Products │  │  Orders  │  │  Seller  │   │
│  │Middleware│  │ Service  │  │ Service  │  │ Service  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └──────────────┼─────────────┘              │          │
│              ┌───────┴────────┐                   │          │
│              │   Mongoose 8   │                   │          │
│              │   (25 models)  │                   │          │
│              └───────┬────────┘                   │          │
└──────────────────────┼───────────────────────────┘──────────┘
                       │
              ┌────────┴────────┐
              │   MongoDB 7     │
              │  (Replica Set)  │
              └─────────────────┘
```

### Key Architecture Decisions

- **Session-backed JWT auth** with device fingerprinting + IP consistency checks
- **MongoDB transactions** for order creation + returns (atomic stock + refund)
- **Inventory reservations** with optimistic concurrency + TTL cleanup
- **Soft deletes** on products (deletedAt + pre-find hooks)
- **Money rounding** via `Math.round((v + EPSILON) * 100) / 100` to avoid float drift
- **Stripe webhook verification** — rejects if `STRIPE_WEBHOOK_SECRET` is unset
- **Idempotency keys** on `POST /api/orders` (prevents duplicate orders from double-submits)
- **Cursor pagination** — O(1) deep pages vs O(n) offset skip
- **Optional Redis cache** — fail-open pattern (no-op without Redis)
- **API versioning** — `/api/v1/` prefix with backward compat

---

## 🔌 API Reference

### Base URL
```
Development: http://localhost:5000/api
Versioned:   http://localhost:5000/api/v1
```

### Key Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login | Public |
| GET | `/api/auth/me` | Get current user | Private |
| GET | `/api/products` | List products (filter, sort, paginate) | Public |
| GET | `/api/products/:id` | Get product detail | Public |
| POST | `/api/products/:id/reviews` | Add review | Private |
| POST | `/api/products/:id/reviews/:reviewId/vote` | Vote review helpful | Private |
| POST | `/api/products/:id/reviews/:reviewId/reply` | Seller reply | Seller/Admin |
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

### Response Format
```json
// Success
{ "success": true, "data": {...}, "message": "..." }

// Error
{ "success": false, "message": "...", "error": { "code": "ERROR_CODE" } }
```

### Custom Headers
| Header | Direction | Description |
|--------|-----------|-------------|
| `X-Request-Id` | Response | UUID for log correlation |
| `X-Response-Time` | Response | Request processing time (ms) |
| `X-API-Version` | Response | API version (1.0.0) |
| `Idempotency-Key` | Request | Prevents duplicate order creation |
| `Cache-Control` | Response | `public, max-age=60, stale-while-revalidate=300` on product list |

---

## 🗄️ Database Schema

### Collections (25 models)
```
User.ts          — buyer/seller/admin with seller profile, capabilities, sessions
Product.ts       — catalog with reviews (photos, helpfulVotes, sellerReply), badges
Order.ts         — orders with items, shipping, payment, GST, status timeline
Coupon.ts        — percentage/flat coupons with usage limits
Store.ts         — seller store profiles
Address.ts       — multi-address with default shipping/billing
Wishlist.ts      — saved products per user
Cart.ts          — server-side cart
Notification.ts  — in-app notifications
Reservation.ts   — inventory reservations (TTL)
ReturnRequest.ts — return/refund requests
Session.ts       — JWT sessions (revocable)
AuditLog.ts      — audit trail
IdempotencyRecord.ts — idempotency key cache (TTL)
ProcessedWebhookEvent.ts — Stripe webhook dedup
+ 10 more (Role, Analytics, FraudAlert, etc.)
```

### Key Indexes
```javascript
Product:  { slug: 1 }, { name: 'text', description: 'text', tags: 'text' },
          { isActive: 1, deletedAt: 1, category: 1, price: 1 }, { brand: 1 }
Order:    { user: 1, createdAt: -1 }, { orderStatus: 1, createdAt: -1 }
```

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| Password Hashing | argon2id (via argon2) |
| JWT | Access + refresh tokens, session-backed (revocable) |
| Session Security | Device fingerprint + IP consistency checks |
| Rate Limiting | Tiered: auth (5/15min), API (150/15min), sensitive (10/hr) |
| Security Headers | Helmet: CSP, HSTS, X-Frame-Options, Permissions-Policy, Referrer-Policy |
| CORS | Origin allowlist, preflight cache (24h) |
| Input Validation | express-validator + zod |
| NoSQL Injection | Mongoose parametrized queries, no raw `$where` |
| Webhook Security | Stripe + Razorpay signature verification (timing-safe) |
| Money Safety | Server-side price recalculation, transactional stock decrement |
| Idempotency | POST /orders supports Idempotency-Key header |

---

## 🧪 Testing

| Suite | Framework | Tests | Coverage |
|-------|-----------|-------|----------|
| Backend | Jest | 55+ | Product, Order, Auth, Cart, Coupon, Address, Search, Wishlist, Notifications |
| Frontend | Vitest | 85+ | Components (ErrorState, ProductBadges, NotFound, Breadcrumbs, ScrollToTop, BackToTop), Hooks (useRecentlyViewed, useDebounce, useDocumentMeta, useFocusTrap, useTheme), Store (compareSlice, authSlice, cartSlice) |

```bash
# Backend tests
cd backend && npx jest --detectOpenHandles --forceExit

# Frontend tests
cd frontend && npx vitest run
```

---

## 📁 Project Structure

```
ecommerce-fullstack/
├── backend/
│   ├── src/
│   │   ├── config/          # database, middleware, rate limits, routes, swagger
│   │   ├── controllers/     # request handlers (auth, product, order, search)
│   │   ├── middleware/      # auth, errorHandler, reqId, requestLogger, responseTime, idempotency
│   │   ├── models/          # 25 Mongoose models
│   │   ├── routes/          # 20 route files
│   │   ├── services/        # business logic (26 services)
│   │   ├── utils/           # logger, cache, response, crypto
│   │   └── server.ts        # entry point
│   ├── tests/               # Jest test suites
│   └── Dockerfile           # multi-stage, distroless, non-root
├── frontend/
│   ├── src/
│   │   ├── components/      # 54 React components
│   │   ├── pages/           # Home, Auth (Login, Register, Profile, Forgot, Reset)
│   │   ├── store/           # Redux Toolkit slices (auth, cart, products, wishlist, compare)
│   │   ├── hooks/           # useTheme, useRecentlyViewed, useDocumentMeta, useFocusTrap, useDebounce
│   │   ├── i18n/            # react-i18next (en, hi)
│   │   ├── services/        # Axios client with token refresh
│   │   └── test/            # Vitest test suites
│   └── Dockerfile           # nginx static serve
├── docker-compose.yml       # mongo + backend + frontend
├── ENTERPRISE_AUDIT.md      # 20-phase enterprise audit (504 lines)
└── README.md
```

---

## 🗺️ Roadmap

### ✅ Completed
- [x] Buyer/seller/admin flows
- [x] Product comparison with best-value highlighting
- [x] Quick view modal + image zoom + lightbox
- [x] Reviews with photos, helpful votes, seller replies
- [x] Advanced filtering with URL sync + badge filters
- [x] Cursor pagination + idempotency keys
- [x] Dark mode + i18n (EN/HI) + PWA
- [x] Skeleton loaders on all surfaces
- [x] Toast notifications with undo
- [x] SEO (sitemap, robots, OG tags, Schema.org JSON-LD)
- [x] Accessibility (skip-to-content, focus traps, reduced-motion, aria-labels)
- [x] Security headers (Permissions-Policy, Referrer-Policy, HSTS, CSP)
- [x] Observability (req-id, request logging, X-Response-Time)
- [x] Optional Redis cache (fail-open)
- [x] API versioning (/api/v1/)
- [x] 140+ tests (55 backend + 85 frontend)

### 🔜 Planned
- [ ] SSR migration (Next.js for SEO)
- [ ] Semantic search (Typesense/Elasticsearch)
- [ ] AI recommendations (vector embeddings)
- [ ] BullMQ job queue
- [ ] Multi-currency support
- [ ] Playwright E2E tests
- [ ] Stripe Connect payouts for marketplace

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

**All Rights Reserved.** This is private property of [ibrorg](https://github.com/ibrorg). No license is granted. Unauthorized use, copying, modification, distribution, or commercial use is strictly prohibited.

---

<div align="center">

**If this project helped you, consider giving it a ⭐!**

</div>
