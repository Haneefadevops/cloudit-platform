# WanderLuxe Travel Pitch Site — Phased Build Plan

> **Project:** Luxury travel pitch website with live package configurator  
> **App name:** `wanderluxe-landing`  
> **Location:** `apps/wanderluxe-landing`  
> **Stack:** Next.js 14 + React 18 + TypeScript + Tailwind CSS + Framer Motion  
> **Images:** Unsplash placeholder URLs  
> **Deployment:** Docker container with static export  
> **Brand:** *WanderLuxe* — “Curated journeys, effortless memories.”

---

## How to use this plan

Each phase below is designed to be **self-contained**. When you start a new session, copy the **Session start prompt** for the phase you want to run and paste it as your first message. The AI should read this file first, complete only that phase, verify the checkpoint, and then stop cleanly.

**Do not proceed to the next phase until the current phase checkpoint is verified.**

---

## Phase 1 — Scaffold the Next.js app

### Objective
Create the `wanderluxe-landing` app inside the monorepo, set up the build toolchain, and confirm the dev server starts.

### Files to create / edit
- `apps/wanderluxe-landing/package.json`
- `apps/wanderluxe-landing/tsconfig.json`
- `apps/wanderluxe-landing/next.config.js`
- `apps/wanderluxe-landing/tailwind.config.ts`
- `apps/wanderluxe-landing/postcss.config.js`
- `apps/wanderluxe-landing/src/app/layout.tsx`
- `apps/wanderluxe-landing/src/app/page.tsx`
- `apps/wanderluxe-landing/src/app/globals.css`

### Implementation notes
- Mirror `apps/thereplyte-landing` structure and versions where possible.
- Use Next.js `14.2.x`, React `18.3.x`, Tailwind `3.4.x`, Framer Motion `11.x`.
- Configure `next.config.js` with `output: 'export'` and `distDir: 'out'` for static export.
- Pick dev port `3030` to avoid collisions.
- Keep `src/app/page.tsx` minimal for now — just a heading and placeholder text.

### Verification / checkpoint
- [x] `npm install` (or `npm install` from app folder) completes without errors.
- [x] `npm run dev` starts on port `3030`.
- [x] Browser shows the placeholder page with Tailwind styles applied.

### Session start prompt
```
Resume the WanderLuxe travel pitch site build. Read docs/WANDERLUXE_BUILD_PLAN.md and complete only Phase 1: Scaffold the Next.js app in apps/wanderluxe-landing. Match the structure of apps/thereplyte-landing. Use Next.js 14, React 18, TypeScript, Tailwind CSS, and Framer Motion. Configure static export with output: 'export' and distDir: 'out'. Use dev port 3030. After the dev server runs and the placeholder page shows Tailwind styles, update the checklist in the plan file and stop. Do not move to Phase 2.
```

---

## Phase 2 — Global design tokens, layout, Nav, and Footer

### Objective
Establish the brand visual system and wrap the site in a consistent shell.

### Files to create / edit
- `apps/wanderluxe-landing/tailwind.config.ts`
- `apps/wanderluxe-landing/src/app/globals.css`
- `apps/wanderluxe-landing/src/app/layout.tsx`
- `apps/wanderluxe-landing/src/components/Nav.tsx`
- `apps/wanderluxe-landing/src/components/Footer.tsx`
- `apps/wanderluxe-landing/src/components/Reveal.tsx`

### Implementation notes
**Brand palette (Tailwind extend):**
- `navy-900`: `#0B1120` — primary dark
- `navy-800`: `#12203A` — secondary dark
- `sand-50`: `#FAF8F5` — background
- `sand-100`: `#F3EFE8` — subtle surfaces
- `gold-400`: `#D4AF37` — accents
- `gold-500`: `#C5A028` — hover accents

**Typography:**
- Use system sans stack but set a clean font-family via Tailwind `font-sans`. Inter is the default modern choice; load via `next/font/google`.

**Components:**
- `Nav.tsx`: fixed or sticky top nav with WanderLuxe logo, smooth-scroll links (Destinations, Configurator, Testimonials, Contact), and a “Plan My Trip” CTA button.
- `Footer.tsx`: logo, quick links, social placeholders, copyright.
- `Reveal.tsx`: reusable Framer Motion scroll-reveal wrapper (`opacity: 0, y: 28` → `opacity: 1, y: 0`), matching the thereplyte-landing pattern.

