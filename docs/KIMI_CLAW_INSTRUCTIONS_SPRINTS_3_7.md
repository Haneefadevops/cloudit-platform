# CloudIT Platform — Kimi Claw Desktop Instructions
## Sprints 3–7 (Task-by-Task Prompts)

> **How to use this document:**
> 1. Copy **ONE** task prompt at a time into Kimi Claw Desktop.
> 2. Wait for completion and Git push confirmation.
> 3. Only then proceed to the next task.
> 4. Do NOT paste multiple tasks at once — this causes crashes.
> 5. If Kimi Claw asks for clarification, answer before continuing.

---

## SPRINT 3 — Shared Frontend Foundation

### Sprint 3 Goal
Build the reusable UI package (`packages/ui`) and the CloudIT Platform web app (`apps/platform-web`) with Next.js, Tailwind, shadcn/ui, and shared auth.

---

### Task 3.1 — Initialize `packages/ui`

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 3.

Your task: Initialize the shared UI package at `packages/ui` in the monorepo at `C:\Project\cloudit-platform`.

Requirements:
1. Create `packages/ui/package.json` with:
   - name: `@cloudit/ui`
   - type: module
   - main: `./dist/index.js`
   - types: `./dist/index.d.ts`
   - scripts: build, dev, lint
   - peerDependencies: react, react-dom
   - devDependencies: typescript, @types/react, @types/react-dom, tailwindcss, postcss, autoprefixer, class-variance-authority, clsx, tailwind-merge, lucide-react
2. Create `packages/ui/tsconfig.json` extending the root tsconfig if it exists, or create a standard one.
3. Create `packages/ui/tailwind.config.ts` that exports a Tailwind config using the `content` paths for all apps.
4. Create `packages/ui/postcss.config.mjs`.
5. Create `packages/ui/src/index.ts` as the entry point.
6. Create `packages/ui/src/globals.css` with Tailwind directives and CSS variables for light/dark mode (shadcn style).
7. Create `packages/ui/components.json` for shadcn/ui integration.
8. Update the root `package.json` to include `@cloudit/ui` in workspaces if not already present.
9. Run `pnpm install` (or npm/yarn based on lockfile) from the root.
10. Commit with message: "feat(ui): initialize shared UI package"
11. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 3.1 done".
```

---

### Task 3.2 — Add Base UI Components to `packages/ui`

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 3, Task 3.2.

Your task: Add the following base UI components to `packages/ui/src/components/`.

Create these components (each as its own file with TypeScript + Tailwind):

1. `Button` — with variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon. Use class-variance-authority (cva).
2. `Input` — standard text input with label support, error state, and disabled state.
3. `Select` — native select wrapper with label, error state, and placeholder option.
4. `Card` — container with header, content, footer subcomponents.
5. `Badge` — variants: default, secondary, destructive, outline.
6. `Toast` — using a simple toast context/provider (not a full library yet). Create `ToastProvider`, `useToast`, and `Toast` component.
7. `Modal` — dialog with overlay, close button, title, and content slots. Use a simple portal approach.
8. `Table` — wrapper with header, body, row, cell, head components.
9. `Form` — simple form wrapper with `FormField`, `FormLabel`, `FormError` components.
10. `Sidebar` — collapsible sidebar with navigation items, logo slot, and user profile slot.
11. `Calendar` — placeholder component that renders a simple grid (we will replace with a real calendar library later).

Each component must:
- Be fully typed with TypeScript interfaces
- Use `cn()` utility (clsx + tailwind-merge) for class merging
- Export from `packages/ui/src/index.ts`
- Follow shadcn/ui patterns where possible

After creating all components:
1. Run the build from `packages/ui` to verify no TypeScript errors.
2. Commit with message: "feat(ui): add base UI components"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 3.2 done".
```

---

### Task 3.3 — Initialize `apps/platform-web`

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 3, Task 3.3.

Your task: Initialize the Platform web app at `apps/platform-web`.

Requirements:
1. Create `apps/platform-web` using Next.js 14+ with App Router:
   - Use TypeScript
   - Use Tailwind CSS
   - Use the shared `@cloudit/ui` package
   - Configure next.config.js for standalone output (for Docker)
2. Set up the folder structure:
   - `apps/platform-web/src/app/layout.tsx` — root layout with ToastProvider, dark/light mode support, and global styles from `@cloudit/ui`
   - `apps/platform-web/src/app/page.tsx` — redirect to `/login` if not authenticated, otherwise `/dashboard`
   - `apps/platform-web/src/app/login/page.tsx` — login page placeholder
   - `apps/platform-web/src/app/register/page.tsx` — register page placeholder
   - `apps/platform-web/src/app/dashboard/page.tsx` — dashboard shell placeholder
   - `apps/platform-web/src/app/dashboard/layout.tsx` — dashboard layout with sidebar
   - `apps/platform-web/src/components/` — for app-specific components
   - `apps/platform-web/src/lib/` — for utilities (api client, auth helpers)
   - `apps/platform-web/src/hooks/` — for custom hooks
3. Create `apps/platform-web/package.json` with:
   - name: `@cloudit/platform-web`
   - dependencies: next, react, react-dom, @cloudit/ui
   - devDependencies: typescript, @types/react, @types/react-dom, tailwindcss, postcss, autoprefixer, eslint
4. Create `apps/platform-web/tsconfig.json` extending root config.
5. Create `apps/platform-web/tailwind.config.ts` that imports from `@cloudit/ui`.
6. Create `apps/platform-web/postcss.config.mjs`.
7. Create `apps/platform-web/.env.example` with:
   - NEXT_PUBLIC_API_URL=https://api-platform.cloudit.lk
   - NEXT_PUBLIC_APP_NAME=CloudIT Platform
