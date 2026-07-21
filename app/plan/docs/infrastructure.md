# Infrastructure

> **Tier:** Low-level (build detail) · **Audience:** whoever is actually building this ·
> **Use when:** setting up tools and scaffolding before building the first real
> version. Assumes the reader has already read
> [`overview.md`](./overview.md) and doesn't need the framing re-explained.

What's actually needed to build and run the smallest real version of this project.

## Core tools / platforms

- **Expo SDK 57**, TypeScript, `expo-router` (file-based routing, bottom tab shell:
  Bag / Flight Shaper / Disc Suggest)
- **JDK 21 OpenJDK** specifically (not Temurin) — the default `java` on this machine
  resolves to JDK 26, so `JAVA_HOME` must be set explicitly per-build
- **Android SDK 36**, **NDK 27.1.12297006** (exact pin, already installed and confirmed
  present on this machine — platforms up to 36.1, build-tools up to 37.0.0)
- **Flat `npm`** at the repo root — no pnpm, no workspace, no monorepo subdir (F-Droid
  compatibility requirement carried over from DragTree's proven setup)
- Local AVDs already present (`Medium_Phone.avd`, `Pixel_9.avd`) for the deferred
  on-device verification step
- Key native deps: `react-native-svg`, `react-native-reanimated` 4.5.0 (pulls in
  `react-native-worklets` as a hard peer dep — this broke bundling once already when
  silently pruned; documented from git history (commit `c5899e9`), not yet noted in
  `PORT_PLAN.md` itself — see `risks.md`), `react-native-gesture-handler`,
  `react-native-draggable-flatlist`, `expo-sqlite`, `expo-file-system`,
  `expo-sharing`, `expo-document-picker`

## Data / storage

On-device SQLite via `expo-sqlite` (v14+, built into SDK 57's toolchain, no community
package). Schema lives in `src/db/migrations.ts`, mirroring `app.py`'s `init_db()`
exactly (including `in_bag`), applied via versioned migrations rather than bare
`CREATE IF NOT EXISTS`. `src/db/db.ts` is the CRUD layer — `saveDiscs()` uses
`withExclusiveTransactionAsync` (not the non-exclusive `withTransactionAsync`) so bulk
replace can't be interrupted by a concurrent query. `assets/discs_master.json` (the
1,660+ disc library) ships bundled in the app via `require()` — no network call needed.

## Hard constraints (do not violate)

Carried over verbatim from `PORT_PLAN.md`/`CLAUDE.md` — these are load-bearing, not
suggestions:

- Do not rewrite the physics model — port as `legacyPhysics.ts`, improve separately
- Do not invent new formulas or change flight-number interpretation
- Do not add cloud backup, analytics, Firebase, Sentry, OAuth, or ads
- Do not make the app depend on the Flask server
- Local-only v1, single-user UX, Android-first
- Do not work ahead — complete and verify each phase before starting the next
- No EAS anywhere — local Gradle only, no `eas.json`
- Never run distribution tracks D1/D2/D3 in parallel

## Security-relevant infrastructure

- **Signing**: `android/local.properties` (gitignored) holds the release keystore path,
  with a null-guard in `build.gradle` that falls back to debug signing when no keystore
  is configured — same pattern as DragTree. `local.properties.example` is the committed
  template. Confirmed via repeated `git add -n app/` dry-runs that no keystore/signing
  material has ever been staged.
- **No secrets in the app at all** by design — no API keys, no auth tokens, no network
  calls in v1 (the whole point of local-first). This substantially shrinks the security
  surface compared to the website (which does have CSRF/SSRF concerns to manage).

## Testing infrastructure

- **Pure-logic tests**: Jest + `ts-jest`, `*.test.ts` beside each `src/utils/` module,
  asserting the Phase 0 parity fixtures from `PORT_PLAN.md`. Currently 48/48 passing.
