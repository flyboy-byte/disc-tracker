# Disc Tracker — Codex Context

**Engineering hardening (CI, backup registry, manifest audit, cross-language test fixtures) is
tracked in `PLAN.md` at the repo root** — separate from the feature-work plan docs in `app/plan/`.
Tracks A–D done, Track E started, as of 2026-08-21.

**PROJECT PARKED 2026-09-01.** Nothing is queued. The last work was the UI/UX audit pass
(`app/plan/docs/ui-audit-plan.md`), **fully delivered and shipped as `v0.26`** — Tier 1 and
Tier 2 complete, 10 items, every one verified on a physical Pixel 9. Read that doc before
touching UI patterns: it records the two open design decisions that were resolved and three
places where the built solution deliberately differs from the scoped one (Flight Shaper's arc
view kept its 2×2 grid; Score lost tier colour rather than gaining a second channel; slider
reset is a tap on the value, not a double-tap on the slider), each with the reason.

**The leftover audit findings were culled 2026-09-02** — Logan: *"i dont want to keep so much
open. i want to cull or curate."* Went through all ~20 one by one; 7 survive as real future
candidates, the rest are closed (reviewed, not pursuing — reasoning in
`app/plan/GRAVEYARD.md`'s "UI audit leftovers" entry). The survivors, none urgent: **A4** (font
scaling — still the one named P0; RN's `allowFontScaling` defaults to `true` so text already
grows with the Android system font-size setting while fixed-height rows, the 34px hole chips,
and the 34px score-grid cells don't — never tested at raised scale), **F5** (Delete-all-discs
isolation), **B2** (Clear-bag button styling), **B4** (multiselect discoverability + no exit but
Cancel), **C4/F4** (trim explainer text, don't cut it — "good explaining is good, just not too
much"), **D1** (emoji icons in Disc Suggest vs. the rest of the app's SVG set), **F6** (Settings
uppercase micro-labels). Full scoping for A4 and the reasoning for every closed item are in
`app/plan/docs/ui-audit-plan.md`'s "Not in scope here" section and the graveyard entry.

## What this project is

Two things in one repo:

