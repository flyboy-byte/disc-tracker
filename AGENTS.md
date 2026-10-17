# Disc Tracker — Agent Context

Authoritative context for any coding agent (Claude Code, Codex). `CLAUDE.md` just imports this
file — edit here, not there. If this file conflicts with the docs it points to, the docs win:
fix the pointer, don't paste the detail back up here.

**Status: PARKED since 2026-09-01 at `v0.26`. Nothing is queued** (last verified 2026-10-17).
Don't propose work unprompted; wait for Logan. Honest state if he picks it back up: no open
bugs, no queued features, C-series closed, R6 (Play Store) hard-paused, R7 (official F-Droid
index) the only natural next distribution step. The one named candidate is **A4 (font scaling)**.

## Where the real state lives (read these, not your memory of past sessions)

| Doc | What's in it |
| --- | --- |
| `PLAN.md` | Engineering hardening — CI, backup registry, manifest audit, cross-language fixtures. Tracks A–D done, Track E started (2026-08-21). |
| `app/PORT_PLAN.md` | Mobile app phased build plan + Post-v1 Roadmap (R/B/C items), on-device bugs found and fixed. |
| `app/plan/RELEASES.md` | Release log, `mobile-preview-0.5` → `v0.26`, with what shipped in each and the scope doc for it. |
| `app/plan/GRAVEYARD.md` | Everything closed and why — C1/C2/C3 (and C4–C6 with it), R5, R6 hard-pause, the culled UI-audit leftovers. Read before proposing anything that sounds familiar. |
| `app/plan/docs/ui-audit-plan.md` | The `v0.26` audit. Read before touching UI patterns — records three deliberate deviations from scope (Flight Shaper arc view kept its 2×2 grid; Score lost tier colour rather than gaining a second channel; slider reset is a tap on the value, not a double-tap) and A4's full scoping. |
| `app/plan/docs/*-scope.md` | One per shipped feature. `catalog-v2-scope.md` and `suggest-swipe-scope.md` say outright: read before touching, don't re-derive the design. |
| `app/RESEARCH.md` | Toolchain decisions, F-Droid notes, DiscIt API. |

### Do not re-raise

- **R5 VPS sync** — dropped 2026-07-29, superseded by B4 backup/restore.
- **C-series** — fully closed 2026-08-21. C7 shipped (`v0.20`); C1 named loadouts, C2 "what
  should I throw?" screen, C3 fieldwork sessions graveyarded ("kill c3 fieldwork completely");
  C4/C5/C6 died with C3. Suggest-engine Phase 4 depended on C4, so it's dead too.