8. Update root `package.json` workspaces to include `apps/platform-web`.
9. Run install from root.
10. Commit with message: "feat(platform-web): initialize Next.js app"
11. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 3.3 done".
```

---

### Task 3.4 — Build Auth Pages (Login & Register)

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 3, Task 3.4.

Your task: Build the Login and Register pages for `apps/platform-web`.

Requirements:

**Login Page** (`apps/platform-web/src/app/login/page.tsx`):
1. Clean, centered layout with the CloudIT logo placeholder (text "CloudIT Platform" for now)
2. Form fields: Email, Password
3. Use `@cloudit/ui` components: Card, Input, Button, Form
4. Client-side validation: required fields, email format
5. On submit: POST to `api-platform.cloudit.lk/auth/login` with { email, password }
6. On success: store JWT in httpOnly cookie (or localStorage if cookies are tricky with Next.js client — use localStorage for now with a note to switch later)
7. On error: show toast error message
8. Link to "Don't have an account? Register"
9. Loading state on button during submit

**Register Page** (`apps/platform-web/src/app/register/page.tsx`):
1. Form fields: Full Name, Email, Password, Confirm Password, Organization Name
2. Validation: all required, password min 8 chars, passwords must match, valid email
3. On submit: POST to `api-platform.cloudit.lk/auth/register` with { name, email, password, organizationName }
4. On success: auto-login and redirect to dashboard
5. On error: show toast error
6. Link to "Already have an account? Login"

**API Client** (`apps/platform-web/src/lib/api.ts`):
- Create a fetch wrapper that:
  - Adds Authorization header with JWT from storage
  - Handles 401 by redirecting to login
  - Returns typed responses
  - Has base URL from env var

**Auth Hook** (`apps/platform-web/src/hooks/useAuth.ts`):
- Check if user is authenticated (token exists and not expired)
- Get current user info
- Logout function

After implementation:
1. Test build with `npm run build` from `apps/platform-web` (or `pnpm build` from root with filter).
2. Commit with message: "feat(platform-web): add login and register pages"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 3.4 done".
```

---

### Task 3.5 — Build Dashboard Shell

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 3, Task 3.5.

Your task: Build the dashboard shell for `apps/platform-web`.

Requirements:

**Dashboard Layout** (`apps/platform-web/src/app/dashboard/layout.tsx`):
1. Sidebar on the left (use `@cloudit/ui` Sidebar component)
2. Top navbar with:
   - Organization switcher (dropdown showing current org, ability to switch)
   - User profile dropdown (avatar placeholder, name, email, logout)
   - Dark/light mode toggle
   - Notification bell placeholder
3. Main content area on the right
4. Mobile responsive: collapsible sidebar with hamburger menu
5. Footer with "CloudIT Platform" and version placeholder

**Sidebar Navigation** (`apps/platform-web/src/components/SidebarNav.tsx`):
1. Navigation items:
   - Dashboard (icon: LayoutDashboard)
   - Users (icon: Users)
   - Organizations (icon: Building2)
   - Settings (icon: Settings)
   - Admin (icon: Shield, only for admin users)
2. Active state styling
3. Collapsible sections

**Dashboard Home Page** (`apps/platform-web/src/app/dashboard/page.tsx`):
1. Welcome message with user name
2. Stats cards (placeholder data): Total Users, Total Organizations, Active Sessions
3. Recent activity list (placeholder)
4. Quick actions section

**Organization Switcher** (`apps/platform-web/src/components/OrgSwitcher.tsx`):
1. Fetch user's organizations from API
2. Display current organization name
3. Dropdown to switch between organizations
4. Update context/state when switching

**User Profile Dropdown** (`apps/platform-web/src/components/UserProfile.tsx`):
1. Show user name and email
2. Link to Profile settings
3. Link to Account settings
4. Logout button

**Settings Pages** (create placeholder pages):
1. `/dashboard/settings/profile` — profile form placeholder
2. `/dashboard/settings/account` — account settings placeholder
3. `/dashboard/settings/appearance` — theme settings placeholder

After implementation:
1. Verify all routes work in dev mode.
2. Commit with message: "feat(platform-web): add dashboard shell and navigation"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 3.5 done".
```

---

### Task 3.6 — Build Admin User Management

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 3, Task 3.6.

Your task: Build the Admin User Management page for `apps/platform-web`.

Requirements:

**Admin Guard** (`apps/platform-web/src/components/AdminGuard.tsx`):
1. Check if current user has admin role
2. If not, redirect to dashboard with unauthorized toast
3. Wrap admin pages with this guard

**Users Management Page** (`apps/platform-web/src/app/dashboard/admin/users/page.tsx`):
1. Page title: "User Management"
2. Table showing all users with columns:
   - Name
   - Email
   - Organization
   - Role
   - Status (Active/Inactive)
   - Created At
   - Actions (Edit, Delete)
3. Use `@cloudit/ui` Table component
4. Pagination (client-side for now)
5. Search/filter by name or email
6. Sort by columns

**Add/Edit User Modal** (`apps/platform-web/src/components/UserModal.tsx`):
1. Form fields: Name, Email, Role (select), Organization (select), Status (toggle)
2. Create new user or edit existing
3. Validation on all fields
4. Submit to API

**Delete User Confirmation**:
1. Confirm modal before delete
2. Show user name in confirmation message
3. Soft delete (deactivate) for now

**API Integration**:
1. Fetch users from `GET /api/users` (or existing endpoint from platform-api)
2. Create user: `POST /api/users`
3. Update user: `PATCH /api/users/:id`
4. Delete user: `DELETE /api/users/:id`

After implementation:
1. Test the admin flow.
2. Commit with message: "feat(platform-web): add admin user management"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 3.6 done".
```

---

### Task 3.7 — Dark/Light Mode & Mobile Polish

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 3, Task 3.7.

Your task: Finalize dark/light mode and mobile responsiveness for `apps/platform-web`.

Requirements:

**Theme System**:
1. Use next-themes package for dark/light mode
2. Install and configure in layout.tsx
3. Add theme toggle button to navbar
4. Ensure all `@cloudit/ui` components respect theme variables
5. Update `globals.css` in `@cloudit/ui` to have proper dark mode CSS variables

**Mobile Responsiveness**:
1. Sidebar should be a slide-out drawer on mobile (< 768px)
2. Navbar should collapse gracefully on mobile
3. Tables should be horizontally scrollable on mobile
4. Forms should stack vertically on mobile
5. Cards should be full-width on mobile
6. Test all dashboard pages on mobile viewport

**Loading States**:
1. Add loading.tsx files for main routes
2. Create a skeleton loading component using `@cloudit/ui` Card
3. Show skeleton while data is fetching

