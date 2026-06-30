# OrbitOne Frontend v2

React 19 + Vite 6 + React Router 7 + TanStack Query + Tailwind CSS 4.

This is the redesigned OrbitOne SPA. It consumes the backend API at `/api/v2/`.

## Quick start

```sh
npm install
npm run dev -- --port 3002
```

Open `http://localhost:3002`.

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (default port 5173) |
| `npm run dev -- --port 3002` | Start on port 3002 |
| `npm run build` | Type-check and build static SPA to `dist/` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |

## Testing

End-to-end tests use Playwright:

```sh
npx playwright test
npx playwright test --ui
```

The Playwright config (`playwright.config.ts`) automatically starts the backend and frontend-v2 dev servers when needed.

## Project conventions

- Pages live in `src/app/` and mirror the URL structure.
- Domain data hooks live in `src/hooks/` (e.g. `useAuth.ts`, `useCRM.ts`).
- Shared UI primitives live in `src/components/ui/`.
- `src/lib/api.ts` is the central fetch wrapper.
- `src/lib/contracts.ts` re-exports shared types from `contracts/orbitone.v2.ts`.

## Important notes

- The dev server currently defaults to port `5173`. Use `--port 3002` to match the project convention.
- `form.watch("rules")` in `src/app/dashboard/scheduling/availability/page.tsx` triggers a pre-existing React Compiler warning; it is harmless.