1. **An Android app — v1 feature-complete, and now the canonical build.** Expo (React Native) app, local-first SQLite, targeting Play Store + F-Droid. Plan docs are in `app/`. **Superseded the website as the reference implementation 2026-08-31** — the app grew past the website (Score tab, Disc Suggest swipe-to-learn engine, full backup/restore, the larger Try Discs catalog) and is where new behavior gets designed first. The old rule ("the two disagree, the website wins") is retired; the website is not required to mirror the app feature-for-feature anymore. This closes out the "spec-of-record vs. primary-deployment-target" split that `PLAN.md` Track D sub-track 3 and `app/plan/docs/track-d-flight-arc-parity.md` tracked through 2026-08-21 — both roles now belong to the app. Now **five tabs** (Bag / Flight Shaper / Disc Suggest / **Score** / Settings), all built and verified, first shipped as `mobile-preview-0.5` and **confirmed on a real physical Android phone (2026-07-24)**. Latest tagged release is **`v0.26`** (2026-09-01: the UI/UX audit pass — a shared `SegmentedControl`/`FilterPill`/`Icon` vocabulary replacing five hand-rolled control treatments and most text glyphs, 44dp touch targets, hardware Back mid-round, swipe-to-demote undo, the catalog picker as a real radio list, Score tier colour dropped for accessibility + palette consistency, bag actions behind an overflow sheet, Settings flattened from nine cards to a list, a one-tap hole strip, and Flight Shaper slider labelling — plus a real backup bug fix, see `app/plan/docs/ui-audit-plan.md`). Previous release **`v0.25`** (2026-08-20: Disc Suggest swipe hint text + stronger
Buy-mode brand-aversion weighting, a compact bag-report grid for bags over 12 discs, Score
tab 9/18/Custom hole presets + roster prefill + quick-pick score entry + color-coded scores,
a new in-app "How to use Disc Tracker" tutorial linked from Settings, and two F-Droid
privacy/manifest fixes — see `app/plan/docs/fdroid-privacy-audit-2026-08-20.md`). Same
session also stood up **D2**, a self-hosted F-Droid repo now live at
`https://fdroid.flyboybyte.com/fdroid/repo` — a deploy target for the whole app
portfolio, not this project's feature, so it lives in its own repo
(`~/projects/fdroid-repo`), not here. Previous release was
**`v0.24`** (2026-08-19, a same-day follow-up to `v0.23`: full backup
now includes the swipe/learning state it was silently missing, a "Best fit"/"Brand A-Z" sort
toggle on Buy mode for browsing large result sets, and privacy-policy/README disclosure of the
local-only swipe-learning data — see `app/plan/docs/suggest-swipe-scope.md`). `v0.23` shipped
Disc Suggest **swipe-to-dismiss** —
Gmail-style side swipe on result cards; Throw mode drops a disc to the bottom of that
scenario's list, persisted; Buy mode adds a learning engine that re-sorts on flight-number/brand
aversion learned from swipes, on/off toggle, nothing ever deleted — see
`app/plan/docs/suggest-swipe-scope.md`, verified on a real Pixel 7 including a real gesture-vs-
scroll conflict bug found and fixed same session). `v0.22` (2026-08-18) shipped backup "Save to
device" on Android via Storage Access Framework, alongside the existing share-sheet path. `v0.21`
(same day) shipped the catalog UI reworked into a three-way **Built-in / Try Discs / Custom** source picker with a first-run download prompt (`app/plan/docs/catalog-v2-scope.md`'s "Three-way source picker" section) — verified end-to-end on a real Pixel 7 — plus a same-session compliance fix (Try Discs credit now keys off the manifest's own `provider` field, not which UI slot the data landed in, closing a gap where importing Try Discs' data through the new "Custom" URL path would've silently dropped the required credit) and 2,147-vs-1,874 disclosure copy added to Settings, the website, and `README.md`. `v0.20` shipped Try Discs catalog-v2 (live, real data since 2026-08-18) + C7 Shareable Bag Report + the GH Pages fix + nginx rate-limit. Forward work follows the **Post-v1 Roadmap** in `app/PORT_PLAN.md`. **DONE:** R1–R4.5, B1 disc-suggest rewrite (`0.10`), B2 big-collection support (`0.11`), B3 offline scorekeeper + B4 full backup/restore (`0.12`), mobile-UX polish — tap-outside-to-close modals + interactive RGB color picker (`0.13`), UI "modern feel" polish pass + F-Droid-reproducible dependency tree (`0.14`), production signing (`0.15`), the Disc Suggest suggest-engine plan **Phases 1-3** — Flex Shot scenario (13th), Throw Style modifier, personal stability adjustment, role tags, data audit/wear level, all **verified on-device** (`plan/docs/suggest-engine-plan.md`, shipped across `v0.16`–`v0.17`) — the **website-parity track** (CSV Both scope, `stability_adj`/`role_tag` on the website, backup-file import; `plan/docs/archive/website-parity-scope.md`, `v0.17`) — wear estimate (1–5, supersedes the 3-tier field) + Disc Suggest "buying mode" (`v0.19`, `plan/docs/archive/wear-estimate-scope.md` / `plan/docs/archive/buying-mode-scope.md`) — Try Discs catalog-v2 + C7 Shareable Bag Report (`v0.20`) — the three-way source picker + compliance fix (`v0.21`) — backup "Save to device" (`v0.22`, `app/plan/docs/catalog-v2-scope.md` / `app/plan/docs/c7-shareable-report-scope.md`) — Disc Suggest swipe-to-dismiss + Buy-mode learning engine (`v0.23`) — and, newest, backup completeness + Brand A-Z sort + privacy disclosure for that same feature (`v0.24`, `app/plan/docs/suggest-swipe-scope.md`). **R5 VPS sync DROPPED** (superseded by B4 — Logan's call). C2 ("what should I throw?" free-form screen) **graveyarded** 2026-08-16, **C1 (named loadouts) graveyarded 2026-08-18** (storage-robustness gate cleared with no schema changes needed, but Logan passed on the feature itself), **C3 (fieldwork sessions) graveyarded 2026-08-21** ("kill c3 fieldwork completely" — C4/C5/C6 die with it, downstream of C3's data with no scope of their own) — the **entire C-series is now closed out**, none of it too speculative or too close to existing features to matter anymore (`app/plan/GRAVEYARD.md`). **R6 (Play Store) hard-paused 2026-08-21** ("not interested in play store very much... google just sucks" — a values call, not timing) — **Next, if anything = R7 (F-Droid official index)**, no longer sequenced behind R6, with D2 already live as its practice run; otherwise nothing is currently queued. See `app/plan/GRAVEYARD.md`'s R6 entry and "Mobile app — current state" below.

