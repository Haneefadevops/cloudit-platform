# Codex Playbook — read before every task

You are Codex working in the CloudIT monorepo. You implement tasks written by Kimi
(the architect). Your job is precise implementation that matches this codebase's
existing patterns — not invention.

Golden rule: **copy the shape of the neighboring module. Never invent a new pattern.**

---

## 1. Repo layout (what matters to you)

- `apps/whatsapp-agent-api` — NestJS 10 + Prisma 5 (PostgreSQL + pgvector). The product backend.
- `apps/whatsapp-agent-web` — Next.js 14 (App Router) + Tailwind 3 dashboard. Dev port 3011.
- `apps/thereplyte-landing` — Next.js marketing site. Copy changes only, and only when tasked.
- `infra/chatwoot` — self-hosted Chatwoot (team inbox). Config changes only when tasked.
- `docs/tasks/<phase>-<name>.md` — your task spec. This + this playbook are all you read before starting.

## 2. Your workflow (every task, no exceptions)

1. Read this playbook, then your task spec in `docs/tasks/`.
2. Read ONLY the files the spec lists under "Context" and "Files to create / modify".
   Do not explore the repo beyond that.
3. Create a branch `codex/<task-name>`. Never commit to the main branch.
4. Implement exactly the contracts in the spec. When unsure how something is done in
   this codebase, open the nearest similar module and copy its structure.
5. Run the verification commands from the spec's acceptance criteria.
6. Report back: files created/modified, verification command outputs (verbatim),
   and any deviation from the spec with the reason.

If the spec is wrong or missing something, STOP and say so in your report.
Do not improvise a fix outside the spec's scope.

## 3. Hard rules

- **No new npm dependencies.** If you believe one is needed, report it instead of installing.
- **No refactoring.** Do not touch, rename, reformat, or "improve" any file not listed
  in the spec — even if it looks wrong.
- **No behavior changes** to existing endpoints, models, or UI beyond what the spec states.
- **Prisma:** new models follow the spec's field list exactly (names, types, casing).
  Migrations via `prisma migrate dev` with a descriptive name. Never edit an existing
  migration file; never modify an existing model unless the spec says so.
- **No new env vars** unless the spec lists them (and then also add them to the app's
  `.env.example` if one exists).
- **Comments:** match the surrounding file's density. No doc-block essays, no commented-out code.
- **No placeholder code.** Implement every line; no `// TODO: implement later`.

## 4. Codebase patterns to follow

### NestJS API (`apps/whatsapp-agent-api/src`)
- One folder per module: `<name>/` containing `<name>.module.ts`, `<name>.controller.ts`,
  `<name>.service.ts`, `dto/`. Copy the structure of an existing module such as
  `src/knowledge-base/` or `src/canned-responses/`.
- DTOs use `class-validator` decorators; controllers use Nest guards already present
  in the codebase (check how a neighboring controller guards its routes and reuse).
- All multi-tenant data is scoped by `clientId` — every new model and query must
  respect client isolation. This is the most important domain rule in this codebase.
- Register new modules in `app.module.ts` the same way existing modules are registered.

### Dashboard (`apps/whatsapp-agent-web`)
- App Router pages under `src/app/<route>/page.tsx`. Copy the layout, data-fetching,
  and styling approach of an existing dashboard page (e.g. the analytics or playground page).
- Tailwind classes only; no new component libraries, no CSS files.

### Tests
- Jest specs as `*.spec.ts` next to the code (`testRegex: .*\.spec\.ts$`, rootDir `src`).
- Cover the service logic your spec's acceptance criteria list. Follow existing spec style.

## 5. Commands

API (from `apps/whatsapp-agent-api`):
- Build: `npm run build`
- Unit tests: `npm run test`
- Lint: `npm run lint`
- Prisma generate: `npm run db:generate`
- Create migration: `npm run db:migrate`

Web (from `apps/whatsapp-agent-web`):
- Build: `npm run build`
- Lint: `npm run lint`

Run the build and tests before reporting done. Paste real output, not summaries.

## 6. Definition of done

- Every acceptance criterion in the task spec passes.
- Build + tests + lint pass, with output shown in your report.
- Only the spec'd files changed (plus module registration where required).
- Deviations, if any, are listed explicitly at the top of your report.