**Error Handling**:
1. Add error.tsx for main routes
2. Create a friendly error boundary component
3. Show "Something went wrong" with retry button

**Meta & SEO**:
1. Add proper metadata to all pages
2. Add favicon placeholder
3. Add OpenGraph tags

After implementation:
1. Run production build and verify no errors.
2. Commit with message: "feat(platform-web): add theme system, mobile polish, and error handling"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 3.7 done — Sprint 3 complete".
```

---

## SPRINT 4 — Hospitality OS MVP

### Sprint 4 Goal
Build the first SaaS product: Hospitality OS. Reuse all platform infrastructure and shared packages.

---

### Task 4.1 — Initialize `apps/hospitality-api`

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.1.

Your task: Initialize the Hospitality API at `apps/hospitality-api`.

Requirements:
1. Copy the structure from `apps/platform-api` but adapt for Hospitality OS:
   - NestJS setup
   - Prisma setup (separate database: `hospitality`)
   - Same auth middleware (JWT validation from platform-api)
   - Same organization/tenant context
2. Create `apps/hospitality-api/prisma/schema.prisma` with these models:
   - Property (hotel/guesthouse)
   - RoomType
   - Room
   - Guest
   - Reservation
   - Invoice
   - TaxRate (for Sri Lankan taxes)
3. Add relationships between models.
4. Create `apps/hospitality-api/.env.example` with:
   - DATABASE_URL=postgresql://user:pass@postgres:5432/hospitality
   - REDIS_URL=redis://redis:6379
   - JWT_SECRET (same as platform, but read from env)
   - PORT=3002
5. Create basic module structure:
   - src/properties/
   - src/room-types/
   - src/rooms/
   - src/guests/
   - src/reservations/
   - src/invoices/
   - src/taxes/
   - src/common/ (guards, interceptors, filters)
6. Add health check endpoint at `/health`
7. Create Docker-related files:
   - Dockerfile (multi-stage, similar to platform-api)
   - .dockerignore
8. Update root `docker-compose.yml` (or create `docker-compose.hospitality.yml`) to add:
   - hospitality-api service
   - Separate database `hospitality` in postgres service (or ensure it exists)
9. Update Traefik labels for `api-hospitality.cloudit.lk`
10. Commit with message: "feat(hospitality-api): initialize NestJS API"
11. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.1 done".
```

---

### Task 4.2 — Build Hospitality Core Modules (Properties, Rooms, Guests)

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.2.

Your task: Build the core business modules for `apps/hospitality-api`.

Requirements:

**Properties Module** (`src/properties/`):
1. DTOs: CreatePropertyDto, UpdatePropertyDto
2. Fields: name, address, phone, email, taxId, settings (JSON)
3. CRUD endpoints: GET /properties, GET /properties/:id, POST /properties, PATCH /properties/:id, DELETE /properties/:id
4. All endpoints scoped to current organization (tenant)
5. Pagination and search by name

**Room Types Module** (`src/room-types/`):
1. DTOs: CreateRoomTypeDto, UpdateRoomTypeDto
2. Fields: name, description, basePrice, maxOccupancy, amenities (JSON array), propertyId
3. CRUD endpoints scoped to organization
4. Belongs to a Property

**Rooms Module** (`src/rooms/`):
1. DTOs: CreateRoomDto, UpdateRoomDto
2. Fields: roomNumber, floor, status (available, occupied, maintenance, cleaning), roomTypeId, propertyId
3. CRUD endpoints
4. Endpoint to get available rooms by date range
5. Belongs to RoomType and Property

**Guests Module** (`src/guests/`):
1. DTOs: CreateGuestDto, UpdateGuestDto
2. Fields: firstName, lastName, email, phone, idNumber, nationality, address, notes
3. CRUD endpoints
4. Search by name, email, phone
5. Scoped to organization

**Database**:
1. Run Prisma migration: `npx prisma migrate dev --name init_hospitality_core`
2. Generate Prisma client
3. Add seed data for testing (2 properties, 3 room types, 10 rooms, 5 guests)

After implementation:
1. Test all endpoints with curl or a simple test script.
2. Commit with message: "feat(hospitality-api): add properties, rooms, room-types, guests modules"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.2 done".
```

---

### Task 4.3 — Build Reservations & Booking Calendar

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.3.

Your task: Build the Reservations module and booking calendar logic for `apps/hospitality-api`.

Requirements:

**Reservations Module** (`src/reservations/`):
1. DTOs: CreateReservationDto, UpdateReservationDto, CheckInDto, CheckOutDto
2. Fields:
   - reservationNumber (auto-generated, format: RES-YYYYMMDD-XXXX)
   - guestId
   - roomId
   - propertyId
   - checkInDate (DateTime)
   - checkOutDate (DateTime)
   - adults, children
   - status (pending, confirmed, checked_in, checked_out, cancelled, no_show)
   - totalAmount (Decimal)
   - paidAmount (Decimal)
   - paymentStatus (pending, partial, paid, refunded)
   - source (direct, walk_in, phone, email)
   - notes
   - createdBy (userId)
3. CRUD endpoints
4. Validation: checkInDate < checkOutDate, room must be available for date range
5. Auto-generate reservation number
6. Update room status on check-in/check-out

**Availability Logic**:
1. Endpoint: GET /rooms/availability?propertyId=X&checkIn=Y&checkOut=Z
2. Returns available rooms for the date range
3. Exclude rooms with overlapping reservations (except cancelled)

**Booking Calendar Endpoint**:
1. GET /reservations/calendar?propertyId=X&month=Y&year=Z
2. Returns reservations grouped by date for calendar view
3. Include room number, guest name, status

**Check-in/Check-out**:
1. POST /reservations/:id/check-in — updates status to checked_in, room to occupied
2. POST /reservations/:id/check-out — updates status to checked_out, room to cleaning, calculate final invoice

**Migration**:
1. Create Prisma migration for reservations
2. Add seed data: 3 reservations in different statuses

After implementation:
1. Test reservation flow end-to-end.
2. Commit with message: "feat(hospitality-api): add reservations and booking calendar"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.3 done".
```

---

### Task 4.4 — Sri Lankan Tax Engine & Invoice Generation

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.4.

Your task: Build the Sri Lankan tax engine and invoice generation for `apps/hospitality-api`.

