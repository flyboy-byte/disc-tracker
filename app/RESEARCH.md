# Disc Tracker — Android App Research

> Living reference document. Reviewed and corrected against a ChatGPT architecture audit (see `/home/ubuntu/updatereview.md`). Update this doc as decisions solidify. Not a build sprint — a foundation to build from when ready.
>
> **Prior art:** DragTree is the developer's other app — same stack (Expo + TypeScript + local SQLite, built entirely with local Gradle, no EAS), already live on Play Console (closed testing) and targeting F-Droid. Its build pipeline, `android/` prebuild, and `gradle.properties` are directly reusable here. Both apps share the same FOSS/F-Droid target.

---

## 1. Framework Decision: Expo + local Gradle

| | Expo | Flutter | Native Android |
|---|---|---|---|
| Language | TypeScript — direct JS port | Dart — new language | Kotlin — new language |
| iOS path | Possible later, not pursued now | ✅ same codebase | ❌ Android only |
| Prior experience | ✅ DragTree (developer's own app) live on Play Console | ❌ | ❌ |
| JS logic reuse | ✅ copy-paste + types | ❌ full Dart rewrite | ❌ full Kotlin rewrite |
| F-Droid | ✅ DragTree already has working F-Droid pipeline | ✅ possible | ✅ possible |

**Chosen: Expo (framework) + local Gradle builds only, no EAS.** The app is not performance-critical (UI + SVG, no 3D). All physics and scenario logic is pure JS — ports with type annotations only.

EAS is dropped entirely, not kept as a fallback — DragTree proved local `./gradlew` is manageable as long as the codebase stays simple, and it's what enables F-Droid reproducible builds and signing with your own keystore anyway. EAS cloud-built binaries don't byte-match F-Droid's build server output, which blocks the official F-Droid index. iOS is out of scope for now; if it's ever pursued, evaluate build tooling at that point rather than carrying `eas.json`/cloud-build ceremony around unused until then.

---

## 2. Data Architecture: Local-First SQLite

### Decision: Local-first + optional sync to own VPS

The Flask app is a localhost server that can't serve a phone directly. Three paths considered:

- **Path A (LAN bridge):** Phone calls Flask API over WiFi. Fragile, server-dependent, not a real app. Rejected.
- **Path B (local SQLite only):** `expo-sqlite` on device. Fully offline, no server dependency. **Chosen for v1.**
- **Path C (encrypted blob backup):** Encrypt disc data, push opaque blob to VPS. Originally planned for v1.1 — **replaced by Path D.**
- **Path D (sync with own Flask server):** Local SQLite on device stays the source of truth. Optional manual sync pushes/pulls the full bag to/from the existing VPS via the Flask API. **Target for v1.1.**

### Path D — Sync Architecture

The website's `/api/data` endpoints already do exactly what sync needs:
- `GET /api/data` — returns full disc list for a user
- `POST /api/data` — replaces full disc list for a user

The mobile app calls the same endpoints. No new server logic needed except token auth on those routes (~5 lines of Flask).

**Sync model:**
- Local SQLite is always the primary store — app works fully offline forever
- User opts in by entering their VPS URL + token in Settings
- **Push:** local → server (edited on phone, send up to website)
- **Pull:** server → local (edited on website, pull down to phone)
- Full replace in one direction. No merge, no conflict resolution. For a single-user bag, last-write-wins is correct.

**Flask changes needed for sync:**
```python
# Add to app.py — one token check on /api/data GET and POST
SYNC_TOKEN = os.environ.get('SYNC_TOKEN')  # set in environment

def require_sync_token():
    if SYNC_TOKEN and request.headers.get('Authorization') != f'Bearer {SYNC_TOKEN}':
        abort(401)
```

**Why this beats the encrypted blob backup:**
- No encryption complexity, no passphrase UX, no key derivation
- Sync result is readable on the website immediately — the "just works" continuity
- Single codebase (Flask) handles both web and mobile data
- Server is your own VPS either way — same trust model

### SQLite Schema (identical to Flask `init_db()`)

```sql
CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS discs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disc_id    INTEGER NOT NULL,
  mfr        TEXT DEFAULT '',
  mold       TEXT NOT NULL,
  plastic    TEXT DEFAULT '',
  weight     TEXT DEFAULT '',
  speed      REAL DEFAULT 0,
  glide      REAL DEFAULT 0,
  turn       REAL DEFAULT 0,
  fade       REAL DEFAULT 0,
  use_desc   TEXT DEFAULT '',
  thr        TEXT DEFAULT '',
  notes      TEXT DEFAULT '',
  color      TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_meta (
  user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  next_id   INTEGER DEFAULT 100,
  sort_mode TEXT DEFAULT 'speed-desc',
  arc_view  TEXT DEFAULT 'RHBH'
);
```

> **Critical:** SQLite does not enforce foreign keys by default. Every connection must run `PRAGMA foreign_keys = ON` before any operation, or `ON DELETE CASCADE` silently fails and orphaned discs accumulate. The Flask `get_db()` already does this — the mobile `db.ts` must too.

### Multi-user vs Single-user

Keep the multi-user schema for compatibility. But in v1, hide it: auto-create a single default user on first launch and skip the user picker screen. Add household/multi-user later without schema changes.

---

## 3. FOSS & GPLv3 Licensing

**License:** GPLv3 — copyleft: any fork or derivative must also be released under GPLv3, source included. Play Store doesn't care about license at all; F-Droid is fine with GPL (most F-Droid apps are GPL). Chosen deliberately over MIT to guarantee forks of this app stay open too — reinforces the "auditable, no hidden SDKs" privacy claim below — and to allow porting/deriving code from GPLv3 prior art like `shotshaper` (see `app/references/`).

### Distribution Targets

Both Disc Tracker and DragTree target the same two channels:

| Channel | Status | Notes |
|---------|--------|-------|
| Google Play Console | DragTree: live (closed testing) | Locally-built production AAB (`./gradlew bundleRelease`) |
| F-Droid | DragTree: in progress | Requires no proprietary deps; self-hosted repo via `fdroidserver` |

**F-Droid compatibility is a hard requirement, not optional.** This shapes every dependency choice: if a package pulls in Google Mobile Services (GMS) or any proprietary SDK, it breaks F-Droid distribution. All planned packages are permissively-licensed (GPL-compatible) and GMS-free — verify this stays true as packages are added.

### F-Droid Distribution

Two paths:

**Option A — Official F-Droid repo:** F-Droid builds your app from source on their infrastructure. Requires submitting metadata to `fdroid/fdroiddata` repo. Slower review process (weeks), but widest reach.

**Option B — Self-hosted F-Droid repo (fdroidserver):** Host your own F-Droid repo, users add your repo URL in the F-Droid app. DragTree uses this path. Faster to set up, full control. Can run alongside official submission.

Both can coexist. Start with self-hosted (reuse DragTree's fdroidserver setup), submit to official repo when the app is stable.

### F-Droid Metadata File

Each app needs `metadata/com.disctracker.app.yml` in your F-Droid repo:

```yaml
Categories:
  - Sports
License: GPL-3.0-or-later
SourceCode: https://github.com/flyboy-byte/disc-tracker
IssueTracker: https://github.com/flyboy-byte/disc-tracker/issues

Builds:
  - versionName: '1.0.0'
    versionCode: 1
    commit: v1.0.0
    gradle:
      - yes
```

### No GMS / Proprietary Dependency Rule

F-Droid's build server rejects apps that depend on `com.google.android.gms` or any non-free SDK. Before adding any package, check it doesn't pull GMS transitively:

```bash
cd android && ./gradlew app:dependencies | grep -i 'gms\|firebase\|play-services'
```

All current planned packages pass this check. `react-native-quick-crypto` (v1.1) uses OpenSSL — fine.

### What GPLv3 Licensing Gives You

Open source means anyone can read the code and verify there's no hidden tracking — that's a real and meaningful privacy claim. GPLv3 goes further than a permissive license here: anyone who forks the app and redistributes a modified version is legally required to publish their changes too, so the "auditable, no hidden SDKs" claim holds for every downstream fork, not just this repo. F-Droid reinforces this: users can install from a fully open channel with no Google account required.

### Dependency License Audit

Run before every production build. This checks that dependencies are compatible with the project's GPLv3 license (permissive deps like MIT/BSD/Apache are fine to depend on — GPL only requires the combined work you distribute to be GPL, not that every dependency also be GPL):

```bash
npx license-checker --onlyAllow 'MIT;BSD-2-Clause;BSD-3-Clause;Apache-2.0;ISC;0BSD;GPL-3.0;GPL-3.0-or-later;LGPL-3.0'
```

All planned packages pass this check. Add this to CI so it can't silently break.

---

## 4. Privacy Design

### Principles

1. **Local by default.** No network call happens without explicit user opt-in.
2. **No third-party analytics.** No usage tracking, no A/B testing SDK, no ad networks.
3. **No account required.** No email, no phone, no OAuth.
4. **Crash reporting is optional.** Play Console's built-in ANR/crash visibility is free and requires no SDK. Self-hosted Sentry is also fine — you control the server, data doesn't go to a third party. Just declare it accurately in the Data Safety form if you add it.
5. **Deletable.** User can wipe all local data from within the app.

### Sync Privacy Principles (v1.1)

1. **Opt-in only.** Sync is off by default. No network call happens until the user explicitly configures a server URL and token.
2. **Your server, your data.** The VPS is user-controlled infrastructure — not a third party. The app never sends data anywhere the user didn't configure.
3. **No account.** Auth is a bearer token the user sets themselves, not a username/password system.
4. **Deletable.** Sync settings (URL + token) can be cleared from within the app, which stops all future sync calls.
5. **Auditable.** Both the mobile sync code and the Flask endpoint are open source — anyone can verify what's sent and received.

---

## 5. Distribution Compliance

### Target SDK

> **Correction:** As of **August 31, 2025**, Google Play requires `targetSdkVersion >= 35` (Android 15) for all new apps and updates. The previous doc said API 34 — that is stale. Expo SDK 54 sets API 35 by default. Verify in `android/build.gradle` before submitting. F-Droid has no minimum SDK requirement — API 35 is fine there too.

### Data Safety Form

Google's definition of "collect" is data transmitted off the device. Data processed only locally does not need to be disclosed.

**v1 (local-only, no sync):**

| Data Type | Collected? | Notes |
|-----------|-----------|-------|
| Any personal data | **No** | Everything stays on device |

Form answer: **"No data collected or shared."** Cleanest possible submission.

**v1.1 (optional sync added):**

| Data Type | Collected? | Shared? | Notes |
|-----------|-----------|---------|-------|
| Disc bag data | **Optional** | **No** | Only if user enables sync; sent to user's own server |
| Any third-party data | **No** | **No** | Sync goes to user-controlled VPS only |

Form answer for v1.1: declare optional data transmission to user-provided server, user-initiated only, user can delete. Google generally accepts "user's own infrastructure" as not a third-party share — but this needs to be worded carefully and is an **open question** (see Section 11).

### Proving Sync is Private — Open Problem

This is the hard part. Anyone can claim "your data goes to your own server." Here's how to make that claim credible:

**What we have:**
- GPLv3 source code — anyone can read the sync function and verify it only calls the URL the user configured, and any fork of this verification tooling must stay open too
- No third-party SDK in the network path — standard `fetch()`, nothing else
- Flask endpoint is also open source in the same repo — server side is auditable too
- No device identifiers, no analytics, no fingerprinting in the sync payload

**What still needs to be figured out before submission:**
- Exact wording for Play Store Data Safety form when sync is opt-in and server is user-owned (research how other self-hosted sync apps like Syncthing, Nextcloud, Obsidian handle this)
- Whether F-Droid's official index has any stance on apps with optional network features
- Privacy policy language that accurately describes "we send your data to a server YOU configured, not ours"
- Whether to publish a simple API spec (OpenAPI/Swagger) for the sync endpoints — makes the "open API" claim concrete and lets advanced users verify or self-host

> **Don't block shipping on this.** v1 ships local-only with a clean Data Safety form. Figure out the sync privacy wording before v1.1 submission, not before v1.

### Privacy Policy

Required even for local-only apps. Host on GitHub Pages. Minimum content:
1. What data the app stores (local SQLite — disc data, preferences)
2. That data never leaves the device in v1
3. What is not collected (no analytics, no ads, no tracking, no account)
4. Contact email
5. (v1.1) Sync section: data only goes to a server URL the user provides, user can disable at any time, server is not operated by the developer

### Other Play Console Declarations

| Field | Value |
|-------|-------|
| Category | Sports |
| Content rating | Everyone (IARC questionnaire) |
| Target audience | All ages |
| App signing | Google Play App Signing, uploaded AAB signed locally via `android/local.properties` keystore |

---

## 6. Expo Go vs Development Build

> **Correction:** Expo Go works for early layout/UI work but **cannot run native modules** (e.g. `expo-sqlite`, `react-native-svg`'s native bindings). Once any package with native code is installed, testing requires a **development build** — built locally via `./gradlew`, not EAS.

For pure-JS/layout work: Expo Go is fine for early testing.
Once native modules are in the dependency tree (expected from Phase 1 onward — `expo-sqlite` alone requires it): switch to a locally-built dev client.

```bash
# Early layout-only work (Expo Go compatible)
npx expo start

# Once native modules are added — local dev build, no EAS
npx expo run:android
# This builds and installs a dev client via local Gradle; `npx expo start` then
# connects to it the same way it would to Expo Go.
```

Note: Path D's sync (§2) is plain HTTPS + a bearer token, not client-side encryption — no crypto native module is needed for it.

---

## 7. Physics Architecture: V2 Design

> This section documents the planned physics improvement. The port is **not** a rewrite — current math is preserved as `legacyPhysics.ts`. V2 is built alongside it.

### Problem with current approach

`arcPoints()` in `flightshape.html` goes directly from flight numbers to Bézier control points. The curve is simultaneously the physics model, the tuning constants, and the renderer. Changing any one of these risks breaking the others. There is no test surface.

### V2 Architecture

```
Input layer:   disc numbers + ThrowParams (hyzer, nose, wind, power, spin, arcView)
     ↓
Model layer:   simulateFlight() → FlightPoint[]  (50–120 points: {x, y, speed, phase})
     ↓
Render layer:  flightPointsToSvgPath(points) → SVG path string
     ↓
Component:     <ArcSvg> renders the string — contains zero physics logic
```

**Key rule:** React Native components must not contain flight math. They call the model, render the result.

### `physicsV2.ts` — timestep simulation (not Bézier-first)

```typescript
// All tuning constants in one place — easy to adjust and test
export const DEFAULT_FLIGHT_TUNING = {
  dragRate:       0.012,   // speed loss per timestep
  turnGain:       1.0,     // multiplier on high-speed turn force
  fadeGain:       1.0,     // multiplier on low-speed fade force
  glideLift:      0.03,    // distance bonus per glide point
  spinResistance: 0.008,   // how much spin resists heading change
  nosePenalty:    0.015,   // distance loss per degree nose-up
  windInfluence:  0.08,    // heading shift per wind unit
  phaseTransition: 0.55,   // speed ratio where turn→fade crossover happens
};

export function simulateFlight(
  disc: DiscFlightNumbers,
  params: ThrowParams,
  tuning = DEFAULT_FLIGHT_TUNING
): FlightPoint[] { ... }

export function flightPointsToSvgPath(points: FlightPoint[]): string { ... }
```

**Timestep logic:**
1. Start with initial speed = `(disc.speed / 14) * power`
2. Each step: reduce speed by drag × glide factor
3. Compute phase = current speed / initial speed
4. If phase > phaseTransition: apply turn force (negative turn, anhyzer, wind)
5. If phase ≤ phaseTransition: apply fade force (positive fade, hyzer, low spin)
6. Update heading gradually (not instantly)
7. Move position along heading
8. Apply lateral wind drift
9. Stop at distance/speed threshold
10. Smooth path for SVG

**Behavior goals (from audit):**

| Input | Expected behavior |
|-------|------------------|
| RHBH, negative turn | Drifts right during high-speed phase |
| RHBH, positive fade | Finishes left during low-speed phase |
| More power | Turn phase more pronounced |
| Less power | Disc behaves more overstable (less speed to reveal turn) |
| Headwind | Disc behaves effectively faster early → more turn |
| Tailwind | Disc behaves effectively slower → more overstable |
| Hyzer release | Resists turn, increases fade finish |
| Anhyzer release | Encourages right movement, possible flex |
| Nose up | Reduces distance, earlier fade |
| Low spin | Earlier fade, less smooth transition |
| High spin | Smoother hold, later transition |

**External validation:** Giljarhus, Gooding & Njærheim (2022), *Sports Engineering* 25:26 (CC BY 4.0,
saved at `app/references/giljarhus-2022-disc-golf-trajectory-modelling.pdf`) combines CFD-derived
aero coefficients with rigid-body flight simulation, validated against real tracked throws. Two
things from it back up the design above rather than changing it:

- The turn→fade phase mechanism is physically grounded, not just an empirical fit: high early-flight
  speed → high lift → disc rises → angle of attack drops → negative roll rate → turn direction. As
  speed bleeds off, lift drops → AoA rises → roll rate flips sign → fade direction. This is the same
  speed-ratio-driven crossover as `phaseTransition` above.
- Their roll-rate equation is `θ̇ = -M / (ω·(Ixy - Iz))` — inversely proportional to spin rate ω, the
  same functional shape as `spin_turn`/`spinEffect` in `static/physics.js` (`MOD.spin_turn`). Independent
  confirmation the inverse-spin formula is the right shape, not just plausible.

Their model needs full CFD/wind-tunnel aero coefficient curves per disc (only 3 discs tested: DD/CD/CD2),
which we don't have for the 1,660+ discs in `discs_master.json` — so it can't replace the flight-number-driven
approach here, only inform tuning.

### Hidden Developer Screen

During development, expose `DEFAULT_FLIGHT_TUNING` constants as sliders in a hidden screen (`/dev` route or long-press on version number). Throw a real disc, observe, adjust. Hardcode the tuned values before v1 release. Do not expose in normal UI.

### Migration Strategy

```
src/utils/legacyPhysics.ts   ← current applyModifiers() + arcPoints() preserved exactly
src/utils/physicsV2.ts        ← new simulateFlight() + DEFAULT_FLIGHT_TUNING
src/utils/flightRenderer.ts  ← flightPointsToSvgPath()
```

Both run in parallel initially. The FlightShape screen can have a toggle to compare. Once V2 is validated against real throw data, legacy is deprecated (not deleted until V2 is proven).

### Real Throw Data Collection

Without real data, tuning is just guessing. Collect per throw:
- Disc mold, speed/glide/turn/fade, weight
- Throw type (RHBH/RHFH/LHBH/LHFH)
- Release angle estimate (hyzer °, flat, anhyzer °)
- Nose angle estimate (up/neutral/down)
- Power estimate (50/70/90/100%)
- Wind (calm / head / tail / left / right, rough mph)
- Actual distance (UDisc, Google Maps, pacing)
- Lateral finish (feet left/right of target line)
- Shape label: straight / hyzer-finish / turnover / S-curve / flex / roller-risk

Tune the model against **shape class correctness**, not exact distance. A model that correctly predicts "this disc will turn right then finish straight" is more valuable than one that claims "274 ft" and is wrong.

---

## 8. Package List (GPL-compatible)

| Package | Purpose |
|---------|---------|
| `expo` | Core SDK (SDK 54+ ships expo-sqlite v14 natively) |
| `expo-router` | File-based navigation |
| `expo-sqlite` | Local database — use v14+ (built into SDK 54), NOT the community package |
| `react-native-svg` | Arc flight shape SVG |
| `react-native-draggable-flatlist` | Drag-reorder disc bag |
| `@react-native-community/slider` | Sliders (hyzer, nose, wind, arm, spin) |
| `react-native-gesture-handler` | Touch gesture primitives |
| `react-native-reanimated` | Animations — use Reanimated 4 + `useSharedValue` for 60fps slider arc |
| `expo-file-system` | CSV export to device |
| `expo-sharing` | Share/export CSV file |
| `react-native-quick-crypto` | v1.1 only — encrypted backup |

---

## 9. Project File Structure

```
disc_tracker/
├── LICENSE                          ← GPLv3
├── app.py                           ← Flask backend (unchanged)
├── templates/                       ← Web app (unchanged)
├── static/
│   └── discs_master.json            ← Master library (233 KB, 1660+ discs)
└── app/                             ← Expo project root
    ├── LICENSE                      ← GPLv3
    ├── RESEARCH.md                  ← This document
    ├── MOBILE_PORT_AUDIT.md         ← Website behavior inventory
    ├── PORT_PLAN.md                 ← Phased implementation plan
    ├── app.json                     ← Expo config (SDK 54+, API 35)
    ├── package.json
    ├── package-lock.json            ← Committed lockfile
    ├── tsconfig.json
    ├── android/                     ← Committed prebuild output (see Section 10)
    ├── assets/
    │   ├── icon.png
    │   ├── splash.png
    │   └── discs_master.json        ← Bundled copy
    └── src/
        ├── theme.ts                 ← Color constants (CSS vars → JS)
        ├── db/
        │   ├── db.ts                ← expo-sqlite + PRAGMA foreign_keys = ON
        │   └── migrations.ts        ← versioned schema, run on app launch
        ├── utils/
        │   ├── disc.ts              ← stab(), stabClass(), stabShort(), CSV
        │   ├── legacyPhysics.ts     ← applyModifiers(), arcPoints() — preserved
        │   ├── physicsV2.ts         ← simulateFlight(), DEFAULT_FLIGHT_TUNING
        │   ├── flightRenderer.ts    ← flightPointsToSvgPath()
        │   └── scenarios.ts         ← 12 SCENARIOS array + bagTest filters
        ├── screens/
        │   ├── BagScreen.tsx        ← v1: single user, no picker
        │   ├── FlightShapeScreen.tsx
        │   ├── DiscSuggestScreen.tsx
        │   └── DevScreen.tsx        ← hidden tuning sliders (dev only)
        └── components/
            ├── DiscCard.tsx
            ├── ArcSvg.tsx           ← calls flightPointsToSvgPath(), no physics
            ├── VerticalSlider.tsx
            └── StabilityChip.tsx
```

---

## 10. Build Pipeline

### Why local Gradle (not EAS)

Two reasons, both proven on DragTree:

1. **F-Droid reproducible builds:** EAS builds on Expo's cloud servers (Ubuntu + specific toolchain). F-Droid builds in a Debian trixie sandbox. The environments never match — byte comparison always fails. Local builds close that gap: same JDK flavor, same NDK version, same flat `node_modules`. No React Native/Expo app is *known* to have achieved a full F-Droid byte-match, but local is as close as it can get.

2. **Transparency:** `./gradlew assembleRelease` is something you own and can debug. EAS is a black box that adds ceremony (cloud queue, CLI auth, pnpm workspace issues in DragTree's case) on top of something Gradle can do directly.

Expo the **framework** stays (expo-sqlite, expo-router, react-native-svg, all packages). EAS the **cloud build service** is dropped entirely — Android builds only ever go through local Gradle. iOS is not being pursued right now; if that changes later, revisit build tooling then.

### Required toolchain

Learned from DragTree — use these exact versions to match F-Droid's build environment as closely as possible:

| Tool | Version | Notes |
|------|---------|-------|
| JDK | 21 **OpenJDK** (not Temurin) | F-Droid uses OpenJDK; Temurin has different internals |
| Android SDK | 36 | |
| NDK | 27.1.12297006 | Exact version matters for reproducibility |
| Node | via `.nvmrc` | Pinned version |
| npm | at repo root | **Not pnpm.** Flat `node_modules`, no workspace hoisting |

### Repo structure — flat, no monorepo

DragTree started as a pnpm workspace monorepo and migrated away from it. Disc Tracker should never be a monorepo. Use:
- `npm install` at repo root
- No `pnpm-workspace.yaml`, no `.npmrc` with hoisted linker
- No nested `artifacts/` subdir — `android/` lives at repo root after prebuild

### How local builds work with Expo

`expo prebuild` generates the bare `android/` project from your JS/TS source. After that, Gradle takes over — Expo is not involved in compilation.

```bash
# Generate the android/ project (run when app.json or native deps change)
npx expo prebuild --platform android --clean

# Build APK locally (F-Droid, sideload, testing)
cd android && ./gradlew assembleRelease

# Build AAB locally (Play Store)
cd android && ./gradlew bundleRelease
```

### Signing with your own keystore

Use `android/local.properties` for credentials — never committed, never in env vars. This pattern (from DragTree) prevents AGP config-time failures on machines without credentials:

```groovy
// android/app/build.gradle
def keystorePropertiesFile = rootProject.file("local.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    release {
        if (keystoreProperties['RELEASE_STORE_FILE']) {
            storeFile file(keystoreProperties['RELEASE_STORE_FILE'])
            storePassword keystoreProperties['RELEASE_STORE_PASSWORD']
            keyAlias keystoreProperties['RELEASE_KEY_ALIAS']
            keyPassword keystoreProperties['RELEASE_KEY_PASSWORD']
        }
    }
}
buildTypes {
    release {
        // Falls back to debug keystore when local.properties absent
        signingConfig signingConfigs.release
    }
}
```

Track `android/local.properties.example` in git as a template. Add `android/local.properties` and `android/app/*.keystore` to `.gitignore`.

**F-Droid note:** F-Droid runs `sed -i '/signingConfig /d'` on build.gradle — it strips signing entirely and produces an unsigned APK. This is expected and correct. You sign the *reference APK* separately with your production keystore and upload it to GitHub releases alongside the tag.

Same key signs both Play Store AAB and reference APK — Play Store upgrades work correctly on devices that installed via F-Droid.

### Commit the android/ prebuild

```bash
npx expo prebuild --platform android --clean
git add android/
git commit -m "add android prebuild output"
```

Re-run and re-commit when: native package versions change, `app.json` plugin config changes, or Expo SDK upgrades.

### gradle.properties — set before first build

```properties
# Prevents OOM at dex merge (React Native eats heap)
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8
org.gradle.workers.max=2
```

### Gradle failure order of likelihood

1. **OOM at dex merge** — set JVM args above before the first `./gradlew` run
2. **Node not found at Gradle configure time** — Expo SDK 54's `settings.gradle` calls `node`; make sure it's on PATH
3. **npm install from wrong directory** — run at repo root only, never from `app/` subdir
4. **Deprecated Gradle features warning** — ignore; Expo/RN internals use APIs deprecated in Gradle 9, not fatal

### F-Droid reference APK workflow

1. Build locally with production keystore: `./gradlew assembleRelease`
2. Verify: `apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk` — confirm SHA256 matches `AllowedAPKSigningKeys` in fdroiddata YAML
3. Tag the release: `git tag v1.0.0 && git push --tags`
4. Upload signed APK to GitHub releases as `disc-tracker-v1.0.0.apk`
5. Add `Binaries:` entry to fdroiddata YAML pointing at the GitHub release URL
6. F-Droid builds from source, strips signing, compares output to your reference APK

### Reference project: DragTree

**DragTree is the developer's other app** — same stack, completed the pnpm→npm migration and local build setup. Copy from it directly:
- `android/app/build.gradle` — signing config pattern with `local.properties`
- `android/local.properties.example` — credential template
- `gradle.properties` JVM args
- `lib/settings.ts` — pub/sub + AsyncStorage for local state (no Redux/Zustand)
- `fdroidserver` config + metadata YAML format

**What DragTree resolved that this app benefits from:**
- pnpm workspace → flat npm (eliminates hoisted linker, workspace ceremony, cd path issues)
- Monorepo subdir → repo root (eliminates F-Droid subdir confusion)
- EAS → local Gradle (eliminates cloud environment mismatch for F-Droid)
- Signing via `local.properties` (no null `storeFile` crash on CI/F-Droid)

---

## 11. External Reference: DiscIt API

Repo cloned at `/home/ubuntu/refs/discit-api`.

Live API: `https://discit-api.fly.dev/disc` — scrapes Marshall Street Disc Golf's flight guide nightly. 1,203 discs, ~92% have `pic` URLs.

The `pic` field is a 400×340 webp from Marshall Street's S3 bucket showing the real measured RHBH flight path on a coordinate grid, plus PDGA physical specs. This is sourced from the Marshall Street flight guide, not computed from flight numbers.

**What it adds over `discs_master.json`:**
- `pic` — Marshall Street flight path image URL
- `link` — Marshall Street store URL per disc
- `stability` — 5-tier text label (Very Understable → Very Overstable)
- `color` / `background_color` — Marshall Street's own color coding per disc
- PDGA physical specs (embedded in the image, not as separate fields in the API)

**Decision:** Use `pic` URLs as an optional reference display in v1.1. See PORT_PLAN.md — Marshall Street Flight Path Images section.

---

## 12. Open Questions

1. **V1 local-only?** Yes — confirmed. No sync in v1. Keeps Data Safety form at "no data collected."
2. **Single-user v1?** Yes — auto-create default user, skip picker screen. Schema stays multi-user for future.
3. **Play Store slug?** `com.disctracker.app` — verify availability in Play Console before first build.
4. **Offline disc library updates?** `discs_master.json` bundled — new discs require app update. Fine for v1.
5. **V2 physics in v1 or v1.1?** V2 is the right architecture but should not block shipping. Port legacy math first (unblock v1), build V2 in parallel, ship in v1.1.
6. **Sync Data Safety wording (v1.1 blocker):** Research how other open-source self-hosted sync apps (Obsidian Sync, Nextcloud, Syncthing) handle Play Store Data Safety form when sync is opt-in and server is user-owned. Do not submit v1.1 to Play Store without resolving this.
7. **F-Droid official index stance on optional network features:** Check F-Droid inclusion policy — optional sync should be fine but confirm before submitting to official index.
8. **OpenAPI spec for sync endpoints:** Consider publishing a simple spec for `GET /api/data` and `POST /api/data` in the repo. Makes the "open API, auditable sync" claim concrete rather than just a promise.
9. **Token setup UX:** How does the user get a sync token? Options: (a) auto-generate in Flask admin, (b) set via env var on VPS, (c) in-app QR code pairing. Needs a decision before building sync UI.
