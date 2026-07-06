# Disc Tracker — Android App Research

> Living reference document. Reviewed and corrected against a ChatGPT architecture audit (see `/home/ubuntu/updatereview.md`). Update this doc as decisions solidify. Not a build sprint — a foundation to build from when ready.
>
> **Prior art:** DragTree is the developer's other app — same stack (Expo EAS + TypeScript + local SQLite), already live on Play Console (closed testing) and targeting F-Droid. Its build pipeline, `android/` prebuild, `eas.json`, and `gradle.properties` are directly reusable here. Both apps share the same FOSS/F-Droid target.

---

## 1. Framework Decision: Expo EAS

| | Expo EAS | Flutter | Native Android |
|---|---|---|---|
| Language | TypeScript — direct JS port | Dart — new language | Kotlin — new language |
| iOS path | ✅ same codebase | ✅ same codebase | ❌ Android only |
| Prior experience | ✅ DragTree (developer's own app) live on Play Console | ❌ | ❌ |
| JS logic reuse | ✅ copy-paste + types | ❌ full Dart rewrite | ❌ full Kotlin rewrite |
| F-Droid | ✅ DragTree already has working F-Droid pipeline | ✅ possible | ✅ possible |

**Chosen: Expo (framework) + local Gradle builds (pipeline).** The app is not performance-critical (UI + SVG, no 3D). All physics and scenario logic is pure JS — ports with type annotations only. iOS comes for free later.

EAS cloud builds are kept as a fallback (useful for iOS), but Android is built locally with `./gradlew` — this is what enables F-Droid reproducible builds and signing with your own keystore. EAS cloud-built binaries don't byte-match F-Droid's build server output, which blocks the official F-Droid index.

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

## 3. FOSS & MIT Licensing

**License:** MIT — most permissive, Play/App Store compatible, F-Droid compatible, no copyleft.

### Distribution Targets

Both Disc Tracker and DragTree target the same two channels:

| Channel | Status | Notes |
|---------|--------|-------|
| Google Play Console | DragTree: live (closed testing) | Standard EAS production AAB |
| F-Droid | DragTree: in progress | Requires no proprietary deps; self-hosted repo via `fdroidserver` |

**F-Droid compatibility is a hard requirement, not optional.** This shapes every dependency choice: if a package pulls in Google Mobile Services (GMS) or any proprietary SDK, it breaks F-Droid distribution. All planned packages are MIT and GMS-free — verify this stays true as packages are added.

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
License: MIT
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

### What MIT Licensing Gives You

Open source means anyone can read the code and verify there's no hidden tracking — that's a real and meaningful privacy claim. The baseline MIT license is enough to honestly say "open source, auditable code, no hidden SDKs." F-Droid reinforces this: users can install from a fully open channel with no Google account required.

### Dependency License Audit

Run before every EAS production build:

```bash
npx license-checker --onlyAllow 'MIT;BSD-2-Clause;BSD-3-Clause;Apache-2.0;ISC;0BSD'
```

All planned packages are MIT. Add this to CI so it can't silently break.

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
- MIT source code — anyone can read the sync function and verify it only calls the URL the user configured
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
| App signing | Google Play App Signing via EAS |

---

## 6. Expo Go vs Development Build

> **Correction:** Expo Go works for early layout/UI work but **cannot run native modules** like `react-native-quick-crypto`. Once any package with native code is installed, testing requires an **EAS Development Build** (`eas build --profile development`), not Expo Go.

For v1 (no crypto, no native-only packages): Expo Go is fine for early testing.
For v1.1 (encrypted backup adds `react-native-quick-crypto`): switch to dev build before testing backup.

```bash
# v1 testing (Expo Go compatible)
npx expo start

# v1.1+ (native modules — requires dev build)
eas build --platform android --profile development
# Install the APK, then `npx expo start` connects to it
```

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

## 8. Package List (all MIT)

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
├── LICENSE                          ← MIT
├── app.py                           ← Flask backend (unchanged)
├── templates/                       ← Web app (unchanged)
├── static/
│   └── discs_master.json            ← Master library (233 KB, 1660+ discs)
└── app/                             ← Expo project root
    ├── LICENSE                      ← MIT
    ├── RESEARCH.md                  ← This document
    ├── MOBILE_PORT_AUDIT.md         ← Website behavior inventory
    ├── PORT_PLAN.md                 ← Phased implementation plan
    ├── app.json                     ← Expo config (SDK 54+, API 35)
    ├── eas.json                     ← EAS build profiles
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

### Primary: Local Gradle builds

**EAS cloud builds are not the primary pipeline.** EAS-built binaries do not byte-match F-Droid's reproducible builds — the cloud build environment (Expo's servers, timestamps, toolchain) can't be replicated by F-Droid's build server. The fix is to build locally with Gradle directly, sign with your own keystore, and give F-Droid something it can actually reproduce from source.

