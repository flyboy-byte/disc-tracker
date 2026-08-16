# Disc Tracker — Claude Context

## What this project is

Two things in one repo:

1. **A live Flask web app** — personal disc golf bag tracker running on a VPS at `51.81.80.126`. Multi-user, local SQLite, no cloud, no accounts. The website is the canonical version and the spec for everything else.

2. **An Android app port — v1 feature-complete, actively growing** — Expo (React Native) app, local-first SQLite, targeting Play Store + F-Droid. Plan docs are in `app/`. Now **five tabs** (Bag / Flight Shaper / Disc Suggest / **Score** / Settings), all built and verified, first shipped as `mobile-preview-0.5` and **confirmed on a real physical Android phone (2026-07-24)**. Latest numbered release is **`mobile-preview-0.15`** (2026-08-01, first production-signed preview). Forward work follows the **Post-v1 Roadmap** in `app/PORT_PLAN.md`. **DONE:** R1–R4.5, B1 disc-suggest rewrite (`0.10`), B2 big-collection support (`0.11`), B3 offline scorekeeper + B4 full backup/restore (`0.12`), mobile-UX polish — tap-outside-to-close modals + interactive RGB color picker (`0.13`), UI "modern feel" polish pass + F-Droid-reproducible dependency tree (`0.14`), production signing (`0.15`), and the Disc Suggest suggest-engine plan **Phases 1-3** — Flex Shot scenario (13th), Throw Style modifier, personal stability adjustment, role tags, data audit/wear level (`plan/docs/suggest-engine-plan.md`, none yet cut as a numbered release) — plus the **website-parity track** (CSV Both scope, `stability_adj`/`role_tag` on the website, backup-file import; `plan/docs/website-parity-scope.md`). **R5 VPS sync DROPPED** (superseded by B4 — Logan's call). **Next = Phase 4 (parked behind C4) or the C-series (see `plan/GRAVEYARD.md`), or stores (R6 Play → R7 F-Droid) when Logan's ready** ("not emotionally ready for store release" — building features first). See "Mobile app — current state" below.

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
pip install -r requirements.txt
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
- `/api/ms_pic_img` (the actual image proxy) only fetches a cached `pic` URL server-side if it
  starts with `https://` — the URL comes from the third-party API response, so this is a
  deliberate guard against that response ever being used to make the server fetch an arbitrary
  scheme/host (`file://`, an internal `http://` service, etc).

### Physics simulation (Flight Shaper "Physics sim" mode)

- Vendored copy of [shotshaper](https://github.com/kegiljarhus/shotshaper) (GPLv3) at `vendor/shotshaper/` — a real rigid-body disc flight simulator (NumPy/SciPy `solve_ivp`) using wind-tunnel/CFD-derived lift/drag/moment coefficients, backed by two papers in `app/references/`. See `vendor/shotshaper/NOTICE.md` for provenance and the one local modification (lazy matplotlib import). **Every refinement to this feature only changes what parameters get passed into the unmodified vendored API — never anything inside `vendor/shotshaper/` itself.** (This rule governs the *website/server* sim. The **mobile app** has its own independent, faithful **TypeScript reimplementation** of the same engine — `app/src/physics/sim/`, R4.5, runs on-device with no server — which likewise never touches `vendor/shotshaper/`; it's parity-gated against it. The Python `vendor/` copy remains the reference oracle for that port's fixtures.)
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

- Drag reorder (single-column layout only during an active drag — toggled in
  `startDrag`/`endDrag`, not for the whole custom-sort session, so multi-card browsing stays
  the default view even when sort mode is "custom"), stability/type filters, color picker
- "In bag" today's bag checkmarks — persisted server-side per disc (`discs.in_bag`), synced via
  the same `/api/data` GET/POST as everything else, not session-local — plus a "Clear bag" bulk
  action and filtered CSV export
- `bagFilter` (the *filter toggle*, not the bag data itself) persisted to `sessionStorage`
- CSV import dedupes against the existing bag + duplicates within the pasted file, caps at
  `MAX_IMPORT` (500) rows
- `arcView` (RHBH/RHFH/LHBH/LHFH) persisted to both server and `localStorage`
- Flight Shape: hyzer/nose/wind/arm/spin sliders, distance estimate, arc visualization
- Disc Suggest: 12 scenario filters (Roller, Max Distance, Reliable Hyzer, etc.)
- iOS vertical slider fix: CSS `transform: rotate(-90deg)` on standard horizontal input
- Mobile: single-column card layout at ≤480px, absolute-positioned "in bag" button
- Server runs `threaded=True` so a slow third-party image lookup can't block every other user

---

## Mobile app — current state

**Phases 0-9 done; v1 first shipped as `mobile-preview-0.5`, confirmed on a real phone;
latest numbered release `mobile-preview-0.15` (production signing). Disc Suggest Phase 1
(Flex Shot scenario, Throw Style, personal stability adjustment) is code-complete and
verified on-device 2026-08-15, not yet cut as its own release — see
`app/plan/docs/suggest-engine-plan.md`.** All five tabs are real
and working, verified on an Android emulator and sideloaded on hardware:
- **Bag** — full CRUD (manual add or from the 1,660+ disc library), edit, delete, sort,
  search, stability/type filters, color picker, CSV import/export. SQLite-backed, survives app
  kills. **B2 big-collection support (`0.11`)**: a segmented **Today's Bag / Collection** split,
  30/page pagination, memoized cards + incremental single-row DB writes, and — replacing the
  glitchy drag-reorder — per-card **⤒/↑/↓ reorder arrows** (custom sort, Collection scope).
- **Flight Shaper** — bag/manual disc picker, 5 sliders (custom Reanimated `VerticalSlider`),
  live arc + ghost-arc redraw, distance estimate, RHBH/RHFH/LHBH/LHFH switcher. **Physics-sim
  mode ported on-device in R4.5** (2026-07-29) — the vendored shotshaper engine reimplemented
  in TypeScript (`app/src/physics/sim/`), running fully offline with no server; opt-in toggle,
  parity-tested against the real numpy/scipy engine (worst-case 0.005 mm). See "Mobile app —
  current state" and the physics-sim note below.
- **Disc Suggest** — 13-scenario grid (12 original + Flex Shot); **B1 rewrite (`0.10`)**: bag +
  full library ranked by ONE unified scoring model (`src/utils/suggestScore.ts`) against each
  scenario's ideal flight profile + the user's skill preset, bucketed great/good/marginal with
  band chips. Skill preset (Beginner/Intermediate/Advanced) lives in Settings, persisted in
  `user_meta.skill`. Frozen baseline validation harness (`src/utils/__fixtures__/suggest-baseline.json`).
  `useFocusEffect`-refreshed. **Phase 1 (2026-08-15, `f9925fb`)** added the Flex Shot scenario,
  a Throw Style (backhand/forehand) modifier, and a per-disc personal stability adjustment —
  the "user-declared" layer of the 3-layer flight-data rule. See
  `app/plan/docs/suggest-engine-plan.md`.
- **Score** (4th tab, `0.12`) — **offline scorekeeper** (B3), the UDisc-fallback for no-signal
  rounds. One screen, four internal views (rounds list → setup → hole-by-hole active card →
  summary standings+grid). 1–8 players, editable par, live totals + vs-par. 4 app-only SQLite
  tables (`rounds`/`round_holes`/`round_players`/`round_scores`); pure scoring math in
  `src/utils/roundMath.ts`. `app/plan/docs/scorekeeper-scope.md`.
- **Settings** (5th tab, gear icon) — default throw view, **skill level** (drives Disc Suggest),
  Marshall Street reference images (opt-in), **Backup & Restore** (B4, `0.12`): full-device JSON
  "Back up everything" / "Restore" — discs + today's-bag + settings + scorecards in one file,
  share-sheet in/out (`src/utils/backup.ts`) — plus CSV disc-list export/import, delete-all, and
  About. (The old v1.1 sync placeholder is gone — R5 VPS sync was **dropped**, superseded by B4.)

The SQLite CRUD layer is verified on-device. **115/115 Jest tests pass.** Several real
bugs were found and fixed by actually running the app (form-remount, native-slider/ScrollView
gesture conflict, stale-bag-data on tab switch, document-picker re-entry crash) — all
documented in `app/PORT_PLAN.md`.

**Phase 9 (v1 polish & gap-closing) done + verified 2026-07-24** — shipped as
`mobile-preview-0.5`. Finished today's-bag (per-card in-bag toggle,
filter, count, "Clear bag", and the CSV "Today's bag" export scope is now live), fixed the
cosmetics (`headerShown: false` kills the double title; custom `react-native-svg` tab icons
in `TabBarIcon.tsx` — chose this over `@expo/vector-icons` to avoid an npm install + keep
deps F-Droid-minimal), did the P3 polish (disc-suggest double-fetch, bar rounding, a11y
labels), and — found while testing — fixed a real `database is locked` concurrency bug by
serializing all DB ops in `db.ts`. **Drag-reorder is verified on the emulator** (not just
physical hardware): use `adb shell "input motionevent DOWN x y; sleep 0.9; input motionevent
MOVE …; input motionevent UP …"` — a hold-then-move, since `input draganddrop`/`swipe` can't
arm the long-press. `0.5` is confirmed working on a real physical Android phone, so the
Minimum Credible v1 Milestone is fully met. See `app/PORT_PLAN.md` Phase 9.

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
- No EAS at all — dropped entirely (DragTree proved local Gradle stays manageable as long as
  the codebase stays simple). No `eas.json`. iOS isn't cut — it stays possible on the same
  Expo/RN codebase, just deferred well behind Android + F-Droid (revisit build tooling then).
- Signing: `android/local.properties` with null-guard pattern (never committed)
- F-Droid strips signing via `sed -i '/signingConfig /d'` — expected behavior

### Distribution plan:
- D1: Play Store (internal → closed → open track)
- D2: F-Droid self-hosted repo
- D3: Official F-Droid index (after D2 proven)
- Never run D1/D2/D3 in parallel

### Next immediate step:
**v1 complete; R1–R4.5, B1–B4, production signing (R6 keystore step), and Disc Suggest
Phases 1-3 all done.** Latest numbered release is `mobile-preview-0.15` (2026-08-01, first
production-signed preview — upload key = Play app signing key, one keystore signs
Play+F-Droid+sideload). The suggest-engine plan's Phase 1 (Flex Shot, Throw Style, personal
stability adjustment), Phase 3 (role tags), and Phase 2 (data audit — wear level, inline-
editable Settings screen) all landed 2026-08-15, `tsc`/Jest green, none yet cut as their own
preview build; Phase 1 verified on-device, Phase 2/3 code-complete but untested on-device
(logged in `app/plan/docs/suggest-engine-plan.md`). The **website-parity track** also landed
2026-08-15 (`91883c3`): CSV "Both" export scope, `stability_adj`/`role_tag` columns +
`/api/data` wiring, and an "Import backup" button on the website — see
`app/plan/docs/website-parity-scope.md`. Forward priorities:
- **Suggest-engine Phase 4** — intentionally parked behind C4 (fieldwork data), which doesn't
  exist yet. Not being pursued. See `app/plan/GRAVEYARD.md`.