### Verification / checkpoint
- [x] Brand colors render correctly in Nav and Footer.
- [x] Smooth-scroll links target correct section IDs.
- [x] `Reveal` component animates elements on scroll.
- [x] No layout shift or console errors.

### Session start prompt
```
Resume the WanderLuxe travel pitch site build. Read docs/WANDERLUXE_BUILD_PLAN.md and complete only Phase 2: Global design tokens, layout, Nav, and Footer in apps/wanderluxe-landing. Use the brand palette defined in the plan, load Inter via next/font/google, create Reveal.tsx for scroll animations, and build a sticky Nav and a Footer. Verify the shell renders on all pages with no errors, update the checklist, and stop. Do not move to Phase 3.
```

---

## Phase 3 — Hero and trust strip

### Objective
Build the first impression: a premium hero with animated headline, CTAs, and a trust strip below it.

### Files to create / edit
- `apps/wanderluxe-landing/src/components/Hero.tsx`
- `apps/wanderluxe-landing/src/components/TrustStrip.tsx`
- `apps/wanderluxe-landing/src/app/page.tsx`

### Implementation notes
**Hero.tsx:**
- Full-width section with a subtle dark overlay over an Unsplash hero image (e.g., Maldives overwater villa).
- Animated headline using Framer Motion stagger:  
  *“Experience the Extraordinary”* or *“Curated journeys, effortless memories.”*
