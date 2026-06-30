# OrbitOne Full UI/UX Upgrade Checklist

This is a comprehensive, prioritized list of UI/UX improvements for the OrbitOne frontend. Use it as a roadmap for incremental modernization.

---

## 1. Design System & Tokens

- [ ] Expand CSS variables in `app/globals.css` to include semantic colors:
  - `--color-success`, `--color-success-subtle`
  - `--color-error`, `--color-error-subtle`
  - `--color-warning`, `--color-warning-subtle`
  - `--color-info`, `--color-info-subtle`
- [ ] Add elevation/shadow tokens:
  - `--shadow-card`, `--shadow-dropdown`, `--shadow-dialog`, `--shadow-none`
- [ ] Add radius tokens:
  - `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-full`
- [ ] Add focus-ring tokens:
  - `--ring`, `--ring-offset`, `--ring-secondary`
- [ ] Replace hardcoded Tailwind colors (`bg-red-50`, `text-emerald-700`, `bg-slate-300`) with semantic tokens.
- [ ] Unify font usage: remove redundant `--font-sans` declaration and rely on `next/font` variable.
- [ ] Create a dark-mode token set and `dark` class strategy.
- [ ] Document tokens in `frontend/AGENTS.md` or a new `docs/design-system.md`.

## 2. Component Primitives

- [ ] `Button`
  - Add `link` variant.
  - Add `icon-only` variant with tooltip support.
  - Add press animation (`active:scale-[0.98]`).
  - Standardize spinner behavior (preserve width, swap icon only).
- [ ] `Card`
  - Add `variant` prop: `default`, `interactive`, `flat`, `outlined`.
  - Add `padding` size prop.
- [ ] `Input`
  - Add `helperText` prop.
  - Add icon prefix/suffix slots.
  - Add `aria-invalid` and `aria-describedby` wiring.
  - Improve disabled state styling.
- [ ] `Textarea` (new)
  - Match Input styling.
  - Add character counter.
  - Add auto-resize option.
- [ ] `Label` (new/enhanced)
  - Add `optional` badge variant.
  - Add `error` state color.
- [ ] `Badge`
  - Add `info` and `error` variants.
  - Add `dot` indicator variant.
  - Add soft vs solid variants.
- [ ] `Switch` (new)
  - Replace all 6+ inline toggle implementations.
  - Support `role="switch"`, `aria-checked`, keyboard handling.
  - Add label alignment options.
- [ ] `Avatar` (new)
  - Replace duplicated avatar markup across pages.
  - Support image, initials fallback, size scale, status indicator.
- [ ] `Select` (new)
  - Replace native `<select>` duplicates.
  - Support search, groups, disabled options.
- [ ] `Tabs` (new)
  - Unify tab bars in Connections, Bookings, Scheduling.
  - Support URL-synced state.
- [ ] `Dialog` / `Modal` (new)
  - Replace browser `confirm()` for destructive actions.
  - Support header, footer, close button, backdrop click.
- [ ] `Toast` / `Snackbar` provider (new)
  - Replace inline success/error banners.
  - Support success, error, warning, info variants.
  - Auto-dismiss with pause on hover.
- [ ] `Tooltip` (new)
  - For icon-only buttons and abbreviations.
- [ ] `DropdownMenu` (new)
  - For row actions, header user menu.
- [ ] `Skeleton` (new)
  - Page skeletons, card skeletons, text skeletons.
- [ ] `Separator` (new)
  - Replace direct `border-t` usage.
- [ ] `Accordion` (new)
  - For availability exceptions, FAQs, collapsible sections.
- [ ] `CommandPalette` / `Command` (new)
  - Global Cmd+K navigation.
- [ ] `Calendar` / `DatePicker` (new)
  - Month view for public booking slot picker.
- [ ] `ToggleGroup` (new)
  - For status/lifecycle/priority selectors.
- [ ] `Slider` / `Range` (future)
  - For duration or booking window if needed.

## 3. Layout & Navigation