- **C-series (C1 loadouts, C2/C7 confirmed-real-not-scheduled, C3 parked)** — see
  `app/plan/GRAVEYARD.md` and `app/plan/docs/direction-2026-08-08.md`. A storage-robustness
  look (gating C1) is deliberately sequenced to the end of this plan.
- **R5 VPS sync** — DROPPED (2026-07-29), superseded by B4 backup/restore. Not being revisited.
- **R6 Play closed testing** — signing is done (upload key = Play app signing key); still
  needs the actual Play Console submission (Data Safety form, privacy policy, content
  rating) whenever Logan is ready to open that track.
- **R7 F-Droid** — **not dropped** (it's the FOSS destination), just sequenced after Play,
  since Play App Signing and F-Droid reproducible builds conflict.
- Both R6/R7 store submission are **deliberately parked** — Logan's call, building
  features first (2026-08-08 strategy re-plan, C-series).

GitHub Releases stays the primary channel pre-store. To cut a release: build the
arm64/armeabi APK (`JAVA_HOME=/usr/lib/jvm/java-21-openjdk`, `./gradlew assembleRelease
-PreactNativeArchitectures=arm64-v8a,armeabi-v7a`), then `gh release create`.

Emulator + toolchain on this machine: AVD `verify_test` (x86_64, API 37); `emulator` at
`~/Android/Sdk/emulator/emulator`. To load live code changes on the emulator you must
install the **debug** APK (Metro-connected) — the release APK has an embedded bundle and
ignores Metro. For emulator smoke-testing a *release* build, build a throwaway x86_64
release-config APK (`-PreactNativeArchitectures=x86_64`) since the shipped APK is
arm64/armeabi only. Drag/long-press gestures: `adb input motionevent` hold-then-move (not
`draganddrop`/`swipe`).

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