- **What's explicitly NOT covered by Jest**: `expo-sqlite` — it's a native module with
  no real SQL behavior under plain Node/Jest (confirmed by an actual failed attempt:
  `SyntaxError: Unexpected token 'export'` trying to transform its ESM build output). A
  test file was written and deleted rather than kept as a misleading "pass." Real
  verification needs an Android emulator or physical device — deliberately deferred,
  not silently skipped (see `FRAMEWORK.md` Phase 2 and `risks.md`).
- **Bundling verification**: `npx expo export --platform android` — this is the only
  check that actually catches JS-pre-bundling breaks (a real regression happened once
  this way: a silently-pruned `react-native-worklets` dependency broke every
  pre-bundled build path, invisible to both Jest and the one successful `assembleDebug`
  build because Gradle-only builds talk to a live Metro server instead).

## Build size / build time (audited 2026-07-21)

Checked what's actually driving APK size and build time before assuming "more native
code" would help. Findings: the app is already close to maximally native for an
Expo/RN stack — New Architecture (Fabric + TurboModules) is on
(`newArchEnabled=true`), Hermes bytecode is on (`hermesEnabled=true`), and every major
dependency (svg, sqlite, gesture-handler, reanimated, slider) is a native module with a
thin JS bridge, not a JS-only library. There isn't a further "write more native code"
lever available without leaving Expo/RN entirely, which would undo the main reason it
was chosen (JS logic reuse, DragTree precedent). The actual levers are packaging
config, not code:

- **R8 minify + resource shrinking were off for release builds** (Expo's default
  template ships both flags defaulted to `false`) — turned on in `gradle.properties`
  this session (`android.enableMinifyInReleaseBuilds` /
  `android.enableShrinkResourcesInReleaseBuilds`, both release-only, verified via
  `app/build.gradle` that debug is unaffected). Needs a real `assembleRelease`/
  `bundleRelease` run to confirm nothing gets over-stripped (reanimated/turbomodule
  keep rules already exist in `proguard-rules.pro`) — not yet verified end-to-end.
- **`reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`** in `gradle.properties`
  builds native code for all 4 ABIs by default. Resolved by scope rather than by
  editing that shared value: it stays at all 4 as the default (so local
  `assembleDebug`/emulator builds keep working — this machine's AVDs are x86_64), and
  release/sideload/AAB builds now explicitly pass
  `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` on the command line (the officially
  supported per-invocation override, since the React Native Gradle Plugin reads this as
  a plain Gradle project property rather than something configurable per build variant
  in `build.gradle`) — see the updated commands in `../../PORT_PLAN.md` Phase 8 and D1.
  Real phones are arm64-v8a or (older hardware) armeabi-v7a; x86/x86_64 are
  emulator/Chromebook-only and pure dead weight in anything that ships. **Not yet
  verified with a real build** — the override needs a real `assembleRelease` run to
  confirm it doesn't break anything before it's trusted.
- **Play Store size is already handled separately from this**: `bundleRelease`
  produces an AAB, and Play generates per-device split APKs from it automatically —
  minify/shrink still help (smaller AAB, less to transfer/analyze), but ABI bloat
  specifically only matters for the F-Droid reference-APK workflow and direct sideload
  installs, which use a universal APK with all compiled ABIs.

## What's notably absent (gaps to fill)

- No CI pipeline yet — all verification so far has been manual, local runs. Not
  necessarily needed for a solo FOSS project, but worth a deliberate decision rather
  than defaulting to "eventually."
- No crash/error visibility mechanism at all (deliberately, per the "no Sentry/
  analytics" constraint) — for a local-only single-user app this is probably fine, but
  it means any crash in the field is invisible unless the user reports it directly.
- Physics-sim mode (`shotshaper`, the vendored rigid-body flight simulator used in the
  website's Flight Shaper) has no mobile equivalent planned anywhere in `PORT_PLAN.md`
  — it's Python/NumPy/SciPy server-side only. Not flagged as in-scope or out-of-scope
  explicitly anywhere; see `notes.md`.
