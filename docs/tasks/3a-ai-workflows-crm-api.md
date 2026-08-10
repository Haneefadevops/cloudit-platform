# Task: AI Workflows + customer categories — schema & API (spec 1 of 2)

Phase: 1 | App: `apps/whatsapp-agent-api`

## Goal

Create the data model and CRUD API for two linked concepts:

1. **Workflows** — plain-language conversation playbooks a client defines
   (e.g. "Visa Services": when to activate, what steps to follow, what data to
   collect, what to do at the end). The AI runtime (built separately, not in
   this task) will consume these.
2. **Customer categories** — per-client configurable labels (e.g. "Visa lead",
   "Tour package lead") that can be attached to customers. A workflow can name
   the category its completers belong to.

Plus **workflow sessions**: a record tracking that a given conversation is (or
was) running a given workflow, with the data collected so far.

This task is schema + CRUD API + tests only. No AI logic, no UI.

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/whatsapp-agent-api/prisma/schema.prisma` — models `Client`, `Customer`,
  `Conversation`; note the relation style (`clientId` + relation, `onDelete: Cascade`,
  `@@map` snake_case table names)
- `apps/whatsapp-agent-api/src/canned-responses/` — **copy this module's exact
  shape**: controller guards (`JwtAuthGuard, AdminGuard`), `:clientId` route
  params, service methods always scoped by `clientId`, DTO usage, module file
- `apps/whatsapp-agent-api/src/customers/customers.module.ts` and
  `customers.service.ts` — you will add a controller to this module
- An existing `*.spec.ts` for test style
- An existing folder under `prisma/migrations/` for migration file format

## Files to create / modify

### Schema
- MODIFY: `prisma/schema.prisma` — add models below; add `categoryId String?` +
  relation to `Customer` (`onDelete: SetNull`); add back-relations on `Client`,
  `Customer`, `Conversation` as needed.
- CREATE: migration (see "Migration" section below).

```prisma
model Workflow {
  id            String   @id @default(uuid())
  name          String
  description   String?
  trigger       String   // plain language: when the AI should activate this workflow
  instructions  String   // plain language: steps the AI must follow
  collectFields Json?    // optional list of data points to collect, e.g. ["destination country", "travel date"]
  endAction     String   @default("handoff") // handoff | booking | order | none
  isActive      Boolean  @default(true)
  priority      Int      @default(0) // higher priority wins when multiple workflows match
  categoryId    String?  // customers entering this workflow get this category
  category      CustomerCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  clientId      String
  client        Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  sessions      WorkflowSession[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@map("workflows")
}

model CustomerCategory {
  id          String     @id @default(uuid())
  name        String
  description String?
  color       String?    // hex color for dashboard badges
  clientId    String
  client      Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  customers   Customer[]
  workflows   Workflow[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  @@unique([clientId, name])
  @@map("customer_categories")
}

model WorkflowSession {
  id             String       @id @default(uuid())
  status         String       @default("active") // active | completed | abandoned
  collectedData  Json?        @default("{}")
  startedAt      DateTime     @default(now())
  completedAt    DateTime?
  clientId       String
  client         Client       @relation(fields: [clientId], references: [id], onDelete: Cascade)
  workflowId     String
  workflow       Workflow     @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, status])
  @@index([clientId, status])
  @@map("workflow_sessions")
}
```

`Customer` additions:
```prisma
  categoryId String?
  category   CustomerCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