- [ ] Add a consistent page shell with sticky header pattern.
- [ ] Add breadcrumbs on detail pages instead of only a "Back" button.
- [ ] Add section anchors + sticky sub-navigation on `/dashboard/connections/[id]`.
- [ ] Improve mobile sidebar with backdrop overlay and focus trap.
- [ ] Add sidebar collapse/expand animation and icons-only collapsed state.
- [ ] Add a "Create" button group in sidebar (Event, Meeting type).
- [ ] Add active-state indicator that is more prominent than bottom border.
- [ ] Add scroll-to-top button on long pages.
- [ ] Standardize page max-widths:
  - Landing: `max-w-7xl`
  - Dashboard: `max-w-5xl` or `max-w-6xl`
  - Public profile/booking: `max-w-3xl`
  - Reading content: `max-w-prose`

## 4. Typography

- [ ] Define a strict type scale and use it consistently.
- [ ] Reduce use of `text-2xl`+ outside of page titles and hero.
- [ ] Use `font-semibold` for UI labels, `font-bold` for headings only.
- [ ] Tighten uppercase label tracking (`tracking-label` token).
- [ ] Improve line-height consistency for card titles and body text.
- [ ] Use numeric tabular figures for metrics and times (`tabular-nums`).
- [ ] Ensure link underlines on hover for inline text links.

## 5. Color & Brand

- [ ] Apply 60-30-10 color rule deliberately across all pages.
- [ ] Increase use of secondary blue (`#2563EB`) for CTAs, active states, links.
- [ ] Use accent cyan (`#06B6D4`) sparingly for hover, focus, live badges.
- [ ] Add subtle brand gradient for primary buttons and hero background.
- [ ] Add tinted icon backgrounds (e.g., `bg-blue-50 text-secondary`) for feature cards.
- [ ] Ensure error/warning/success colors are accessible on all backgrounds.
- [ ] Plan and implement dark mode toggle.

## 6. Motion & Micro-interactions

- [ ] Add hover lift on cards: `hover:-translate-y-0.5 hover:shadow-md`.
- [ ] Add button press scale: `active:scale-[0.98]`.
- [ ] Add smooth focus transitions on inputs and buttons.
- [ ] Add page transition fade/slide between dashboard routes.
- [ ] Add staggered entrance for lists and cards.
- [ ] Animate metric numbers counting up on dashboard load.
- [ ] Add toast slide-in animation.
- [ ] Add dialog scale/fade entrance animation.
- [ ] Add shimmer loading skeletons instead of spinners.
- [ ] Respect `prefers-reduced-motion`.

## 7. Feedback & States

- [ ] Replace inline success/error banners with `Toast` notifications.
- [ ] Add optimistic updates for delete/toggle actions.
- [ ] Add undo action inside toast for destructive operations.
- [ ] Standardize empty states across all pages.
- [ ] Add error retry patterns (inline retry button, toast retry).
- [ ] Improve copy-link feedback (consistent toast + icon swap).
- [ ] Add loading states on all submit buttons.
- [ ] Add disabled + tooltip explanations for unavailable actions.
- [ ] Add inline validation errors on forms.
- [ ] Add form-level summary errors at top of forms.

## 8. Forms & Inputs

- [ ] Create a `FormField` wrapper component.
- [ ] Add helper text below inputs.
- [ ] Add inline error messages tied to inputs via `aria-describedby`.
- [ ] Replace raw `<textarea>` with `Textarea` primitive.
- [ ] Replace native selects with `Select` primitive.
- [ ] Add password visibility toggle on login.
- [ ] Add "Forgot password?" link on login.
- [ ] Add password strength indicator on registration.
- [ ] Add inline slug preview/validation on profile/event/meeting-type forms.
- [ ] Add character counters on bio, description, message fields.
- [ ] Add file upload UI for avatars (drag-drop + preview).
- [ ] Add datetime picker improvements or custom calendar for event scheduling.

## 9. Dashboard Pages

### Dashboard Home (`/dashboard`)
- [ ] Redesign as a bento-grid layout.
- [ ] Separate welcome/CTA card from metrics.
- [ ] Add mini trend indicators on metric cards.
- [ ] Add upcoming booking preview card with direct links.
- [ ] Add network summary as compact horizontal chips.
- [ ] Add CRM snapshot with visual breakdown (mini bars or donut).
- [ ] Add quick-action tiles with icons.
- [ ] Hide or soften metrics when all values are zero.