Requirements:

**Tax Rates Module** (`src/taxes/`):
1. Model: TaxRate with fields:
   - name (e.g., "VAT", "Service Charge", "TDL", "SSCL")
   - rate (Decimal, e.g., 18.00 for 18%)
   - type (percentage, fixed)
   - isActive
   - isDefault
   - organizationId
2. CRUD endpoints for managing tax rates
3. Seed default Sri Lankan rates:
   - Service Charge: 10%
   - TDL (Tourism Development Levy): 1%
   - SSCL (Social Security Contribution Levy): 2.5%
   - VAT: 18% (configurable based on current regulations)
4. Endpoint to get active tax rates for an organization

**Invoice Module** (`src/invoices/`):
1. Model: Invoice with fields:
   - invoiceNumber (auto-generated: INV-YYYYMMDD-XXXX)
   - reservationId
   - propertyId
   - guestId
   - issueDate
   - dueDate
   - subtotal (before taxes)
   - taxBreakdown (JSON: [{ name, rate, amount }])
   - totalAmount (after taxes)
   - paidAmount
   - status (draft, issued, paid, overdue, cancelled)
   - notes
2. Auto-generate invoice on check-out or manual creation
3. Calculate taxes based on active TaxRates:
   - subtotal = room charges + extras
   - serviceCharge = subtotal * serviceChargeRate
   - tdl = subtotal * tdlRate
   - sscl = subtotal * ssclRate
   - vat = (subtotal + serviceCharge + tdl + sscl) * vatRate
   - total = subtotal + serviceCharge + tdl + sscl + vat
4. Endpoint: GET /invoices/:id — returns invoice with full breakdown
5. Endpoint: GET /invoices — list with pagination, filter by status
6. Endpoint: POST /invoices/:id/mark-paid

**Invoice PDF Placeholder**:
1. Create a simple HTML template for invoice (we will add PDF generation later)
2. Endpoint: GET /invoices/:id/preview — returns JSON with formatted invoice data ready for rendering

**Migration**:
1. Create Prisma migration for taxes and invoices
2. Seed tax rates

After implementation:
1. Test invoice calculation with sample data.
2. Commit with message: "feat(hospitality-api): add Sri Lankan tax engine and invoice generation"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.4 done".
```

---

### Task 4.5 — Basic Reports Endpoint

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.5.

Your task: Add basic reporting endpoints to `apps/hospitality-api`.

Requirements:

**Reports Module** (`src/reports/`):
1. Occupancy Report:
   - GET /reports/occupancy?propertyId=X&startDate=Y&endDate=Z
   - Returns: totalRooms, occupiedRooms, occupancyRate, revenue, by date
2. Revenue Report:
   - GET /reports/revenue?propertyId=X&startDate=Y&endDate=Z
   - Returns: totalRevenue, taxBreakdown, by room type, by payment status
3. Guest Report:
   - GET /reports/guests?propertyId=X&startDate=Y&endDate=Z
   - Returns: totalGuests, newGuests, returningGuests, topNationalities
4. Reservation Report:
   - GET /reports/reservations?propertyId=X&startDate=Y&endDate=Z
   - Returns: totalReservations, by status, by source, cancellationRate, noShowRate

**Implementation Notes**:
- Use raw SQL or Prisma aggregations
- Return simple JSON (no charts yet)
- Cache results in Redis for 1 hour (optional, add if simple)
- All scoped to organization

After implementation:
1. Test reports with seed data.
2. Commit with message: "feat(hospitality-api): add basic reports"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.5 done".
```

---

### Task 4.6 — Initialize `apps/hospitality-web`

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.6.

Your task: Initialize the Hospitality web app at `apps/hospitality-web`.

Requirements:
1. Create `apps/hospitality-web` using Next.js 14+ with App Router:
   - TypeScript, Tailwind CSS
   - Use `@cloudit/ui` shared package
   - Configure next.config.js for standalone output
2. Folder structure:
   - `src/app/layout.tsx` — root layout with auth, theme, toast
   - `src/app/page.tsx` — redirect to /dashboard
   - `src/app/login/page.tsx` — reuse platform auth (redirect to platform login or shared login)
   - `src/app/dashboard/page.tsx` — hospitality dashboard
   - `src/app/dashboard/layout.tsx` — sidebar with hospitality-specific nav
   - `src/components/`
   - `src/lib/api.ts` — API client pointing to api-hospitality.cloudit.lk
   - `src/hooks/`
3. `package.json` with name `@cloudit/hospitality-web`
4. `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`
5. `.env.example` with NEXT_PUBLIC_API_URL=https://api-hospitality.cloudit.lk
6. Update root workspaces and install.
7. Create Dockerfile for hospitality-web (similar to platform-web)
8. Update docker-compose to include hospitality-web service
9. Update Traefik labels for `hospitality.cloudit.lk`
10. Commit with message: "feat(hospitality-web): initialize Next.js app"
11. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.6 done".
```

---

### Task 4.7 — Build Hospitality Dashboard & Property Management

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.7.

Your task: Build the Hospitality dashboard and property management pages.

Requirements:

**Hospitality Dashboard** (`apps/hospitality-web/src/app/dashboard/page.tsx`):
1. Stats cards:
   - Today's Check-ins
   - Today's Check-outs
   - Occupancy Rate
   - Today's Revenue
2. Quick action buttons: New Reservation, Check-in Guest, Generate Invoice
3. Recent reservations table (last 10)
4. Room status overview (available, occupied, maintenance, cleaning counts)

**Properties Page** (`apps/hospitality-web/src/app/dashboard/properties/page.tsx`):
1. Table of properties with columns: Name, Address, Rooms, Actions (Edit, Delete)
2. Add Property button → modal form
3. Edit Property → modal form
4. Delete with confirmation

**Rooms Management Page** (`apps/hospitality-web/src/app/dashboard/rooms/page.tsx`):
1. Filter by property and room type
2. Table: Room Number, Type, Floor, Status, Actions
3. Status badge with color coding
4. Quick status change dropdown
5. Add Room modal
6. Edit Room modal

**Room Types Page** (`apps/hospitality-web/src/app/dashboard/room-types/page.tsx`):
1. Table: Name, Base Price, Max Occupancy, Rooms Count, Actions
2. Add/Edit/Delete modals

**API Integration**:
- Connect to hospitality-api endpoints built in previous tasks
- Use the shared API client
- Handle loading and error states

After implementation:
1. Test all pages in dev mode.
2. Commit with message: "feat(hospitality-web): add dashboard and property management"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.7 done".
```

