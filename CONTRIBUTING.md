# Contributing to E-Shop

Thank you for your interest in contributing. This document covers the development workflow, commit conventions, and PR checklist.

## Code of conduct

Be respectful, inclusive, and professional in all interactions. Personal attacks, harassment, and discrimination are not tolerated.

## Getting started

```bash
# Fork and clone
git clone https://github.com/<your-username>/ecommerce-fullstack.git
cd ecommerce-fullstack

# Install dependencies
(cd backend  && npm install)
(cd frontend && npm install)

# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI, JWT secrets, and Stripe keys

# Create a feature branch
git checkout -b feature/your-feature
```

## Development workflow

1. **Pick a scope.** Keep changes focused — one feature or fix per branch.
2. **Write code in TypeScript.** All new code must be typed; avoid `any` unless there is no alternative (and add a comment explaining why).
3. **Follow ESLint.** Run `npm run lint` in the affected package before committing.
4. **Write tests.** Backend features get Jest tests; frontend features get Vitest tests; user-visible flows get Playwright tests when practical.
5. **Keep commits small and meaningful.** One logical change per commit.

## Commit message format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>
```

| Type | Use for |
|------|---------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | A change that improves performance |
| `test` | Adding or correcting tests |
| `chore` | Tooling, deps, build process |

Examples:

```
feat(checkout): add coupon validation feedback
fix(cart): prevent duplicate items when merging guest cart
docs(api): document the idempotency-key header
```

## Pull request process

1. Rebase your branch on the latest `main`.
2. Make sure the following pass locally:
   ```bash
   # Backend
   cd backend && npm run lint && npx jest --detectOpenHandles --forceExit

   # Frontend
   cd frontend && npm run lint && npx vitest run && npm run type-check
   ```
3. If your change touches a user-visible flow, add or update a Playwright test in `frontend/e2e/`.
4. Update the README and ARCHITECTURE.md if your change affects the public API, the project structure, or a key engineering decision.
5. Open a PR against `main` with a clear description: what changed, why, and how it was tested.

## Project layout

See the [README](./README.md#project-structure) and [ARCHITECTURE.md](./ARCHITECTURE.md) for where things live and how the layers fit together.

## Reporting issues

Use the GitHub issue tracker. For security-sensitive reports, do not open a public issue — contact the maintainers directly via the organization page at [github.com/ibrorg](https://github.com/ibrorg).

---

Thank you for contributing.