```

### Workflows module (copy canned-responses shape)
- CREATE: `src/workflows/workflows.module.ts`
- CREATE: `src/workflows/workflows.controller.ts` — `@Controller('workflows')`,
  `@UseGuards(JwtAuthGuard, AdminGuard)`, routes:
  - `GET :clientId` — list (include `category`), ordered by `priority` desc, then `createdAt`
  - `POST :clientId` — create (DTO: `name`, `trigger`, `instructions` required strings;
    `description?`, `collectFields?` (array of strings), `endAction?`, `categoryId?`,
    `isActive?`, `priority?`)
  - `PUT :clientId/:id` — update (all fields optional; verify `id` belongs to `clientId`)
  - `DELETE :clientId/:id` — delete (scoped by `clientId`)
- CREATE: `src/workflows/workflows.service.ts`
- CREATE: `src/workflows/dto/create-workflow.dto.ts`, `update-workflow.dto.ts`
  (class-validator, same style as existing DTOs)
- CREATE: `src/workflows/workflows.service.spec.ts`

### Categories module (same shape)
- CREATE: `src/categories/` — module, controller (`@Controller('categories')`),
  service, DTOs (`name` required; `description?`, `color?`), service spec.
  Routes: `GET/POST :clientId`, `PUT/DELETE :clientId/:id`.
  Deleting a category that is in use: allowed — relations use `SetNull`.

### Customers: read + category assignment
- CREATE: `src/customers/customers.controller.ts` — `@Controller('customers')`,
  same guards:
  - `GET :clientId` — list customers with `category` included; optional query
    `?categoryId=<id>` filter; ordered by `createdAt` desc
  - `PUT :clientId/:id/category` — body `{ categoryId: string | null }`; assign or
    clear; verify the category (when non-null) belongs to the same `clientId`;
    return 404/400 otherwise, matching existing error style
- MODIFY: `src/customers/customers.service.ts` — add `findAll(clientId, categoryId?)`
  and `setCategory(clientId, customerId, categoryId | null)`. Do NOT change
  `findOrCreate`.
- CREATE: `src/customers/customers.service.spec.ts` (or extend an existing one if present)

### Registration
- MODIFY: `src/app.module.ts` — register `WorkflowsModule` and `CategoriesModule`
  the same way existing modules are registered. (`CustomersModule` is already
  registered — just confirm its controller is picked up.)

## Migration

Try `npm run db:migrate -- --name add-workflows-and-categories` then
`npm run db:generate`.

**Known environment issue:** if `migrate dev` fails because the local shadow
database lacks the `vector` extension (this happened on the previous task),
STOP using migrate dev and instead:
1. Create the folder `prisma/migrations/<timestamp>_add-workflows-and-categories/`
   by hand (timestamp format `YYYYMMDDHHMMSS`, matching existing folders).
2. Hand-write `migration.sql` inside it — plain `CREATE TABLE` / `ALTER TABLE`
   statements matching the schema exactly (foreign keys, indexes, unique
   constraint, defaults). Use an existing migration file as the format reference.
3. Still run `npm run db:generate`.
4. State clearly in your report that the migration was hand-written.

## Contracts

- Every query is scoped by `clientId`. No endpoint may return or mutate another
  client's data — this is the top review criterion.
- `endAction` accepts only: `handoff`, `booking`, `order`, `none` (validate in DTO).
- `WorkflowSession` gets NO endpoints in this task — model only; the AI runtime
  will write to it later.

## Do NOT

- No AI logic, no changes to `whatsapp.service.ts`, `ai.service.ts`, or the webhook flow.
- No UI. No new dependencies or env vars.
- Do not modify `findOrCreate` or any existing service method's behavior.
- Do not touch the `codex/ctwa-attribution` changes beyond rebasing if needed —
  note: that branch already added `Customer.leadSource`; build on top of it.

## Acceptance criteria

- [ ] Schema matches this spec exactly; migration exists (or hand-written fallback
      reported); `npm run db:generate` passes.
- [ ] All routes work and are scoped: creating/reading/updating/deleting with the
      wrong `clientId` returns not-found, never data.
- [ ] `PUT customers/:clientId/:id/category` rejects a category from another client.
- [ ] Specs cover: workflow CRUD scoping, category CRUD scoping, customer category
      assignment/clearing + cross-client rejection.
- [ ] `npm run build` passes, `npm run test` passes — paste real output.
      (Lint is known-broken repo-wide; ignore it.)

## Report back

- Files created/modified (full list)
- Migration: created normally or hand-written (and why)
- Verbatim build / test output
- Any deviation from this spec, with the reason