---

### Task 4.8 — Build Reservations, Calendar & Check-in/out UI

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.8.

Your task: Build the reservations UI, booking calendar, and check-in/check-out flows for `apps/hospitality-web`.

Requirements:

**Reservations Page** (`apps/hospitality-web/src/app/dashboard/reservations/page.tsx`):
1. Table with columns: Reservation #, Guest, Room, Check-in, Check-out, Status, Total, Actions
2. Status filters: All, Pending, Confirmed, Checked In, Checked Out, Cancelled
3. Date range filter
4. Search by guest name or reservation number
5. New Reservation button → modal form:
   - Guest select (searchable) or create new guest inline
   - Room select (filtered by availability for date range)
   - Check-in/out dates
   - Adults, children
   - Notes
6. View Reservation detail modal
7. Edit Reservation modal
8. Cancel Reservation button with reason

**Booking Calendar** (`apps/hospitality-web/src/app/dashboard/calendar/page.tsx`):
1. Month view calendar (use a lightweight calendar library like react-calendar or build simple)
2. Each date shows:
   - Number of check-ins (green)
   - Number of check-outs (red)
   - Occupancy percentage
3. Click date → show reservations for that day
4. Navigation: previous/next month
5. Color coding for occupancy levels

**Check-in Flow** (`apps/hospitality-web/src/app/dashboard/checkin/page.tsx`):
1. List today's expected check-ins
2. Search by name or reservation number
3. Check-in button → confirmation modal → updates status
4. Print/view registration card placeholder

**Check-out Flow** (`apps/hospitality-web/src/app/dashboard/checkout/page.tsx`):
1. List today's expected check-outs
2. Show room charges summary
3. Show tax breakdown
4. Generate invoice button
5. Check-out button → confirmation → updates status, generates invoice

**Guests Page** (`apps/hospitality-web/src/app/dashboard/guests/page.tsx`):
1. Guest directory with search
2. Guest profile view (reservation history)
3. Add/Edit guest

After implementation:
1. Test the full reservation flow.
2. Commit with message: "feat(hospitality-web): add reservations, calendar, check-in/out"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.8 done".
```

---

### Task 4.9 — Invoices & Reports UI

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 4, Task 4.9.

Your task: Build the invoices and reports UI for `apps/hospitality-web`.

Requirements:

**Invoices Page** (`apps/hospitality-web/src/app/dashboard/invoices/page.tsx`):
1. Table: Invoice #, Guest, Amount, Status, Issue Date, Due Date, Actions
2. Status filters: All, Draft, Issued, Paid, Overdue
3. View Invoice button → modal showing:
   - Property details
   - Guest details
   - Line items (room charges)
   - Tax breakdown (Service Charge, TDL, SSCL, VAT)
   - Total amount
   - Payment status
4. Mark as Paid button
5. Generate PDF placeholder button

**Invoice Detail Component**:
1. Clean, printable layout
2. Sri Lankan tax breakdown clearly shown
3. Company header with placeholder logo

**Reports Dashboard** (`apps/hospitality-web/src/app/dashboard/reports/page.tsx`):
1. Date range picker
2. Report type selector: Occupancy, Revenue, Guests, Reservations
3. Generate Report button
4. Simple data table for report results
5. Export to CSV placeholder button

**Mobile-First Polish**:
1. Ensure all tables are scrollable on mobile
2. Ensure modals fit mobile screens
3. Touch-friendly buttons and inputs

After implementation:
1. Test invoice display with API data.
2. Commit with message: "feat(hospitality-web): add invoices and reports UI"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 4.9 done — Sprint 4 complete".
```

---

## SPRINT 5 — AI & Automation Preparation

### Sprint 5 Goal
Prepare the foundation for AI and automation without building full features yet.

---

### Task 5.1 — n8n Webhook Structure & Event System

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 5, Task 5.1.

Your task: Build the event system and n8n webhook structure in `apps/platform-api`.

Requirements:

**Event System** (`src/events/`):
1. Create an event emitter service using NestJS EventEmitter
2. Define event types as constants:
   - booking.created
   - booking.updated
   - booking.cancelled
   - booking.checked_in
   - booking.checked_out
   - invoice.generated
   - user.created
   - user.login
3. Create event payload interfaces for each event type
4. Create EventPublisherService that:
   - Emits events locally
   - Sends webhook to n8n if configured
   - Logs all events

**Webhook Configuration**:
1. Add to .env.example: N8N_WEBHOOK_URL=https://n8n.cloudit.lk/webhook/cloudit-events
2. Add N8N_WEBHOOK_SECRET for signature verification
3. Create WebhookService that:
   - Signs payloads with HMAC-SHA256
   - Retries failed webhooks (3 attempts with backoff)
   - Logs webhook attempts

**Integration in Hospitality API**:
1. Emit `booking.created` when a reservation is created
2. Emit `booking.checked_in` on check-in
3. Emit `booking.checked_out` on check-out
4. Emit `invoice.generated` when invoice is created

**Database**:
1. Add EventLog model to platform-api Prisma schema:
   - id, eventType, payload (JSON), status, webhookUrl, responseStatus, createdAt
2. Create migration
3. Log all emitted events