2. **A live Flask web app** — personal disc golf bag tracker running on a VPS at `51.81.80.126`. Multi-user, local SQLite, no cloud, no accounts. Now the **secondary** surface — still maintained (deploy with `./deploy.sh`, tests still run in CI), but no longer the reference implementation and not required to match every app feature. New behavior gets designed against the app first; port it to the website only when it's worth the effort, not by default.

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

`static/physics.fixture.test.js` — flight-arc/stability parity check against
`fixtures/flight-arc-vectors.json`, the shared fixture the mobile app's
`legacyPhysics.fixture.test.ts` also loads (`app/plan/docs/track-d-flight-arc-parity.md`).
Regenerate the fixture after a deliberate `physics.js` change with
`node static/generate-flight-arc-fixture.js > fixtures/flight-arc-vectors.json`.

`tests/ui-smoke.spec.js` — Playwright browser smoke tests covering the JS-dependency-contract
items most at risk from CSS/markup changes: card `data-id` + drag-reorder, filter pills,
physics-sim crosswind/dir-hint sync, CSV export/import round-trip. Dev-only — the shipped Flask
app has no build step and doesn't depend on this. One-time setup: `npm install` (needs
`package.json` at repo root), then `npx playwright install chromium`. Run with `npm run test:ui`
(starts `python3 app.py` itself via `playwright.config.js`'s `webServer`, so have the Python venv
active first). Each test run creates its own throwaway user, never touches real bag data.

`tests/api-data-roundtrip.spec.js` — Playwright, same throwaway-user pattern: `/api/data`
POST→GET round-trip fidelity, full-replace semantics, CSRF rejection, and multi-user isolation
(`PLAN.md` Track E).

**CI now runs all of this on every push/PR** (`.github/workflows/`): `app-ci.yml` (mobile app
`tsc --noEmit` + Jest), `website-ci.yml` (the two Node scripts above + `py_compile`),
`app-manifest-audit.yml` (regenerates `android/` via `expo prebuild --clean` and checks the
merged manifest's permissions against an explicit allowlist — `app/scripts/check-manifest-
permissions.js`), `website-playwright.yml` (both Playwright spec files against a live Flask
server). See `PLAN.md` for the full engineering-hardening scope this came out of.

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
latest tagged release `v0.26`** (2026-09-01 — the complete UI/UX audit pass, Tier 1 + Tier 2,
all ten items verified on a physical Pixel 9; see `app/plan/docs/ui-audit-plan.md`. Also fixed
a real user-reported bug: "Back up everything" was wired to the share sheet, which on Android
can't reach Files at all — it now writes straight to a folder you pick, with sharing demoted to
"Send a copy…"). Previous release **`v0.25`** (2026-08-20 — swipe hint text, stronger Buy-mode brand
weighting, bag-report compact grid, Score tab presets/prefill/quick-pick/color-coding, a
new in-app tutorial, and two F-Droid privacy/manifest fixes; see
`app/plan/docs/fdroid-privacy-audit-2026-08-20.md`). Also see "D2 — self-hosted F-Droid
repo" below the R7 note further down: **LIVE as of 2026-08-21** at
`https://fdroid.flyboybyte.com/fdroid/repo`. Previous release **`v0.24`** (2026-08-19 — same-day follow-up to `v0.23`: full backup now
carries swipe/learning state, a Brand A-Z sort for Buy mode, and privacy disclosure).
`v0.23` shipped Disc Suggest swipe-to-dismiss: Gmail-style side
swipe on result cards, per-scenario persisted reorder in Throw mode, a Buy-mode learning engine
that re-sorts on learned flight-number/brand aversion without ever changing a disc's true fit
label, on/off toggle. Verified on a real Pixel 7, including a real on-device bug fix — a
vertical scroll starting on a card was getting captured by the card's own swipe gesture, fixed
with directional gesture constraints. See `app/plan/docs/suggest-swipe-scope.md`). `v0.22`
(2026-08-18) shipped backup "Save to device" on Android. `v0.21` (same day) shipped the catalog
UI reworked into a three-way Built-in/Try Discs/Custom picker + first-run prompt, verified on a
real Pixel 7 — see "Three-way source picker" in `app/plan/docs/catalog-v2-scope.md`. `v0.20`
shipped Try Discs catalog-v2 + C7 Shareable Bag Report + the GH Pages fix + nginx rate-limit;
release naming moved from `mobile-preview-X` to bare `vX` at `v0.16`. **Disc Suggest
suggest-engine Phases 1-3** (Flex Shot scenario, Throw Style,
personal stability adjustment, data audit, role tags) are all **verified on-device**
(2026-08-15/16) — see `app/plan/docs/suggest-engine-plan.md`. All five tabs are real
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
  `app/plan/docs/suggest-engine-plan.md`. **Phase 2 (data audit)** and **Phase 3 (personal role
  tags)** shipped in `v0.17` (`6bb2651`, `468d79b`) and are verified on-device. **Newest
  (`v0.19`, `019f480`)**: the audited-field wear tracker is now a **1-5 wear estimate**
  (supersedes the shipped 3-tier New/Seasoned/Beat field, which is now derived from it), and a
  **"buying mode"** toggle on Disc Suggest ranks library discs you don't own against the active
  scenario, with a bag-gap summary and category/stability/brand filters — see
  `app/plan/docs/archive/wear-estimate-scope.md` / `app/plan/docs/archive/buying-mode-scope.md`.