### Profile Builder (`/dashboard/profile`)
- [ ] Add live public-card preview while editing.
- [ ] Replace avatar URL input with image upload.
- [ ] Add inline field validation.
- [ ] Add save shortcut (Ctrl/Cmd+S).
- [ ] Add profile completeness progress indicator.

### Connections (`/dashboard/connections`)
- [ ] Sync active tab to URL query param on change.
- [ ] Add filters (search, company, relationship status).
- [ ] Add bulk actions (delete selected).
- [ ] Replace delete confirm with Dialog.
- [ ] Add quick "Add to network" action on discover cards.
- [ ] Improve row layout: avatar + stacked name/headline/company.
- [ ] Add hover actions in a dropdown menu.

### Connection Detail (`/dashboard/connections/[id]`)
- [ ] Add sticky section navigation.
- [ ] Convert long stacked cards into tabbed or anchored sections.
- [ ] Add inline editing for next step.
- [ ] Add confirmation dialogs for note/follow-up/activity/tag deletion.
- [ ] Improve status/lifecycle/priority selectors with `ToggleGroup`.
- [ ] Add a "Book follow-up" button (already planned in S5).
- [ ] Show recent activity timeline more visually.

### Events (`/dashboard/events`)
- [ ] Add event status badges (Draft / Published / Past).
- [ ] Improve date/time display with timezone.
- [ ] Add attendee search/filter.
- [ ] Add event analytics (check-ins over time).
- [ ] Hide "Book meeting" on attendees when host has no active meeting types.
- [ ] Add public event link copy with QR in a dialog.

### Scheduling (`/dashboard/scheduling/*`)
- [ ] Add scheduling overview cards with icons and KPIs.
- [ ] Add calendar connection status as a persistent top bar.
- [ ] Improve meeting type cards with hover actions.
- [ ] Add duplicate meeting type action.
- [ ] Add drag-to-reorder availability rules (future).
- [ ] Improve availability exceptions UI with calendar dots.
- [ ] Add booking detail drawer/modal.
- [ ] Add reschedule UI with slot picker.
- [ ] Add cancellation reason dialog.

## 10. Public & Marketing Pages

### Landing (`/`)
- [ ] Redesign hero with stronger headline, subheadline, and dual CTAs.
- [ ] Add abstract orbit/network visual or product screenshot.
- [ ] Add social proof row (logos, testimonials, user count).
- [ ] Add bento-grid feature section.
- [ ] Add "How it works" steps section.
- [ ] Add pricing preview or use-case cards.
- [ ] Add a richer footer with links and newsletter.
- [ ] Add subtle animated gradient/mesh background.

### Public Profile (`/u/[slug]`)
- [ ] Make profile card the hero focal point.
- [ ] Promote "Book a meeting" as primary CTA.
- [ ] Move QR code into a share dialog/drawer.
- [ ] Add "Save contact" and "Share" as secondary actions.
- [ ] Add connection status banner for signed-in users.
- [ ] Add recent activity or trust signals if available.

### Public Event (`/e/[slug]`)
- [ ] Improve event hero with date badge and location map placeholder.
- [ ] Add animated check-in success state.
- [ ] Add attendee count and capacity indicator.
- [ ] Add public event share dialog.

### Public Booking (`/book/[slug]` & `/book/[slug]/[meetingTypeSlug]`)
- [ ] Add month calendar view for slot selection.
- [ ] Show meeting types as selectable chips.
- [ ] Pre-fill guest details if signed in.
- [ ] Add timezone selector for visitor.
- [ ] Add "Add to Google Calendar" and "Download ICS" on confirmation.
- [ ] Add "Book another meeting" CTA on confirmation.
- [ ] Add host timezone display.
- [ ] Add slot unavailable fallback with next available suggestion.

## 11. Networking & CRM

- [ ] Improve connection cards with relationship status badges.
- [ ] Add tags as colored chips on connection rows.
- [ ] Add follow-up due date indicator with overdue highlighting.
- [ ] Add lifecycle stage progress visualization.
- [ ] Add priority indicator (dot + label).
- [ ] Improve activity timeline with icons, dates, and collapsible details.
- [ ] Add activity type icons (note, call, email, meeting, other).
- [ ] Add contact merge or deduplication UI (future).

