# E-Shop Frontend

React 19 + Vite 7 + TypeScript + Redux Toolkit + Tailwind CSS v4.

## Scripts

```bash
npm install      # install deps
npm run dev      # dev server on :5173
npm run build    # production build to dist/
npm run lint     # eslint
npm run type-check  # tsc --noEmit
```

## Environment

Create `.env` (or `.env.local`):

```
VITE_API_URL=http://localhost:5000
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

## Architecture

- `src/pages/` — route pages (Home, Auth, SellerRegistration)
- `src/components/` — reusable UI + feature components
- `src/store/` — Redux Toolkit store (auth, cart, products slices)
- `src/services/api.ts` — axios client with token refresh
- `src/context/ConfigContext.tsx` — site config provider
- `src/config/routes.ts` — route definitions with lazy loading

See the root README for the full-stack overview.