- Subheadline and two CTAs:
  - Primary: “Explore Destinations” (scrolls to #destinations)
  - Secondary: “Build My Trip” (scrolls to #configurator)
- Add a soft gradient vignette for readability.

**TrustStrip.tsx:**
- Horizontal row with 4–5 trust metrics:  
  “12,000+ happy travelers”, “500+ curated trips”, “4.9/5 rating”, “24/7 concierge”, “100% customizable”
- Use small icons from inline SVGs.

### Verification / checkpoint
- [x] Hero renders with overlay, headline animation, and CTAs.
- [x] Trust strip displays metrics in a responsive row.
- [x] CTA links scroll to the correct section IDs.
- [x] Looks good on desktop and mobile.

### Session start prompt
```
Resume the WanderLuxe travel pitch site build. Read docs/WANDERLUXE_BUILD_PLAN.md and complete only Phase 3: Hero and trust strip in apps/wanderluxe-landing. Build Hero.tsx with an Unsplash background image, animated headline, subheadline, and two CTAs. Build TrustStrip.tsx with 4-5 trust metrics. Wire them into src/app/page.tsx. Verify the section renders and CTAs scroll correctly, update the checklist, and stop. Do not move to Phase 4.
```

---

## Phase 4 — Featured destinations

### Objective
Showcase 5 luxury destinations as animated cards with hover effects.

### Files to create / edit
- `apps/wanderluxe-landing/src/components/Destinations.tsx`
- `apps/wanderluxe-landing/src/lib/data.ts`
- `apps/wanderluxe-landing/src/app/page.tsx`

### Implementation notes
**data.ts:**
Define an array of destinations, e.g.:
- Maldives — overwater villas, diving
- Santorini — sunsets, private terraces
- Swiss Alps — ski chalets, spa
- Bali — rice terraces, wellness retreats
- Kyoto — temples, ryokan stays

Each destination object: `id`, `name`, `tagline`, `image`, `priceFrom`, `duration`, `highlights[]`.
Use Unsplash source URLs.

**Destinations.tsx:**
- Section ID: `#destinations`
- Section title + subtitle with `Reveal`
- Responsive grid (1 col mobile, 2 tablet, 3 desktop) with a featured larger card for the first item, or uniform 5 cards.
- Card design: full image background, gradient overlay at bottom, destination name, short tagline, “From $X / person”, and a hover lift + scale effect.
- Clicking a card could pre-select it in the configurator (set hash or shared state). For this phase, focus on rendering only.

### Verification / checkpoint
- [x] 5 destination cards render with real Unsplash images.
- [x] Hover animation works smoothly.
- [x] Grid is responsive across breakpoints.
- [x] No broken image links.

### Session start prompt
```
Resume the WanderLuxe travel pitch site build. Read docs/WANDERLUXE_BUILD_PLAN.md and complete only Phase 4: Featured destinations in apps/wanderluxe-landing. Create src/lib/data.ts with 5 luxury destinations using Unsplash URLs. Build Destinations.tsx with a responsive grid of animated cards showing image, name, tagline, and price. Wire it into page.tsx under #destinations. Verify cards render and hover animations work, update the checklist, and stop. Do not move to Phase 5.
```

---

## Phase 5 — Live package configurator (core dynamic demo)

### Objective
Build the interactive centerpiece: users pick options and see price + itinerary update live.

### Files to create / edit
- `apps/wanderluxe-landing/src/components/Configurator.tsx`
- `apps/wanderluxe-landing/src/components/Itinerary.tsx`
- `apps/wanderluxe-landing/src/lib/pricing.ts`
- `apps/wanderluxe-landing/src/app/page.tsx`
- `apps/wanderluxe-landing/src/lib/data.ts`

### Implementation notes
**State shape (Configurator):**
```ts
const [destinationId, setDestinationId] = useState('maldives');
const [tier, setTier] = useState<'essential' | 'premium' | 'luxe'>('premium');
const [travelers, setTravelers] = useState(2);
const [nights, setNights] = useState(5);
```

**Controls:**
- Destination select (dropdown or horizontal chips with images).
- Tier toggle (3 buttons).
- Travelers stepper.
- Nights stepper.

**pricing.ts:**
- Base price per destination per night (per person).
- Tier multiplier: Essential `1.0`, Premium `1.45`, Luxe `2.1`.
- Total formula: `basePricePerNight * nights * travelers * tierMultiplier`.
- Add a fixed concierge fee for Luxe tier.

**Itinerary.tsx:**
- Display a day-by-day summary that changes based on destination.
- Include inclusions list (flights, hotel, transfers, guide, spa credit) that updates by tier.
- Animate changes with Framer Motion `AnimatePresence`.

**Visuals:**
- Split layout: controls on left, live summary on right (sticky on desktop).
- Large animated total price.
- “Request this trip” CTA inside the summary.

### Verification / checkpoint
- [x] Changing destination updates price and itinerary.
- [x] Changing tier updates price and inclusions.
- [x] Changing travelers or nights updates total live.
- [x] Animations are smooth and no jarring layout shifts.
- [x] Summary CTA scrolls to or opens the contact form.

### Session start prompt
```
Resume the WanderLuxe travel pitch site build. Read docs/WANDERLUXE_BUILD_PLAN.md and complete only Phase 5: Live package configurator in apps/wanderluxe-landing. Build Configurator.tsx with state for destination, tier, travelers, and nights. Create pricing.ts with base prices and tier multipliers. Build Itinerary.tsx showing live total price and day-by-day itinerary that updates with AnimatePresence. Wire it into page.tsx under #configurator. Verify all controls change the price and itinerary live, update the checklist, and stop. Do not move to Phase 6.
```

---

## Phase 6 — How it works, testimonials, and final CTA

### Objective
Add the remaining persuasive sections before the footer.

### Files to create / edit
- `apps/wanderluxe-landing/src/components/HowItWorks.tsx`
- `apps/wanderluxe-landing/src/components/Testimonials.tsx`
- `apps/wanderluxe-landing/src/components/FinalCTA.tsx`
- `apps/wanderluxe-landing/src/app/page.tsx`

### Implementation notes
**HowItWorks.tsx:**
- 3-step horizontal process:  
  1. *Tell us your dream* — share destination and preferences  
  2. *We curate it* — experts build a bespoke itinerary  
  3. *Travel effortlessly* — enjoy 24/7 concierge support
- Use simple SVG icons and `Reveal` animations.

**Testimonials.tsx:**
- 3 cards with quote, name, location, and a small avatar placeholder.
- Use `Reveal` with stagger.

**FinalCTA.tsx:**
- Section ID: `#contact`
- Headline + subheadline + contact form (name, email, phone, message).
- Form inputs are functional UI only — no backend submission in this demo.
- A success placeholder message appears on “submit”.

### Verification / checkpoint
- [x] How it works steps display cleanly with icons.
- [x] Testimonial cards render with quotes and avatars.
- [x] Final CTA form has all fields and shows a success state on submit.
- [x] All sections use `Reveal` scroll animations.

### Session start prompt
```
Resume the WanderLuxe travel pitch site build. Read docs/WANDERLUXE_BUILD_PLAN.md and complete only Phase 6: How it works, testimonials, and final CTA in apps/wanderluxe-landing. Build HowItWorks.tsx with 3 steps, Testimonials.tsx with 3 quote cards, and FinalCTA.tsx with a contact form under #contact. Wire them into page.tsx. Verify all sections render with scroll-reveal animations and the form shows a success state, update the checklist, and stop. Do not move to Phase 7.
```

---

## Phase 7 — Docker, static export, and build verification

### Objective
Make the site hostable by adding Docker support and confirming a clean static build.

### Files to create / edit
- `apps/wanderluxe-landing/Dockerfile`
- `apps/wanderluxe-landing/nginx.conf`
- `apps/wanderluxe-landing/next.config.js`
- `apps/wanderluxe-landing/.dockerignore`

### Implementation notes
- Dockerfile pattern should mirror `apps/thereplyte-landing/Dockerfile`.
- Multi-stage build:
  1. `node:20-alpine` — install + build static export
  2. `nginx:alpine` — serve the `out/` folder
- `nginx.conf` should serve `index.html` for all routes and handle 404s by falling back.
- Ensure all Unsplash image URLs use `https://` and do not break CSP.
- Test build command from app folder: `npm run build`

### Verification / checkpoint
- [x] `npm run build` produces an `out/` folder with `index.html`.
- [x] `docker build -t wanderluxe-landing .` succeeds.
- [x] `docker run -p 3030:80 wanderluxe-landing` serves the full site.
- [x] All pages/sections visible inside the container.

### Session start prompt
```
Resume the WanderLuxe travel pitch site build. Read docs/WANDERLUXE_BUILD_PLAN.md and complete only Phase 7: Docker, static export, and build verification in apps/wanderluxe-landing. Create Dockerfile and nginx.conf matching the thereplyte-landing pattern. Ensure next.config.js has output: 'export'. Run npm run build to produce the out folder, then build and run the Docker image. Verify the site serves inside the container on port 3030, update the checklist, and stop. Do not move to Phase 8.
```

---

## Phase 8 — Polish, responsiveness, and final review

### Objective
Final QA pass: fix bugs, improve mobile layout, tighten animations, and sweep content.

### Files to create / edit
- Any file touched in previous phases.

### Implementation notes
- Check mobile breakpoints: hero text size, card grid, configurator split layout.
- Verify all images have `alt` text and are not 404.
- Ensure buttons have focus/hover states.
- Add `aria-label`s where needed.
- Review console for Framer Motion warnings or hydration errors.
- Replace any remaining placeholder text with on-brand copy.
- Confirm the nav hides or becomes a hamburger on mobile (optional but recommended).

### Verification / checkpoint
- [x] Site looks polished on mobile, tablet, and desktop.
- [x] No console errors or broken images.
- [x] Configurator still updates correctly after all changes.
- [x] Docker build still succeeds.
- [x] Final review checklist complete.

### Session start prompt
```
Resume the WanderLuxe travel pitch site build. Read docs/WANDERLUXE_BUILD_PLAN.md and complete only Phase 8: Polish, responsiveness, and final review in apps/wanderluxe-landing. Do a full QA pass: fix mobile layout issues, ensure all images have alt text, remove console errors, verify accessibility basics, and run the Docker build one more time. Update the final checklist and report completion. Do not add new features.
```

---

## Final hand-off checklist

Use this once Phase 8 is complete:

- [x] `apps/wanderluxe-landing/` exists with full source code.
- [x] `npm run dev` works on port `3030`.
- [x] `npm run build` produces `apps/wanderluxe-landing/out/`.
- [x] Docker image builds and serves the site.
- [x] All sections render: Hero, Trust Strip, Destinations, Configurator, How it Works, Testimonials, Final CTA, Footer.
- [x] Configurator updates price and itinerary live.
- [x] Responsive on mobile, tablet, and desktop.
- [x] No console errors.

---

## Appendix — Brand assets to use

### Color palette
| Name       | Hex       | Usage                          |
|------------|-----------|--------------------------------|
| navy-900   | `#0B1120` | Primary dark, headings, footer |
| navy-800   | `#12203A` | Secondary dark, cards          |
| sand-50    | `#FAF8F5` | Page background                |
| sand-100   | `#F3EFE8` | Subtle surfaces                |
| gold-400   | `#D4AF37` | Accents, icons, highlights     |
| gold-500   | `#C5A028` | Hover states                   |

### Typography
- **Headings:** Inter, weight 700–800, tight tracking.
- **Body:** Inter, weight 400–500, relaxed line height.

### Dummy destination images (Unsplash)
Use high-quality direct Unsplash URLs. Example search terms:
- Maldives overwater villa
- Santorini sunset caldera
- Swiss Alps luxury chalet
- Bali rice terrace infinity pool
- Kyoto bamboo forest temple

Replace with your own images before customer pitch if needed.