After implementation:
1. Test event emission with a simple script.
2. Commit with message: "feat(platform): add event system and n8n webhook structure"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 5.1 done".
```

---

### Task 5.2 — Example n8n Workflow & AI Module Placeholder

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 5, Task 5.2.

Your task: Create example n8n workflow and AI module placeholders.

Requirements:

**n8n Workflow Export** (`infra/n8n/workflows/`):
1. Create `booking-notification.json` — an n8n workflow that:
   - Trigger: Webhook node listening for `booking.created`
   - Action: Send email notification (placeholder, using n8n email node)
   - Action: Log to Google Sheets or internal DB (placeholder)
   - Include instructions in a README on how to import into n8n
2. Create `checkin-reminder.json` — workflow that:
   - Trigger: Cron (daily at 9 AM)
   - Action: Query hospitality API for today's check-ins
   - Action: Send WhatsApp message placeholder (use HTTP Request node pointing to future WhatsApp API)

**AI Module Placeholder** (`apps/platform-api/src/ai/`):
1. Create AiService with methods:
   - generateResponse(prompt: string): Promise<string> — placeholder returns "AI response placeholder"
   - summarizeText(text: string): Promise<string> — placeholder
   - analyzeSentiment(text: string): Promise<string> — placeholder
2. Create AiController with endpoints:
   - POST /ai/generate — accepts prompt, returns placeholder
   - POST /ai/summarize — accepts text, returns placeholder
3. Add AI_PROVIDER env var to .env.example (openai, anthropic, local)
4. Add AI_API_KEY placeholder

**WhatsApp Integration Placeholder** (`apps/platform-api/src/integrations/`):
1. Create WhatsAppService with methods:
   - sendMessage(phone: string, message: string): Promise<void> — logs to console for now
   - sendTemplate(phone: string, templateId: string, data: any): Promise<void> — placeholder
2. Create WhatsAppController with endpoint for webhook verification (for future Meta integration)
3. Add WHATSAPP_API_KEY, WHATSAPP_PHONE_NUMBER_ID to .env.example

**Documentation**:
1. Create `docs/ai-automation-setup.md` explaining:
   - How to import n8n workflows
   - How to configure webhooks
   - How to add AI provider later
   - How to connect WhatsApp Business API later

After implementation:
1. Commit with message: "feat(platform): add n8n workflows, AI and WhatsApp placeholders"
2. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 5.2 done".
```

---

### Task 5.3 — Event System UI & Integration Docs

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 5, Task 5.3.

Your task: Add event logs UI and finalize integration documentation.

Requirements:

**Event Logs Page** (`apps/platform-web/src/app/dashboard/admin/events/page.tsx`):
1. Table showing event logs from platform-api:
   - Event Type
   - Payload (collapsible JSON view)
   - Status (success, failed, pending)
   - Webhook URL
   - Response Status
   - Created At
2. Filter by event type and status
3. Retry failed events button (calls API to retry)
4. Pagination

**Integration Settings Page** (`apps/platform-web/src/app/dashboard/admin/integrations/page.tsx`):
1. n8n webhook URL configuration
2. n8n webhook secret configuration
3. AI provider selection (dropdown: OpenAI, Anthropic, Local, None)
4. AI API key input (masked)
5. WhatsApp API key and phone number ID inputs
6. Save button → PATCH to platform-api settings endpoint
7. Test webhook button → sends test event

**API Endpoints** (in platform-api):
1. GET /admin/events — list event logs with pagination
2. POST /admin/events/:id/retry — retry failed webhook
3. GET /admin/integrations/settings — get current integration settings
4. PATCH /admin/integrations/settings — update settings
5. POST /admin/integrations/test-webhook — send test event to n8n

**Documentation**:
1. Update `docs/ai-automation-setup.md` with UI usage instructions
2. Create `docs/n8n-workflows.md` documenting each workflow
3. Create `docs/ai-integration-guide.md` for future AI implementation

After implementation:
1. Commit with message: "feat(platform): add event logs UI and integration settings"
2. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 5.3 done — Sprint 5 complete".
```

---

## SPRINT 6 — Production Hardening

### Sprint 6 Goal
Improve reliability, backups, security, and documentation for production.

---

### Task 6.1 — Backup & Restore Scripts

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 6, Task 6.1.

Your task: Improve backup and restore scripts in `infra/backups/`.

Requirements:

**Backup Script** (`infra/backups/backup.sh`):
1. Create a bash script that:
   - Dumps all PostgreSQL databases (platform, hospitality, and any future ones)
   - Backs up Redis data (if possible, or document that Redis is cache-only)
   - Backs up n8n workflows (export from n8n API or volume)
   - Backs up Uptime Kuma data (volume backup)
   - Encrypts backups with GPG (using BACKUP_ENCRYPTION_KEY from env)
   - Compresses with tar.gz
   - Stores in /opt/backups/local/ with date-stamped filenames
   - Retains only last 7 days of backups (auto-delete older)
   - Logs all actions to /var/log/cloudit-backup.log
2. Make script executable
3. Add to docker-compose as a cron job or document how to run via host cron

**Restore Script** (`infra/backups/restore.sh`):
1. Accept backup filename as argument
2. Decrypt with GPG
3. Extract tar.gz
4. Restore PostgreSQL databases one by one
5. Restore volumes (n8n, uptime-kuma)
6. Verify restore by checking database connectivity
7. Log all actions

**Hetzner Storage Box Sync** (`infra/backups/sync-hetzner.sh`):
1. Placeholder script that:
   - Uses rclone or rsync to sync /opt/backups/local/ to Hetzner Storage Box
   - Reads credentials from env vars
   - Logs sync operations
   - Includes instructions for setup
2. Mark as optional/future feature

**Docker Compose Updates**:
1. Add backup volume to docker-compose
2. Ensure backup container has access to postgres and other volumes

**Documentation**:
1. Create `docs/backup-restore.md` with:
   - How to run backup manually
   - How to schedule with cron
   - How to restore from backup
   - How to set up Hetzner Storage Box sync
   - How to test restore procedure

After implementation:
1. Test backup script manually (if possible in dev environment).
2. Commit with message: "feat(infra): add backup and restore scripts"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 6.1 done".
```

---

### Task 6.2 — Health Checks, Logging & Error Handling

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 6, Task 6.2.

Your task: Improve health checks, logging, and error handling across all services.

Requirements:

**Health Checks**:
1. Platform API (`apps/platform-api`):
   - Enhance /health to check: database connectivity, Redis connectivity, disk space
   - Return JSON with status for each component
   - Add memory usage info
2. Hospitality API (`apps/hospitality-api`):
   - Same enhanced health check
3. Add health check endpoints to Docker Compose:
   - Use `healthcheck` directive with curl to /health
   - Set appropriate intervals and retries

