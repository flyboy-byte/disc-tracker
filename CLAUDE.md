# Disc Tracker — Claude Context

## What this project is

Two things in one repo:

1. **A live Flask web app** — personal disc golf bag tracker running on a VPS at `51.81.80.126`. Multi-user, local SQLite, no cloud, no accounts. The website is the canonical version and the spec for everything else.

2. **An Android/iOS app port in progress** — Expo (React Native) app, local-first SQLite, targeting Play Store + F-Droid. Plan docs are in `app/`. No app code exists yet — we're still in Phase 0.

---

## Repo layout

```
disc_tracker/
├── app.py                    ← Flask backend
├── templates/
│   ├── index.html            ← main bag view (vanilla JS, ~1200 lines)
│   ├── flightshape.html      ← flight shape tool
│   ├── discsuggestion.html   ← disc suggest tool
│   └── pick.html             ← user picker
├── static/
│   ├── discs_master.json     ← 1,660+ disc library (bundled in app too)
│   ├── physics.js            ← shared flight-arc math (bag view + Flight Shaper); pure functions, no DOM — extraction point for legacyPhysics.ts
│   └── style.css             ← shared CSS tokens/primitives, linked from all 4 templates (see "Frontend CSS" below)
├── tests/
│   └── ui-smoke.spec.js      ← Playwright browser smoke tests (dev-only, see "Testing" below)
├── data/                     ← SQLite DB + secret key (gitignored)
├── disc_tracker.service      ← systemd unit file
├── deploy.sh                 ← push to VPS and restart service
└── app/
    ├── PORT_PLAN.md          ← phased build plan for the mobile app (READ THIS)
    └── RESEARCH.md           ← framework, toolchain, F-Droid, DiscIt API research
```

### Frontend CSS

`static/style.css` holds design tokens (`:root`) and primitives (`.btn`, `.pill`, `.stab-badge`,
`.top-nav`, `.grid`, form fields, etc.) shared across 2+ of the 4 templates, linked via
`<link rel="stylesheet">` in each `<head>`. Each template's own `<style>` block only has what's
genuinely page-specific. Breakpoints are hard-coded pixel values (CSS vars can't be used inside
`@media`) — the canonical scale is documented in a comment at the top of `style.css`; grep all
templates + that file before changing one. `discsuggestion.html` links the shared stylesheet too
but hasn't otherwise been reworked (still simple, low priority).

---

## Running the website locally

```bash
python3 -m venv venv && source venv/bin/activate
pip install flask
python app.py
# → http://localhost:5757
```

Flight-arc physics regression tests (no build step, plain Node):

```bash
node static/physics.test.js
```

### Testing

`static/physics.test.js` — pure-math regression tests, plain Node, no dependencies.

`tests/ui-smoke.spec.js` — Playwright browser smoke tests covering the JS-dependency-contract
items most at risk from CSS/markup changes: card `data-id` + drag-reorder, filter pills,
physics-sim crosswind/dir-hint sync, CSV export/import round-trip. Dev-only — the shipped Flask
app has no build step and doesn't depend on this. One-time setup: `npm install` (needs
`package.json` at repo root), then `npx playwright install chromium`. Run with `npm run test:ui`
(starts `python3 app.py` itself via `playwright.config.js`'s `webServer`, so have the Python venv
active first). Each test run creates its own throwaway user, never touches real bag data.

---

## Deploying to VPS

```bash
./deploy.sh
```

Pushes to GitHub, SSHs to `ubuntu@51.81.80.126`, pulls, syntax-checks, restarts the systemd service.

---

## Website tech

- **Backend:** Flask, Python 3, SQLite (`data/disc_tracker.db`)
- **Frontend:** vanilla JS, no build step, no framework
- **One optional external API** — Marshall Street reference images via `discit-api.fly.dev` (see below); no analytics, no auth
- **CSRF protection** on all POST routes via session token
- The server runs on port 5757

### Key app.py endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | main bag view |
| `/api/data` | GET | export full user data as JSON |
| `/api/data` | POST | import/replace full user data from JSON |
| `/api/arcview` | POST | persist arc-view orientation preference |
| `/api/ms_pic` | GET | look up cached Marshall Street reference image URL for a disc |
| `/api/shotshaper_sim` | POST | run vendored shotshaper rigid-body simulation, return trajectory points |
| `/pick` | GET/POST | user switcher |
| `/flightshape` | GET | flight shape tool |
| `/discsuggestion` | GET | disc suggest tool |