Expo the **framework** stays (expo-sqlite, expo-router, react-native-svg, all packages). EAS the **cloud build service** is demoted to optional/fallback (useful for iOS later, or as a backup).

### How local builds work with Expo

`expo prebuild` generates the bare `android/` project from your JS/TS source. After that, standard Gradle takes over — Expo is not involved in the actual compilation.

```bash
# Generate the android/ project (run whenever app.json or native deps change)
npx expo prebuild --platform android --clean

# Build APK locally (F-Droid, sideload, testing)
cd android
./gradlew assembleRelease

# Build AAB locally (Play Store)
./gradlew bundleRelease
```

### Signing with your own keystore

Configure once in `android/app/build.gradle` — credentials read from environment or `~/.gradle/gradle.properties` so they're never committed:

```groovy
signingConfigs {
    release {
        storeFile file(System.getenv("KEYSTORE_PATH"))
        storePassword System.getenv("KEYSTORE_PASSWORD")
        keyAlias System.getenv("KEY_ALIAS")
        keyPassword System.getenv("KEY_PASSWORD")
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
    }
}
```

Same key signs both the Play Store AAB and the F-Droid APK — this matters for Play Store upgrades to work correctly on devices that installed via F-Droid first (and vice versa).

### Commit the android/ prebuild — do not gitignore it

Every build-path problem traces back to treating the prebuild output as throwaway. It belongs in version control.

```bash
npx expo prebuild --platform android --clean
git add android/
git commit -m "add android prebuild output"
```

Re-run prebuild (and re-commit) when: native package versions change, `app.json` plugin config changes, or Expo SDK is upgraded.

### gradle.properties — set before first build

```properties
# Prevents OOM at dex merge (React Native eats heap)
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8
org.gradle.workers.max=2
```

### Gradle failure order of likelihood

1. **OOM at dex merge** — set the JVM args above before the first `./gradlew` run
2. **Node not found at Gradle configure time** — Expo SDK 54's `settings.gradle` calls `node` to resolve package paths; make sure `node` is on `PATH` before Gradle runs
3. **pnpm install from wrong directory** — monorepo root only, never from inside the `app/` subdir
4. **Deprecated Gradle features warning** — ignore; Expo/RN internals use APIs deprecated in Gradle 9, not fatal

### EAS — kept for iOS and as fallback

EAS is still useful for iOS builds (requires macOS/Xcode otherwise) and as a fallback if local Android builds break. Keep `eas.json` in the repo but it is not the primary Android pipeline.

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

### Reference project: DragTree

**DragTree is the developer's other app** — same stack, currently working through the same local build + F-Droid reproducibility problem. Copy from it directly:
- `lib/settings.ts` — pub/sub + AsyncStorage for local state (no Redux/Zustand)
- `gradle.properties` JVM args
- `pnpm-workspace.yaml` monorepo setup
- `fdroidserver` config + metadata format

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