**Logging**:
1. Add structured logging (JSON format) to both APIs using NestJS Logger or pino
2. Log all requests with: method, path, status, duration, userId, organizationId
3. Log all errors with stack traces
4. Add request ID correlation (generate X-Request-ID if not present)
5. Add log rotation configuration in Docker Compose:
   - max-size: 10m
   - max-file: 3

**Error Handling**:
1. Create global exception filter in both APIs:
   - Catch all unhandled exceptions
   - Log full error details
   - Return sanitized error to client (no internal details in production)
   - Include request ID in error response
2. Add validation pipe with detailed error messages
3. Add interceptors for:
   - Response transformation (wrap in standard format: { success, data, error })
   - Timeout handling (30s max)

**Docker Compose Updates**:
1. Add logging options to all services
2. Ensure restart policies are set to `unless-stopped`
3. Add `depends_on` with `condition: service_healthy` where appropriate

After implementation:
1. Test health endpoints with curl.
2. Commit with message: "feat(all): improve health checks, logging, and error handling"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 6.2 done".
```

---

### Task 6.3 — Security Hardening & Disk Management

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 6, Task 6.3.

Your task: Apply security hardening and disk usage management.

Requirements:

**Security**:
1. Add rate limiting to both APIs:
   - 100 requests per minute per IP
   - 10 login attempts per minute per IP
   - Use @nestjs/throttler
2. Add helmet.js for security headers:
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Strict-Transport-Security (HSTS)
   - Content-Security-Policy (basic)
3. Add CORS configuration (whitelist domains from env)
4. Add input sanitization (prevent XSS in user inputs)
5. Ensure all passwords are hashed with bcrypt (already done, verify)
6. Add API key authentication for service-to-service communication (optional, document)

**Docker Image Cleanup** (`infra/scripts/cleanup.sh`):
1. Create script that:
   - Removes dangling Docker images
   - Removes unused volumes (except named ones)
   - Prunes build cache older than 7 days
   - Shows disk usage before and after
2. Schedule weekly via cron

**Disk Usage Monitoring** (`infra/scripts/disk-check.sh`):
1. Create script that:
   - Checks disk usage every hour
   - Alerts if usage > 80% (logs to file, we will add notification later)
   - Lists largest directories in /opt and /var/lib/docker
2. Add to cron

**Docker Compose**:
1. Add resource limits to all services (for 8GB RAM):
   - postgres: 1GB
   - redis: 512MB
   - platform-api: 1GB
   - hospitality-api: 1GB
   - platform-web: 512MB
   - hospitality-web: 512MB
   - n8n: 1GB
   - traefik: 256MB
   - uptime-kuma: 512MB
2. Total should stay under 6GB to leave room for OS and spikes

**Documentation**:
1. Update `docs/security.md` with all implemented measures
2. Create `docs/disk-management.md` with cleanup procedures

After implementation:
1. Test rate limiting with curl.
2. Commit with message: "feat(all): add security hardening and disk management"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 6.3 done".
```

---

### Task 6.4 — Deployment Reliability & Documentation

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 6, Task 6.4.

Your task: Improve deployment reliability and finalize documentation.

Requirements:

**GitHub Actions Workflow** (`.github/workflows/deploy.yml`):
1. Improve the deployment workflow:
   - Add build caching for Docker layers
   - Add step to run health checks after deployment
   - Add rollback step if health checks fail
   - Add notification step (log to file for now, Slack/Discord later)
   - Add deployment to staging first (optional, document)
2. Add workflow for PR checks:
   - Lint
   - Type check
   - Unit tests (placeholder)
   - Build check

**Deployment Scripts** (`infra/scripts/`):
1. `deploy.sh` — pull latest, build, restart services, run health checks
2. `rollback.sh` — revert to previous Docker image tag
3. `maintenance.sh` — enable/disable maintenance mode (custom nginx/traefik page)

**Database Migration Safety**:
1. Add `predeploy` script to run migrations before starting app
2. Add migration rollback documentation
3. Add `prisma migrate status` check in deployment

**Incident Recovery Guide** (`docs/incident-recovery.md`):
1. Common issues and solutions:
   - Database connection failure
   - Redis failure
   - Disk full
   - Memory exhaustion
   - SSL certificate expiry
   - Deployment failure
2. Step-by-step recovery procedures
3. Contact/escalation info (placeholder)

**Complete Documentation Review**:
1. Ensure all docs are up to date:
   - `docs/deployment-guide.md`
   - `docs/backup-restore.md`
   - `docs/security.md`
   - `docs/new-app-guide.md`
   - `docs/ai-automation-setup.md`
2. Add table of contents to main README.md
3. Add architecture diagram description (ASCII art or link to future diagram)

After implementation:
1. Commit with message: "feat(docs): improve deployment reliability and documentation"
2. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 6.4 done — Sprint 6 complete".
```

---

## SPRINT 7 — Future Product Readiness

### Sprint 7 Goal
Prepare the structure for OrbitOne, TouchOrbit HR, and future SaaS apps without fully building them.

---

### Task 7.1 — Create Empty App Shells

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 7, Task 7.1.

Your task: Create empty app shells for OrbitOne and TouchOrbit HR.

Requirements:

**OrbitOne** (Digital Business Cards):
1. Create `apps/orbitone-api/`:
   - Copy structure from `apps/hospitality-api` but minimal
   - NestJS setup with Prisma
   - Separate database: `orbitone`
   - Auth middleware (reuse from platform)
   - Health check endpoint
   - `.env.example`, `Dockerfile`, `prisma/schema.prisma` (empty schema with just User/Organization relation)
   - Port: 3003
2. Create `apps/orbitone-web/`:
   - Next.js setup similar to hospitality-web
   - Minimal pages: login (redirects to platform), dashboard placeholder
   - Uses `@cloudit/ui`
   - `.env.example`, `Dockerfile`
   - Port: 3004 (or use Next.js default with Traefik)
3. Add to docker-compose with Traefik labels:
   - `orbitone.cloudit.lk`
   - `api-orbitone.cloudit.lk`

**TouchOrbit HR**:
1. Create `apps/touchorbit-api/`:
   - Same minimal structure
   - Database: `touchorbit`
   - Port: 3005
2. Create `apps/touchorbit-web/`:
   - Same minimal structure
   - Port: 3006
3. Add to docker-compose with Traefik labels:
   - `touchorbit.cloudit.lk`
   - `api-touchorbit.cloudit.lk`

**Database Setup**:
1. Ensure PostgreSQL creates these databases on startup:
   - `orbitone`
   - `touchorbit`
2. Add to postgres init script or docker-compose environment

**Root Workspace Updates**:
1. Add all new apps to root `package.json` workspaces
2. Update `pnpm-workspace.yaml` if using pnpm

After implementation:
1. Verify all new apps build successfully.
2. Commit with message: "feat(apps): add OrbitOne and TouchOrbit HR app shells"
3. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 7.1 done".
```

