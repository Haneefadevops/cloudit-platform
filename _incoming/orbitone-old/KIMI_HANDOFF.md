# Kimi Handoff

Owner: Kimi
Area: Phase 1 frontend completion
Files changed:

- `frontend/`
- `frontend/lib/api.ts`
- `frontend/README.md`
- `docs/phase-delivery-plan.md`

What changed:

- Codex added `NEXT_PUBLIC_APP_URL` support for public profile links, QR values, share links, and copied links.
- Local Docker stack is running with frontend, backend, PostgreSQL, and Redis.
- Backend Phase 1 endpoints are implemented and smoke-tested.

Contract needed:

- Use `getPublicProfileUrl(slug)` from `frontend/lib/api.ts` for every public profile URL shown to users.
- Do not build URLs directly from `window.location.origin` except through that helper.
- Use `NEXT_PUBLIC_API_BASE_URL` for API calls and vCard download URLs.
- Keep the public profile route as `/u/[slug]`.

Open questions:

- Confirm test public URL is `https://to1.cloudit.lk`.
- Confirm production public URL is `https://po1.cloudit.lk`.

Verification:

- Run `npm.cmd run lint` in `frontend/`.
- Run `npm.cmd run build` in `frontend/`.
- Browser-test QR/share after setting `NEXT_PUBLIC_APP_URL` for the target environment.