### SQLite schema

```sql
users         (id, username)
discs         (id, user_id, disc_id, mfr, mold, plastic, weight, speed, glide, turn, fade, use_desc, thr, notes, color, sort_order)
user_meta     (user_id, next_id, sort_mode, arc_view)
ms_pic_cache  (lookup_key, pic)   -- cached DiscIt API lookups, keyed by "mfr|mold" lowercase
```

### Marshall Street reference images (DiscIt API)

- Live, on by default. Frontend calls `GET /api/ms_pic?mfr=&mold=`; server queries `discit-api.fly.dev`, matches by brand+name, and caches the result (including "not found") in `ms_pic_cache` so each disc is only looked up once.
- Shown only in the bag view disc detail modal (`showArcDetail` in `index.html`) — **RHBH-only** (that's all the API provides), falls back silently to the computed arc on any error, timeout, missing match, or when arc view isn't RHBH.
- Deliberately **not** in Flight Shaper — that tool's whole purpose is interactively adjusting the arc via sliders, so a static reference image (even at neutral slider defaults) fights the tool's purpose rather than serving it.
- User toggle "MS reference" (checkbox next to the arc-view selector) persisted to `localStorage.useMsApi`, default on. When off, no request is made to the API at all.

### Physics simulation (Flight Shaper "Physics sim" mode)

- Vendored copy of [shotshaper](https://github.com/kegiljarhus/shotshaper) (GPLv3) at `vendor/shotshaper/` — a real rigid-body disc flight simulator (NumPy/SciPy `solve_ivp`) using wind-tunnel/CFD-derived lift/drag/moment coefficients, backed by two papers in `app/references/`. See `vendor/shotshaper/NOTICE.md` for provenance and the one local modification (lazy matplotlib import). **Every refinement to this feature only changes what parameters get passed into the unmodified vendored API — never anything inside `vendor/shotshaper/` itself.**
- **Off by default**, opt-in checkbox next to the arc-view selector in `flightshape.html` (`#physicsSimToggle`), with an archetype picker (`#archetypeSelect`) since only 4 driver-class archetypes exist upstream (`cd1`/`cd5` control drivers, `dd2` distance driver, `fd2` fairway driver) — **no putter or midrange data**.
- **Archetype auto-select:** picking a disc auto-selects the nearest archetype via `pickArchetype()` in `flightshape.html`, based on the disc's own speed/turn/fade — still fully overridable via the dropdown (`(auto)` behavior stops once the user manually picks one, until a new disc is selected). The matching is driven by `ARCHETYPE_PROFILE` in `app.py`, an *empirical* characterization (each archetype run once through shotshaper's own unmodified `.shoot()` with upstream's own example throw params) — not invented physics, just picking among the vendor's 4 pre-built discs. For discs slower than fairway-driver range (speed ≤ 8), a caveat banner (`#sim-caveat`) makes clear this is extrapolating from driver-only data, since no putter/midrange coefficients exist upstream.
- **Real disc weight as mass:** `discs.weight` (grams) is sent as `weightG` and passed to `DiscGolfDisc(archetype, mass=...)`, clamped to 0.140–0.200 kg — the same range upstream's own `disc_gui2d.py` mass slider validates against. Falls back to 175g when a disc has no recorded weight.
- **Crosswind:** a second wind slider (`#sl-crosswind`, sim-mode only) sets the y-component of `environment.winddir` — that's already a 3-axis vector upstream, so this uses the existing API surface, not a new one. Headwind/tailwind stays the x-component.
- Server-side only (`POST /api/shotshaper_sim` in `app.py`) — needs `numpy`, `scipy`, `pyyaml` (see `requirements.txt`). Launch speed and spin rate are approximated from the disc's PDGA speed number (calibrated against shotshaper's own validated example throw), not measured — this is a research/experimental mode, not a replacement for the legacy Bézier arc.
- Renders actual simulated trajectory points (`renderSimPath` in `flightshape.html`) instead of the `arcPoints()` Bézier curve. Falls back to an inline error message on any failure; legacy mode is completely unaffected when the toggle is off.

#### Model agreement diagnostic (documented, not built — same "idea only" state as the mobile app)

A one-off comparison script (not committed — throwaway, run locally against a temp venv +
`node`) normalized both engines' output curves (legacy's lateral offset scaled to its own peak,
sim's likewise) and sampled both at 41 points along flight-fraction (0=tee, 1=landing) to compute
an RMS shape delta per scenario. Finding: **the two engines disagree most at neutral baseline**
(no wind, no hyzer) — every environmental input tested (headwind, tailwind, crosswind, hyzer)
actually *narrowed* the normalized-shape gap relative to that baseline, since both curves become
more one-directional under load and coincidentally converge in shape. Conclusion: physics-sim
isn't a "more accurate" version of the legacy arc for the same disc — they're different first
principles (empirical curve-fit vs. integrated CFD trajectory) and will keep disagreeing on shape
regardless of input. Not a bug in either engine.

**Nothing from this is wired into the app** — no route, no code, no page. If it's ever worth
surfacing, the cheap path is *not* a new settings page: a hidden overlay toggle inside Flight
Shaper's existing physics-sim panel (e.g. gated behind a `?dev=1` query param so it stays
invisible normally) that draws both curves in the same `#arcSVG` at once with a live delta
readout, reusing `arcPoints()` (already client-side) and `/api/shotshaper_sim` (already
client-callable) — no new server logic needed. Deliberately not built yet; revisit only if there's
a real reason to keep checking model agreement over time rather than the one-time answer above.