---

### Task 7.2 — Database Separation & Routing Examples

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 7, Task 7.2.

Your task: Document and demonstrate database separation and routing patterns.

Requirements:

**Database Separation Examples**:
1. In `apps/orbitone-api/prisma/schema.prisma`, add example models:
   - Card (digital business card)
   - CardTemplate
   - CardView (analytics)
   - Show how they relate to shared User/Organization
2. In `apps/touchorbit-api/prisma/schema.prisma`, add example models:
   - Employee
   - Department
   - LeaveRequest
   - AttendanceRecord
3. Show clear separation: each app has its own database, no cross-db queries
4. Add migration files (even if empty, for pattern demonstration)

**Routing Examples** (`docs/routing-examples.md`):
1. Document how Traefik routes work:
   - Host rule matching
   - Path prefix matching
   - Middleware usage (auth, rate limit, etc.)
2. Example for adding a new subdomain:
   - DNS record in Cloudflare
   - Docker Compose labels
   - SSL certificate auto-generation
3. Example for path-based routing (if needed later)

**Shared Package Usage Examples** (`docs/shared-packages.md`):
1. How to use `@cloudit/ui` in a new app
2. How to use `@cloudit/auth` for authentication
3. How to use `@cloudit/database` for Prisma client (if shared)
4. How to add a new shared package

**Environment Configuration** (`docs/environment-setup.md`):
1. Template for new app `.env.example`
2. Required vs optional variables
3. How to generate secrets
4. How to manage env vars in production (document, not implement)

After implementation:
1. Commit with message: "feat(docs): add database separation and routing examples"
2. Push to GitHub: `git push origin main`

After pushing, confirm completion and tell me "Task 7.2 done".
```

---

### Task 7.3 — New SaaS Onboarding Guide & Final Review

**Prompt:**

```
You are building the CloudIT Platform. We are in Sprint 7, Task 7.3 (FINAL TASK).

Your task: Create the complete "How to add a new SaaS product" guide and do a final review.

Requirements:

**New SaaS Product Onboarding Guide** (`docs/new-saas-product-guide.md`):
1. Step-by-step guide to add a new product (e.g., "CloudIT CRM"):
   - Step 1: Create API app (`apps/crm-api`)
   - Step 2: Create Web app (`apps/crm-web`)
   - Step 3: Add database to PostgreSQL
   - Step 4: Add Prisma schema
   - Step 5: Add to Docker Compose
   - Step 6: Add Traefik routing
   - Step 7: Add DNS records
   - Step 8: Add to CI/CD workflow
   - Step 9: Add to backup scripts
   - Step 10: Add monitoring checks
   - Step 11: Deploy
2. Include checklist for each step
3. Include common pitfalls and solutions
4. Include resource estimation (RAM, CPU, disk per app)

**Architecture Diagram Description** (`docs/architecture.md`):
1. Text-based description of the full architecture:
   - Server: Hetzner CX33 (4 vCPU, 8GB RAM, 80GB SSD)
   - OS: Ubuntu 24.04
   - Docker + Docker Compose
   - Traefik (reverse proxy, SSL)
   - PostgreSQL (multi-database)
   - Redis (cache, sessions)
   - n8n (automation)
   - Uptime Kuma (monitoring)
   - Apps: Platform, Hospitality, OrbitOne, TouchOrbit
   - Shared packages: UI, Auth, Database, Config
2. Resource allocation table
3. Network diagram description (ASCII art)

**Final Repository Review**:
1. Check all `.env.example` files are present and complete
2. Check no real secrets are committed (scan for passwords, keys)
3. Check all Dockerfiles are optimized (multi-stage, minimal layers)
4. Check all services have health checks
5. Check all services have restart policies
6. Check root README.md is complete and accurate
7. Check all documentation links work

**Final README.md Updates**:
1. Project overview
2. Tech stack list
3. Quick start guide
4. Links to all documentation
5. Sprint completion status
6. Contribution guidelines (for future team)
7. License placeholder

After implementation:
1. Do a final `git status` to ensure nothing is uncommitted.
2. Commit with message: "docs: finalize new SaaS onboarding guide and architecture docs"
3. Push to GitHub: `git push origin main`
4. Tag the release: `git tag -a v0.1.0 -m "CloudIT Platform v0.1.0 - MVP Complete"`
5. Push tag: `git push origin v0.1.0`

After pushing, confirm completion and tell me "Task 7.3 done — SPRINT 7 COMPLETE — ALL SPRINTS COMPLETE".
```

---

## APPENDIX — Quick Reference

### How to Use These Instructions

1. **One task at a time.** Copy the prompt block for the current task only.
2. **Wait for confirmation.** Do not proceed until Kimi Claw says "Task X done".
3. **If Kimi Claw crashes:** Restart Kimi Claw, give it the same task again, and say "Continue from where we left off."
4. **If stuck:** Ask Kimi Claw to explain what it has done so far, then provide the next task.
5. **Git is your safety net.** Every task ends with a commit and push. If something breaks, you can revert.

### Kimi Claw Best Practices

- Keep prompts under 500 words when possible.
- If a task is too big, ask Kimi Claw to split it further.
- Always verify the Git push was successful before closing Kimi Claw.
- If Kimi Claw modifies many files, ask it to show a summary of changes before committing.
- Use `git diff --stat` to review changes before committing.

### Emergency Contacts (Placeholder)

- Server: Hetzner CX33
- Domain: cloudit.lk (Cloudflare)
- Repo: https://github.com/Haneefadevops/cloudit-platform.git
- Local Path: `C:\Project\cloudit-platform`

---

*Document generated for CloudIT Platform — Sprints 3–7*
*Use with Kimi Claw Desktop — One task at a time*