- **Score** (4th tab, `0.12`) — **offline scorekeeper** (B3), the UDisc-fallback for no-signal
  rounds. One screen, four internal views (rounds list → setup → hole-by-hole active card →
  summary standings+grid). 1–8 players, editable par, live totals + vs-par. 4 app-only SQLite
  tables (`rounds`/`round_holes`/`round_players`/`round_scores`); pure scoring math in
  `src/utils/roundMath.ts`. `app/plan/docs/archive/scorekeeper-scope.md`.
- **Settings** (5th tab, gear icon) — default throw view, **skill level** (drives Disc Suggest),
  Marshall Street reference images (opt-in), **Backup & Restore** (B4, `0.12`): full-device JSON
  "Back up everything" / "Restore" — discs + today's-bag + settings + scorecards in one file,
  share-sheet in/out (`src/utils/backup.ts`) — plus CSV disc-list export/import, delete-all, and
  About. (The old v1.1 sync placeholder is gone — R5 VPS sync was **dropped**, superseded by B4.)

The SQLite CRUD layer is verified on-device. **154/154 Jest tests pass.** Several real
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
**Nothing queued — the project is parked as of 2026-09-01, with a clean tree, everything pushed,
and `v0.26` released.** Don't propose work unprompted; wait for Logan. If he does pick it back
up, the honest state is: no open bugs, no queued features, the C-series closed, R6 hard-paused,
and R7 (official F-Droid index) the only distribution step that was ever the natural next one.
**The one named candidate is `A4` (font scaling)** — Logan called it "a good one" while parking
everything else from the audit; see above and `app/plan/docs/ui-audit-plan.md`. Historical
detail follows.

**v1 complete; R1–R4.5, B1–B4, production signing (R6 keystore step), Disc Suggest
Phases 1-3, the website-parity track, wear estimate, Disc Suggest buying mode, Try Discs
catalog-v2, C7 Shareable Bag Report, the three-way catalog picker + compliance fix, backup
"Save to device", Disc Suggest swipe-to-dismiss + Buy-mode learning engine, and that feature's
backup-completeness/Brand A-Z sort/privacy-disclosure follow-up all done and shipped as of
`v0.24`** (2026-08-19 —
upload key = Play app signing key since `v0.15`, one keystore signs Play+F-Droid+sideload).
Release naming moved from `mobile-preview-X` to bare `vX` at `v0.16` (2026-08-15). The
suggest-engine plan's Phase 1 (Flex Shot, Throw Style, personal stability adjustment), Phase 2
(data audit), and Phase 3 (role tags) are all verified on-device (logged in
`app/plan/docs/suggest-engine-plan.md`). The **website-parity track** landed 2026-08-15
(`91883c3`): CSV "Both" export scope, `stability_adj`/`role_tag` columns + `/api/data` wiring,
and an "Import backup" button on the website — see `app/plan/docs/archive/website-parity-scope.md`.
**C2** ("what should I throw?" free-form screen) was **graveyarded** 2026-08-16 — too close to
the existing Disc Suggest page, see `app/plan/GRAVEYARD.md`. **Catalog-v2 (TryDiscs)** — a
brand-new external disc catalog (2,147 discs vs. the old 1,660, founder-approved access, terms
accepted, VPS hosting security-reviewed) has been **LIVE since 2026-08-18**:
`https://disc.flyboybyte.com/catalog/manifest.json` serves real data (`catalogVersion=2`,
1,874 discs — the other 273 lack complete flight numbers and are deliberately excluded, now
disclosed in Settings/website/README), shipped in `v0.20` and verified on-device.