---

## Website features (all working)

- Drag reorder, stability/type filters, color picker
- "In bag" today's bag checkmarks + filtered CSV export
- `bagFilter` and `baggedIds` persisted to `sessionStorage`
- `arcView` (RHBH/RHFH/LHBH/LHFH) persisted to both server and `localStorage`
- Flight Shape: hyzer/nose/wind/arm/spin sliders, distance estimate, arc visualization
- Disc Suggest: 12 scenario filters (Roller, Max Distance, Reliable Hyzer, etc.)
- iOS vertical slider fix: CSS `transform: rotate(-90deg)` on standard horizontal input
- Mobile: single-column card layout at ≤480px, absolute-positioned "in bag" button

---

## Mobile app — current state

**No app code written yet.** We are at Phase 0 (parity fixtures).

### Read these files before touching anything app-related:
- `app/PORT_PLAN.md` — full phased build plan, minimum credible v1 milestone, parity fixtures
- `app/RESEARCH.md` — toolchain decisions, F-Droid notes, DiscIt API, VPS sync design

### Hard constraints (do not violate):
- Do not rewrite the physics model — port it as `legacyPhysics.ts`, improve separately
- Do not change disc suggestion behavior or stability logic unless a bug is proven
- Do not add cloud backup, analytics, Firebase, Sentry, OAuth, or ads
- Do not make the app depend on the Flask server
- Local-only v1, single-user UX, Android-first
- Do not work ahead — complete and verify each phase before starting the next

### Toolchain (pinned for F-Droid compatibility):
- JDK 21 OpenJDK (not Temurin)
- Android SDK 36
- NDK 27.1.12297006
- Flat `npm` at repo root — no pnpm, no workspace, no monorepo subdir

### Build pipeline:
- Android builds: `./gradlew assembleRelease` (local, not EAS cloud)
- EAS kept in `eas.json` as iOS fallback only
- Signing: `android/local.properties` with null-guard pattern (never committed)
- F-Droid strips signing via `sed -i '/signingConfig /d'` — expected behavior

### Distribution plan:
- D1: Play Store (internal → closed → open track)
- D2: F-Droid self-hosted repo
- D3: Official F-Droid index (after D2 proven)
- Never run D1/D2/D3 in parallel

### Next immediate step:
Phase 0 — run parity fixture tests against the live website and fill in the tables in `PORT_PLAN.md`. Then Phase 1: Expo scaffold with `npx create-expo-app app --template blank-typescript`.

---

## DragTree reference

Developer's other live Expo app (same stack, already on Play Store + F-Droid pipeline). Key learnings already incorporated into RESEARCH.md:
- pnpm → flat npm migration
- `android/local.properties` signing with null-guard
- JVM args in `gradle.properties`: `-Xmx4g -XX:MaxMetaspaceSize=1g`
- F-Droid reference APK workflow: build → apksigner SHA256 → tag → GitHub release → `Binaries:` in fdroiddata YAML

---

## DiscIt API (future v1.1)

- Live at `discit-api.fly.dev` — Marshall Street flight path images
- 1,107 / 1,203 discs have a `pic` URL (400×340 webp, RHBH flight path + PDGA specs)
- Integration decision deferred to v1.1 — see RESEARCH.md Section 11
