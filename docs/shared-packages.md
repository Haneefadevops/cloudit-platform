# CloudIT Platform — Shared Package Usage

This document explains how the monorepo shares code through `packages/*` and how each app consumes those packages.

---

## Existing Shared Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@cloudit/ui` | `packages/ui` | Reusable React + Tailwind components, theme CSS, shared Tailwind config |

Future packages (planned):

| Package | Purpose |
|---------|---------|
| `@cloudit/auth` | JWT validation helpers, auth guards, token utilities |
| `@cloudit/database` | Shared Prisma client patterns (if a shared DB client is adopted) |
| `@cloudit/config` | Shared environment validation and configuration utilities |

---

## Using `@cloudit/ui` in a New App

### 1. Add the Dependency

```json
// apps/myapp-web/package.json
{
  "dependencies": {
    "@cloudit/ui": "*"
  }
}
```

The `*` version tells npm to resolve the workspace package from `packages/ui`.

### 2. Import Styles

```tsx
// apps/myapp-web/src/app/layout.tsx
import "@cloudit/ui/globals.css";
```

### 3. Use the Tailwind Config

```ts
// apps/myapp-web/tailwind.config.ts
import type { Config } from "tailwindcss";
import uiConfig from "@cloudit/ui/tailwind.config";

const config: Config = {
  darkMode: uiConfig.darkMode,
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: uiConfig.theme,
  plugins: uiConfig.plugins,
};

export default config;
```

### 4. Import Components

```tsx
import { Button, Card, ToastProvider } from "@cloudit/ui";
```

### 5. Build in Docker

Because `@cloudit/ui` is not published to npm, Docker must build it inside the image and copy the artifacts into the app workspace. See `infra/orbitone-web/Dockerfile` for the working pattern:

```dockerfile
RUN npm run build --workspace=@cloudit/ui
RUN rm -rf apps/myapp-web/node_modules/@cloudit/ui && \
    mkdir -p apps/myapp-web/node_modules/@cloudit/ui && \
    cp -r packages/ui/dist packages/ui/package.json packages/ui/src/globals.css \
          packages/ui/tailwind.config.ts packages/ui/postcss.config.mjs \
          apps/myapp-web/node_modules/@cloudit/ui/
RUN npm run build --workspace=@cloudit/myapp-web
```

---

## Using `@cloudit/auth` (Planned)

When `@cloudit/auth` exists, APIs will import shared auth helpers:

```ts
import { JwtAuthGuard } from "@cloudit/auth";

@UseGuards(JwtAuthGuard)
@Controller("cards")
export class CardController {}
```

Web apps will import a hook or context:

```ts
import { useAuth } from "@cloudit/auth";

const { user, login, logout } = useAuth();
```

Until the package is created, each API keeps its own `JwtAuthGuard` copied from the platform pattern.

---

## Using `@cloudit/database` (Planned)

Currently each API has its **own Prisma schema and generated client** to avoid cross-database coupling and Prisma client output collisions:

| API | Prisma Client | Database |
|-----|---------------|----------|
| `platform-api` | `@prisma/client-platform` | `platform` |
| `hospitality-api` | `@prisma/client-hospitality` | `hospitality` |
| `orbitone-api` | `@prisma/client-orbitone` | `orbitone` |
| `touchorbit-api` | `@prisma/client-touchorbit` | `touchorbit` |

If a shared `@cloudit/database` package is created later, it would export:

- Connection helpers
- Migration runners
- Common Prisma extensions (e.g. soft-delete, audit logging)

But each app would still keep its own schema and database URL.

---

## Adding a New Shared Package

### 1. Create the Package Directory

```bash
mkdir packages/my-shared-package
cd packages/my-shared-package
```

### 2. Add `package.json`

```json
{
  "name": "@cloudit/my-shared-package",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

### 3. Add `tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### 4. Write Source Code

```bash
mkdir -p src
touch src/index.ts
```

### 5. Install from Root

```bash
cd ../..
npm install
```

### 6. Use in an App

```json
{
  "dependencies": {
    "@cloudit/my-shared-package": "*"
  }
}
```

### 7. Build Order

If an app depends on the new package, build the package first:

```bash
npm run build --workspace=@cloudit/my-shared-package
npm run build --workspace=@cloudit/myapp-api
```

For CI, add the build step before dependent app builds:

```yaml
- name: Build shared packages
  run: |
    npm run build --workspace=@cloudit/ui
    npm run build --workspace=@cloudit/my-shared-package
```

---

## Shared Package Rules

1. **Keep packages framework-agnostic when possible.** `@cloudit/ui` depends on React because it has to, but `@cloudit/config` should not.
2. **Do not put app-specific business logic in shared packages.** Shared packages are for cross-cutting concerns only.
3. **Always build shared packages before apps in CI/CD.** The root `npm run build` may not guarantee order.
4. **Version with `*` in app `package.json`.** npm workspaces resolve `*` to the local package.
5. **Document breaking changes.** Update this file and `docs/new-app-guide.md` when a shared package API changes.

---

## See Also

- `packages/ui/package.json`
- `docs/new-app-guide.md`
- `docs/routing-examples.md`