**Shipped in `v0.21`**: the Disc Catalog Settings card was reworked from a single
"downloaded vs. bundled" line into a real three-way **Built-in / Try Discs / Custom** source
picker (each source caches independently, switching between already-cached sources is instant,
nothing is ever deleted) plus a one-time first-run prompt offering the Try Discs download —
Logan's idea, scoped and built same-session, **verified end-to-end on a real Pixel 7** (all
three sources, both directions of switching, both Custom-import paths). Building it surfaced a
real compliance gap that's since been fixed: the required Try Discs credit was keyed off which
UI slot was active, so importing Try Discs' own manifest through the new "Custom" URL field
would've silently dropped the credit — now keyed off the manifest's own `provider` field
instead, with a regression test. See `app/plan/docs/catalog-v2-scope.md`'s "Three-way source
picker + first-run prompt" section — **read it before touching this, don't re-derive the
design.** **Shipped in `v0.22`**: backup "Save to device" — an Android-only Storage Access
Framework path alongside the existing share-sheet backup, so a full JSON backup can be written
straight to a chosen folder without going through a share target. **Shipped in `v0.23`**:
Disc Suggest swipe-to-dismiss — Gmail-style side swipe on result cards. Throw mode drops a
swiped disc to the bottom of that scenario's list only, persisted (new `suggest_demotions`
table). Buy mode adds a learning engine (new `suggest_learning` table): swiping blends the
disc's flight numbers into an "avoided" centroid that decays fast between app launches, and its
brand into a slower-decaying aversion map, re-sorting (never re-labeling — band/fit stays true
to the real score) the rest of the list; an on/off toggle degrades Buy mode to Throw's plain
reorder. Verified on a real Pixel 7, including a real on-device bug found and fixed same
session: a vertical scroll starting directly on a swipeable card got captured by the card's own
gesture instead of the list, fixed with `activeOffsetX`/`failOffsetY` constraints. See
`app/plan/docs/suggest-swipe-scope.md` — **read it before touching this, don't re-derive the
design.** **Shipped in `v0.24`** (same day, follow-up): full backup was silently dropping
`suggest_demotions`/`suggest_learning` — fixed with additive, tolerant `BackupData` fields and
new `db.ts` bulk export/import functions, verified on-device (exported a real backup, confirmed
both fields present with real accumulated data). Also added a "Best fit"/"Brand A-Z" sort toggle
to Buy mode — with hundreds of near-tied "great fit" discs for a common scenario, alphabetical-
by-manufacturer is a more useful browse order than score alone; verified on-device (correct
locale ordering). And disclosed the swipe/learning local-preference data (never transmitted, but
new locally-derived data about the user) in `docs/privacy.html` and `README.md`. Forward
priorities:
- **Suggest-engine Phase 4** — was parked behind C4 (fieldwork data). C4 is now dead (see
  below), so Phase 4 has no remaining path forward, not just a pause. Not being pursued.
- **C-series — fully closed out, 2026-08-21.** C7 shipped (`v0.20`). C1 (named loadouts)
  graveyarded 2026-08-18 — the storage-robustness gate cleared with no schema changes needed,
  but Logan passed on the feature itself. C2 ("what should I throw?" free-form screen)
  graveyarded 2026-08-16 — too close to the existing Disc Suggest page. **C3 (fieldwork
  sessions) graveyarded 2026-08-21** — Logan: "kill c3 fieldwork completely." Was parked
  2026-08-15 over the `ACCESS_FINE_LOCATION`/F-Droid-privacy tradeoff and an unscoped
  derived-storage prerequisite; killed outright six days later with no new reasoning needed —
  the tradeoff didn't improve with time. **C4/C5/C6 die with it** — they were downstream of
  C3's data with no independent scope. Nothing in the C-series remains open. See
  `app/plan/GRAVEYARD.md` and `app/plan/docs/direction-2026-08-08.md`.