- **R6 Play Store** — hard-paused 2026-08-21, a values call not a timing one ("not interested in
  play store very much honestly. google just sucks. but keep it in docs"). Reversible; don't push it.
- **UI-audit leftovers** — culled 2026-09-02 ("i dont want to keep so much open"). Seven survive,
  none urgent: **A4** font scaling (RN's `allowFontScaling` defaults on, so text grows with the
  system setting while fixed-height rows, 34px hole chips and 34px score-grid cells don't — never
  tested at raised scale), **F5** Delete-all isolation, **B2** Clear-bag styling, **B4**
  multiselect discoverability, **C4/F4** trim explainer text (trim, don't cut), **D1** emoji icons
  in Disc Suggest, **F6** Settings uppercase micro-labels. The rest are closed.

## What this project is

Two things in one repo:

1. **Android app (`app/`) — the canonical build since 2026-08-31.** Expo / React Native,
   local-first SQLite, F-Droid-first. Five tabs: Bag / Flight Shaper / Disc Suggest / Score /
   Settings. New behavior is designed here first. Distributed via GitHub Releases and the
   self-hosted F-Droid repo (D2, live since 2026-08-21 at
   `https://fdroid.flyboybyte.com/fdroid/repo` — shared infrastructure for all of Logan's apps,
   so it lives in `~/projects/fdroid-repo`, not here).
2. **Flask website (repo root) — secondary.** Personal bag tracker on a VPS at `51.81.80.126`.
   Multi-user, local SQLite, no accounts. Still maintained and tested in CI, but not required to
   match the app; port features to it only when worth the effort.

## Commands

### Mobile app (`cd app`)

Global npm on this machine is broken (v12 on node 20) — use `npx npm@10.9.2`. Before writing
Expo code, read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ (Expo 57 / RN 0.86
— APIs have moved since most training data).

```bash
npx npm@10.9.2 ci                          # install (pinned, F-Droid-reproducible)
npm run typecheck                          # tsc --noEmit
npx jest                                   # all tests (424 across 15 suites, 2026-10-17)
npx jest src/utils/suggestScore.test.ts    # one file
npx jest -t "fragment of test name"        # one test
npm run prebuild                           # expo prebuild --clean → regenerates android/
cd android && JAVA_HOME=/usr/lib/jvm/java-21-openjdk ./gradlew assembleRelease \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a   # release APK, then `gh release create`
```

### Website (repo root)

```bash
python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
python app.py                              # → http://localhost:5757
node static/physics.test.js                # physics regression (= npm run test:physics)
node static/physics.fixture.test.js        # parity vs. fixtures/flight-arc-vectors.json
npm install && npx playwright install chromium     # one-time, Playwright setup
npm run test:ui                            # Playwright; starts app.py itself — venv must be active
npx playwright test tests/ui-smoke.spec.js -g "name"   # one Playwright test
./deploy.sh                                # push, SSH to VPS, pull, syntax-check, restart systemd
```

Playwright runs create a throwaway user each time; they never touch real bag data.

### CI (`.github/workflows/`, every push/PR)

`app-ci.yml` (tsc + Jest), `website-ci.yml` (both Node physics scripts + `py_compile`),
`app-manifest-audit.yml` (`expo prebuild --clean`, then checks merged-manifest permissions
against the allowlist in `app/scripts/check-manifest-permissions.js`), `website-playwright.yml`.

## Architecture

### Mobile app

- **Routes** — expo-router: `app/app/(tabs)/` has one file per tab (`index.tsx` = Bag,
  `flight-shaper`, `disc-suggest`, `score`, `settings`); `app/app/tutorial.tsx` is the in-app guide.
- **`src/db/`** — `db.ts` funnels every DB op through `serialize()` (fix for a real
  `database is locked` bug). A `serialize()`-wrapped function must never call another wrapped one —
  it deadlocks; use the raw `*Impl` helpers. Schema changes go in `migrations.ts`. App-only tables
  the website doesn't have: Score's `rounds`/`round_holes`/`round_players`/`round_scores`, and
  `suggest_demotions`/`suggest_learning`.
- **`src/utils/`** — pure logic with a Jest test beside each file; UI lives in `src/components/`.
  The heavy ones:
  - `suggestScore.ts`: the single unified Disc Suggest scoring model, frozen against
    `__fixtures__/suggest-baseline.json`.
  - `legacyPhysics.ts`: port of the website's `static/physics.js`.
  - `roundMath.ts`: Score math.
  - `backup.ts`: full backup/restore. New `BackupData` fields must be additive and
    tolerant of old files. Any new persisted table has to be added here, or backup silently drops
    it — this has happened before (`v0.24`).
- **`src/physics/sim/`** — on-device TypeScript reimplementation of shotshaper (R4.5), parity-tested
  against the Python engine in `vendor/shotshaper/` (worst case 0.005 mm, `parity.test.ts`).
- **`src/catalog/`** — Built-in / Try Discs / Custom catalog sources, each cached independently.
  The Try Discs credit is keyed off the manifest's `provider` field, not the active UI slot.
- **Cross-language contract** — `fixtures/flight-arc-vectors.json` is loaded by both
  `static/physics.fixture.test.js` and `app/src/utils/legacyPhysics.fixture.test.ts`. After a
  deliberate `physics.js` change, regenerate it:
  `node static/generate-flight-arc-fixture.js > fixtures/flight-arc-vectors.json`.

### Website

- **Backend** `app.py` — Flask, SQLite at `data/disc_tracker.db` (gitignored, with the secret
  key), port 5757, `threaded=True` so a slow third-party image lookup can't block other users.
  CSRF token on every POST. `/api/data` GET/POST is full export / full replace of a user's data —
  everything (including the `in_bag` flag) syncs through it.
- **Frontend** — Jinja templates (`index.html` bag view, `flightshape.html`,
  `discsuggestion.html`, `pick.html` user switcher), vanilla JS, no build step.
  `static/physics.js` holds the shared pure flight-arc math. `static/style.css` holds tokens
  (`:root`) and primitives shared by 2+ templates; page-specific CSS stays in each template.
  Breakpoints are hard-coded pixel values (CSS vars don't work in `@media`). The canonical scale
  is in a comment at the top of `style.css`; grep all templates before changing one.

```sql
users         (id, username)
discs         (id, user_id, disc_id, mfr, mold, plastic, weight, speed, glide, turn, fade,
               use_desc, thr, notes, color, sort_order, in_bag, stability_adj, role_tag, …)
user_meta     (user_id, next_id, sort_mode, arc_view)
ms_pic_cache  (lookup_key, pic)   -- DiscIt lookups keyed "mfr|mold" lowercase, misses cached too
```

**Marshall Street reference images** come from `discit-api.fly.dev`, the only external API.
They're live on the website (on by default, `localStorage.useMsApi`) and opt-in in the app's
Settings.
- They appear only in the bag-view detail modal (`showArcDetail`) and only for RHBH, which is
  all the API provides. Any failure falls back silently to the computed arc.
- They're deliberately **not** in Flight Shaper, because a static image fights a slider-driven
  tool.
- `/api/ms_pic_img` only proxies `https://` URLs. The URL comes from a third-party response,
  so this check keeps the server from fetching `file://` or internal hosts.

**Physics sim** (`POST /api/shotshaper_sim`, Flight Shaper opt-in toggle) runs the vendored
[shotshaper](https://github.com/kegiljarhus/shotshaper) (GPLv3) at `vendor/shotshaper/`. That's a
rigid-body solver using `solve_ivp` with CFD-derived coefficients.
- **Never modify anything inside `vendor/shotshaper/`.** Refinements only change what gets
  passed in. See its `NOTICE.md` for the one local change, a lazy matplotlib import.
- Only 4 archetypes exist upstream, all drivers: `cd1`, `cd5`, `dd2`, `fd2`. There is no
  putter or midrange data, so speed ≤ 8 shows the `#sim-caveat` banner.
- `pickArchetype()` auto-selects the nearest archetype using `ARCHETYPE_PROFILE` in `app.py`.
  That table is an empirical characterization from upstream's own example throws. The user can
  override the pick.
- Mass is the disc's real weight, clamped to 0.140–0.200 kg (upstream's range), with 175 g as
  the default.
- Crosswind is the y-component of `environment.winddir`.
- Launch speed and spin are approximated from the speed number. Treat this as an experimental
  mode, not a replacement for the Bézier arc.

**Model-agreement finding** (a one-off; nothing is wired in): legacy and sim disagree on shape
most at the neutral baseline. Every environmental input narrows the gap. They come from
different first principles (empirical curve fit vs. integrated CFD), so this isn't a bug in
either. If it's ever worth surfacing, the cheap path is a `?dev=1` overlay in Flight Shaper's
sim panel. That would draw both curves in `#arcSVG` using the existing `arcPoints()` and
`/api/shotshaper_sim`, with no new server logic.

## Hard constraints

- Local-first, single-user UX, Android-first. No cloud backup, analytics, Firebase, Sentry,
  OAuth, or ads. The app must never depend on the Flask server.
- Don't rewrite the physics model (`legacyPhysics.ts` is a port; improve separately), and don't
  change suggestion or stability behavior unless a bug is proven.
- Any network/backup/permission change has to pass Logan's F-Droid privacy bar (PCAPdroid-clean,
  minimal permissions, opt-in, no third party) and the manifest allowlist in CI.
- Try Discs terms: credit required in three places; the key and the catalog are never committed.
  Re-check attribution whenever a catalog feature changes.

## Toolchain & build

- **Pinned for F-Droid:**
  - JDK 21 OpenJDK (not Temurin).
  - Android SDK 36.
  - NDK 27.1.12297006.
  - Flat npm in `app/`: no pnpm, no workspaces.
- **Builds:** local Gradle only — no EAS, no `eas.json`. iOS is deferred, not cut.
- **Signing:** `android/local.properties` with a null-guard (never committed). One keystore
  signs Play, F-Droid and sideload builds. F-Droid strips signing with
  `sed -i '/signingConfig /d'`, which is expected.
- **Distribution order:**
  - D2 (self-hosted F-Droid) is live.
  - D3 / R7 (the official F-Droid index) is the natural next step and hasn't started.
  - D1 / R6 (Play) is hard-paused.
- **Verifying a change in the app:**
  - Live code needs the **debug** APK (connected to Metro). A release APK embeds its bundle and
    ignores Metro.
  - For emulator smoke tests of a release build, build an x86_64 release APK. The shipped APK
    is arm64/armeabi only.

### Emulator notes

- **AVDs:**
  - `verify_test`: 16KB page size, Play Store image.
  - `verify_std`: standard 4KB pages, `google_apis`.
- **Booting:** `~/Android/Sdk/emulator/emulator -avd <name> -no-window -no-boot-anim`. Wait
  for `adb shell getprop sys.boot_completed` to return `1`, not just for `adb devices` to show
  `device`.
- **Gestures:** use a hold-then-move with
  `adb shell "input motionevent DOWN x y; sleep 0.9; input motionevent MOVE …; input motionevent UP …"`.
  `swipe` and `draganddrop` can't arm a long-press.
- **Install hangs (2026-08-18):** installing the 80MB+ debug APK on a CPU-contended host can trip
  Android's `system_server` Watchdog.
  - Symptoms: `pm install` hangs, or fails with `Broken pipe`; logcat shows
    `WAITED_UNTIL_PRE_WATCHDOG`.
  - Cause: host scheduling pressure. It isn't the AVD or the app.
  - Fix: `adb reboot` the guest before retrying, and install when other sessions on this host
    are quiet.
- **Prefer a real phone when one is available** (a Pixel 7 over USB installs in under 5s). Treat
  the emulator as the fallback.

## DragTree reference

Logan's other live Expo app on the same stack, already through the Play + F-Droid pipeline.
Lessons from it already in `app/RESEARCH.md`:
- pnpm → flat npm.
- `local.properties` signing with a null-guard.
- JVM args `-Xmx4g -XX:MaxMetaspaceSize=1g`.
- The F-Droid reference-APK flow: build → apksigner SHA256 → tag → GitHub release →
  `Binaries:` in the fdroiddata YAML.