## 12. Accessibility

- [ ] Audit all color contrast ratios.
- [ ] Add `skip-to-content` link.
- [ ] Ensure all interactive elements have visible focus states.
- [ ] Ensure icon-only buttons have `aria-label` or tooltip.
- [ ] Add `role="switch"`, `aria-checked`, keyboard handling to toggles.
- [ ] Associate error messages with inputs via `aria-describedby`.
- [ ] Add semantic landmarks (`<main>`, `<nav>`, `<aside>`, `<section>`).
- [ ] Ensure touch targets are at least 44×44px.
- [ ] Test keyboard navigation through dialogs and menus.
- [ ] Add screen-reader-only descriptions where needed.
- [ ] Support `prefers-reduced-motion`.

## 13. Performance & Assets

- [ ] Configure `next.config.ts` with `images.remotePatterns`.
- [ ] Remove `unoptimized` prop from `next/image` usage.
- [ ] Add image placeholder/blur for avatars.
- [ ] Lazy-load heavy components (QR code, charts).
- [ ] Add `React.memo` to list item components where beneficial.
- [ ] Debounce search inputs consistently.
- [ ] Reduce redundant re-fetching (e.g., `useNetworkStatus` optimization).
- [ ] Add server components for static shells where possible.
- [ ] Add bundle analyzer step.

## 14. Advanced UX Patterns

- [ ] Global command palette (Cmd+K) for navigation and search.
- [ ] Notification center dropdown in header.
- [ ] Onboarding checklist for new users.
- [ ] Inline editing for lightweight fields.
- [ ] Bulk selection and actions on lists.
- [ ] Infinite scroll or proper pagination on discover/connections.
- [ ] Recent searches in discover.
- [ ] Saved filters on connections/discover.
- [ ] Confetti or subtle celebration on first booking/connection.
- [ ] Smart defaults (e.g., auto-detect timezone).

## 15. Mobile & Responsive

- [ ] Audit all pages at 320px, 375px, 768px, 1024px, 1440px.
- [ ] Improve mobile form layouts (stack labels above inputs).
- [ ] Ensure tables/lists work without horizontal scroll.
- [ ] Add bottom-sheet dialogs for mobile actions.
- [ ] Optimize public booking flow for thumb-sized slot buttons.
- [ ] Ensure sidebar does not hide critical CTAs on tablet.
- [ ] Use container queries for card grids where helpful.

## 16. Onboarding & Empty States

- [ ] Design contextual empty-state illustrations.
- [ ] Add CTAs inside every empty state.
- [ ] Add onboarding checklist component.
- [ ] Add tooltips/hints for first-time users.
- [ ] Add a dismissible "Get started" banner on dashboard.
- [ ] Show sample data or demo mode for empty accounts.

## 17. Analytics & Tracking UX

- [ ] Add a lightweight events visualizer for hosts.
- [ ] Show booking conversion funnel (page view → slot selected → confirmed).
- [ ] Show top traffic sources on dashboard.
- [ ] Track and display QR scans vs link clicks.

## 18. Documentation & Process

- [ ] Create `docs/design-system.md` with tokens, components, and usage rules.
- [ ] Add component usage examples in `frontend/AGENTS.md`.
- [ ] Set up Storybook for component development.
- [ ] Add visual regression testing (Chromatic or similar).
- [ ] Define a component-request workflow between Kimi and Codex.

---

## Suggested Implementation Order

### Phase 1 — Foundation (1 week)
1. Expand design tokens.
2. Build `Switch`, `Avatar`, `Textarea`, `Skeleton`, `Toast`, `Dialog` primitives.
3. Fix `next/image` optimization.

### Phase 2 — Feedback & Polish (1 week)
4. Replace inline banners with toasts.
5. Replace browser `confirm()` with dialogs.
6. Add inline form errors and loading skeletons.

### Phase 3 — Visual Upgrade (1–2 weeks)
7. Redesign dashboard as bento grid.
8. Modernize public profile and public booking pages.
9. Add micro-interactions and hover states.

### Phase 4 — Advanced Patterns (2+ weeks)
10. Command palette.
11. Dark mode.
12. Landing page redesign.
13. Image upload for avatars.

---

*Last updated: 2026-06-18*