- **R5 VPS sync** — DROPPED (2026-07-29), superseded by B4 backup/restore. Not being revisited.
- **R6 Play closed testing — HARD PAUSED 2026-08-21, not just "not ready yet."** Signing is
  done (upload key = Play app signing key); the Play Console submission (Data Safety form,
  privacy policy, content rating) is otherwise unstarted. Logan, 2026-08-21: "not interested in
  play store very much honestly. google just sucks. but keep it in docs." A values call, not a
  timing one — see `app/plan/GRAVEYARD.md`'s R6 entry. Reversible, not dead; don't push it.
- **R7 F-Droid (official index, D3)** — not dropped (it's the FOSS destination). Previously
  sequenced after Play purely because Play App Signing and F-Droid's reproducible-build
  requirements conflict if pursued together — with R6 now hard-paused rather than active, that
  sequencing constraint no longer applies, and R7 is arguably the more aligned next distribution
  step (no Google account, FOSS-native, and D2 below is already the practice run for it). D3
  itself still hasn't started; not begun unilaterally, just flagged as the natural implication
  in `app/plan/GRAVEYARD.md`'s R6 entry.
- **D2 — self-hosted F-Droid repo, LIVE since 2026-08-21.** A deploy target, not a
  feature of this app: `https://fdroid.flyboybyte.com/fdroid/repo` hosts signed release
  builds for flyboy-byte's whole app portfolio (currently just `com.disctracker.app`
  v0.25.0). Lives in its own repo, `~/projects/fdroid-repo` — not inside this one, since
  it's shared infrastructure, not disc-tracker-specific. See that repo's own `README.md`
  for setup/deploy details.

GitHub Releases stays the primary channel pre-store. To cut a release: build the
arm64/armeabi APK (`JAVA_HOME=/usr/lib/jvm/java-21-openjdk`, `./gradlew assembleRelease
-PreactNativeArchitectures=arm64-v8a,armeabi-v7a`), then `gh release create`.

Emulator + toolchain on this machine: two AVDs — `verify_test` (16KB-page-size
`google_apis_playstore_ps16k` image, the original one) and `verify_std` (added 2026-08-18, a
standard 4KB-page `google_apis` image, no Play Store). `emulator` binary at
`~/Android/Sdk/emulator/emulator`. Boot with `-no-window -no-boot-anim` (headless — the GUI
window's Qt/gfxstream compositing pipeline burns real CPU for no benefit when you're only
driving it via `adb`) and give it real time: `adb devices` reports `device` well before
`sys.boot_completed=1` — poll `adb shell getprop sys.boot_completed` too, not just transport
state, or you'll interact with a half-booted guest. To load live code changes you must install
the **debug** APK (Metro-connected) — the release APK has an embedded bundle and ignores
Metro. For emulator smoke-testing a *release* build, build a throwaway x86_64 release-config
APK (`-PreactNativeArchitectures=x86_64`) since the shipped APK is arm64/armeabi only.
Drag/long-press gestures: `adb input motionevent` hold-then-move (not `draganddrop`/`swipe`).

**2026-08-18 finding — debug-APK installs can crash `system_server` on a loaded host.**
Installing this app's debug build (83MB+, unminified, several native modules) can trip
Android's own internal `system_server` Watchdog (a 60s thread-scheduling deadline — visible in
`adb logcat` as `Watchdog timeout updated to 60000 millis` / `WAITED_UNTIL_PRE_WATCHDOG`) when
the **host** is CPU-contended (e.g. multiple concurrent Claude Code sessions sharing the same
cores) — confirmed this is host scheduling pressure, not a broken AVD, broken app, or app-size
problem per se (reproduced identically on a brand-new standard AVD, and even a 16KB test APK
stalled once the host was loaded). If `adb install`/`pm install` hangs or comes back with
`Failure calling service package: Broken pipe`, that's the symptom — `adb reboot` the guest
before retrying (a half-crashed `system_server` can leave the package service dead even though
the process itself lingers), and prefer a moment when other sessions on this box are quiet. A
real Pixel 7 over USB has none of this — a 122MB 2-ABI debug APK installed in under 5 seconds
the same session. Prefer physical-device testing when it's available; treat the emulator as a
fallback, not the default, until this host has more headroom.

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
