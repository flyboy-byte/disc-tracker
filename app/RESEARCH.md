# Disc Tracker — Android App Research

> Living reference document. Bring feedback from external AI audits back here and update as decisions solidify. Not an immediate build plan — a foundation to build from when ready.

---

## 1. Framework Research

### Three Serious Options

#### Option A: Expo (React Native) + EAS ✅ Chosen
- Language: **TypeScript** — direct port from existing vanilla JS
- Build/distribution: **Expo EAS** (prior shipped experience)
- Cross-platform: Android + iOS from one codebase
- All existing physics logic (`applyModifiers`, `estimateDist`, scenario filters) is pure JS — copy-paste with type annotations
- SVG arc: `react-native-svg` uses same SVG element API (`<Svg>`, `<Path>`, `<Circle>`)
- Vertical sliders: custom `PanResponder`-based component (RN has no native vertical slider)
- Drag-reorder: `react-native-draggable-flatlist` (MIT licensed)
- Storage: `expo-sqlite` — same SQLite API as Flask backend

**Pros:** fastest path, no new language, iOS-ready, proven EAS pipeline  
**Cons:** React Native "paper cuts" (bridge overhead, occasional native module issues), JS thread model

#### Option B: Flutter
- Language: **Dart** — new language, similar to TypeScript but different paradigm
- Cross-platform: Android + iOS (also web/desktop)
- Strong type system, hot reload, excellent performance
- SVG: `CustomPainter` API — different mental model from SVG, requires rewriting arc math
- SQLite: `sqflite` package (well maintained)
- Build: `flutter build apk` / `flutter build ipa`; Codemagic or GitHub Actions for CI

**Pros:** better performance, cohesive widget system, strong iOS support, growing ecosystem  
**Cons:** full Dart rewrite (all JS logic must be reimplemented), new language learning curve, no EAS familiarity

#### Option C: Native Android (Android Studio)
- Language: **Kotlin** (or Java)
- Android-only — no iOS path without a full separate rewrite in Swift
- Best raw performance and deepest Android integration
- SQLite via Android Room (ORM) or raw `SQLiteOpenHelper`

**Pros:** best Android performance, full OS API access  
**Cons:** no iOS path, completely different language and toolchain, largest rewrite effort

### Decision: Expo EAS

Given: prior EAS success, all logic is JS, iOS optionality wanted, and the app is not performance-critical (UI + SVG, no 3D/game-loop), **Expo EAS is the right call**. If the app grows and performance becomes an issue, migrating the inner rendering to a `react-native-skia` canvas is possible without switching frameworks.

---

## 2. Data Architecture Research

### The Core Problem

The Flask app is a localhost server — it can't serve a phone directly. Two architectural paths:

#### Path A: LAN Bridge (least work, most fragile)
- Phone calls Flask API over local WiFi (`http://192.168.x.x:5757/api/data`)
- No porting needed — app is essentially a mobile browser
- **Problems:** phone must be on same WiFi; server must be running; doesn't work anywhere else; not a real app

#### Path B: Local-First SQLite on Device ✅ Recommended
- `expo-sqlite` holds all user data on the device
- App runs fully offline, forever, with no server dependency
- Schema is identical to Flask — 3 tables, same column names
- `discs_master.json` (233 KB) bundled as a static asset via `require()`
- On first launch, run migrations (same pattern as Flask's `init_db()`)

**This is the correct architecture.** Local-first is both the privacy-correct choice and the UX-correct choice.

#### Path C: VPS Encrypted Backup (opt-in layer on top of Path B)
- Adds cloud backup without compromising privacy
- See Section 4 for full encryption design

### SQLite Schema Port (identical to Flask)

```sql
CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS discs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  disc_id    TEXT,
  mfr        TEXT,
  mold       TEXT,
  plastic    TEXT,
  weight     REAL,
  speed      REAL,
  glide      REAL,
  turn       REAL,
  fade       REAL,
  use_desc   TEXT,
  thr        TEXT,
  notes      TEXT,
  color      TEXT,
  sort_order INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_meta (
  user_id   INTEGER PRIMARY KEY,
  next_id   INTEGER DEFAULT 1,
  sort_mode TEXT DEFAULT 'custom',
  arc_view  TEXT DEFAULT 'RHBH'
);
```

No schema changes needed. The port is 1:1.

---

## 3. FOSS & MIT Licensing

### Why MIT

MIT is the most permissive common FOSS license:
- Anyone can read, fork, audit, modify, or self-host
- No copyleft restriction (unlike GPL, which would require derivative apps to also be open source)
- Compatible with the App Store and Play Store (both accept MIT-licensed apps)
- Every dependency must also be MIT/BSD/Apache-2/ISC compatible

### What MIT Licensing Does for Privacy Claims

Open source is verifiable privacy. A claim like "we don't track you" is just marketing in a closed-source app. In an MIT-licensed app:
- Anyone can audit the source and confirm no analytics SDK is imported
- `package.json` is public — no hidden Mixpanel, Firebase Analytics, Amplitude, etc.
- The encryption implementation in `crypto.ts` can be independently reviewed
- This is a meaningful, auditable distinction

### Dependency License Audit

Run before every EAS production build:

```bash
npx license-checker --onlyAllow 'MIT;BSD-2-Clause;BSD-3-Clause;Apache-2.0;ISC;0BSD'
```

Key packages and their licenses:

| Package | License |
|---------|---------|
| expo-sqlite | MIT |
| expo-router | MIT |
| react-native-svg | MIT |
| react-native-draggable-flatlist | MIT |
| @react-native-community/slider | MIT |
| react-native-quick-crypto | MIT |
| react, react-native | MIT |

### NOTICE File

MIT requires preserving copyright notices in distributions:

```bash
npx license-checker --out NOTICE --customPath licenseFormat.json
```

---

## 4. Privacy & Encryption Design

### Privacy Principles

1. **Local by default.** No network call ever happens without explicit user opt-in.
2. **No analytics.** No crash reporter, no usage tracking, no A/B testing SDK.
3. **No account required.** No email, no phone number, no OAuth sign-in.
4. **Encryption before upload.** Cloud backup encrypts locally — the server never sees the key.
5. **Deletable.** User can delete all data (local + VPS) from within the app.

### Encryption Implementation (opt-in VPS backup only)

Uses well-understood, audited primitives — no homebrew crypto:

**Key Derivation:**
```
passphrase (user-entered)
  → PBKDF2-SHA256 (100,000 iterations, 16-byte random salt)
  → 256-bit AES key
```
Salt is stored locally on-device. Key is never stored anywhere — re-derived on each backup/restore from passphrase.

**Encryption:**
```
disc data JSON string
  → AES-256-GCM (12-byte random nonce/IV)
  → { ciphertext, iv, salt } — all base64-encoded
```
AES-GCM provides both confidentiality and integrity (authentication tag detects tampering).

**What the VPS receives and stores:**
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "blob": "base64_ciphertext...",
  "iv": "base64_12_bytes",
  "salt": "base64_16_bytes",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

The VPS operator — even with full database access — sees only an opaque encrypted blob. Cannot determine how many discs exist, what they are named, or who the user is.

**Library:** `react-native-quick-crypto` — native OpenSSL bindings, MIT licensed, standard in the React Native ecosystem. Provides `pbkdf2Sync`, `randomBytes`, `createCipheriv`/`createDecipheriv`.

### VPS Backup Endpoints (additions to app.py)

```python
# New table
CREATE TABLE backups (
  token      TEXT PRIMARY KEY,   -- random UUID, generated on device
  blob       TEXT NOT NULL,      -- AES-256-GCM ciphertext (base64)
  iv         TEXT NOT NULL,      -- 12-byte nonce (base64)
  salt       TEXT NOT NULL,      -- PBKDF2 salt (base64)
  updated_at TEXT NOT NULL
);

# Three endpoints
POST   /api/backup          # upsert encrypted blob
GET    /api/backup/<token>  # retrieve for restore
DELETE /api/backup/<token>  # wipe on account delete
```

No authentication beyond the UUID token (secret to the device). Rate-limited server-side.

### Privacy Claim Audit Table

| Claim | Truthful? | Evidence in code |
|-------|-----------|-----------------|
| "We cannot read your data" | ✅ | Server receives ciphertext only; key never leaves device |
| "No tracking or analytics" | ✅ | No analytics SDK in package.json (auditable) |
| "Data is yours" | ✅ | MIT license + local-first; delete wipes VPS blob |
| "Encrypted in transit" | ✅ | HTTPS + AES-256-GCM before upload |

---

## 5. Google Play Store Compliance

### Data Safety Form (enforced since 2022)

Inaccurate declarations can result in app removal. Our accurate answers:

| Data Type | Collected? | Shared? | Notes |
|-----------|-----------|---------|-------|
| Name | No | No | Username is device-local only |
| Email / phone | No | No | No account system |
| Location | No | No | — |
| Device or other IDs | No | No | No advertising ID accessed |
| App activity / interaction | No | No | No analytics |
| Crash logs | No | No | No crash reporter SDK |
| Personal disc data | Yes (local) | No | Stored only on device |
| Backup data | Optional | No | Encrypted blob to user's own VPS if opted in |

**For a local-only v1 (no backup):** Data Safety = "No data collected or shared." Cleanest possible Play Store submission.

**For v1 with backup:** Declare optional encrypted backup + provide privacy policy URL.

### Privacy Policy Requirements

Google requires a privacy policy URL even for apps that collect no data. Must be:
- Accessible from within the app (Settings → Privacy Policy link)
- Hosted at a stable URL (GitHub Pages works)
- Plain language (no legal boilerplate required)

**Minimum content for local-only app:**
1. What data the app stores (local SQLite — disc data, username, preferences)
2. Where it's stored (on your device only)
3. What is NOT collected (no analytics, no ads, no tracking)
4. Contact for questions
5. If backup added: what the encrypted backup contains and that the server cannot decrypt it

### Target API Level

Play Store requires `targetSdkVersion >= 34` (Android 14) for new apps. Expo SDK 51+ sets this correctly by default. Verify in `android/build.gradle` before building.

### App Content Declarations

| Field | Value |
|-------|-------|
| Category | Sports |
| Content rating | Everyone (IARC questionnaire) |
| Target audience | All ages |

### App Signing

Use **Google Play App Signing** — EAS manages the upload key, Google holds the final signing key. Required for Play Store, enables key recovery if upload key is lost.

---

## 6. Logic Port Map (Web → Native)

All core logic is pure functions with zero DOM dependencies — direct copy with TypeScript types added:

| Function(s) | Web source | Native destination |
|------------|-----------|-------------------|
| `stab()`, `stabClass()`, `stabShort()` | `discsuggestion.html` | `src/utils/disc.ts` |
| `bagToDisc()` stability formula | `discsuggestion.html` | `src/utils/disc.ts` |
| All 12 scenario objects + `bagTest` filters | `discsuggestion.html` | `src/utils/scenarios.ts` |
| `applyModifiers()` | `flightshape.html` | `src/utils/physics.ts` |
| `estimateDist()` | `flightshape.html` | `src/utils/physics.ts` |
| Arc path math (Bézier control points) | `flightshape.html` | `src/components/ArcSvg.tsx` |
| CSV import/export | `index.html` | `src/utils/disc.ts` |

The arc SVG uses `<Svg>`, `<Path>`, `<Circle>` from `react-native-svg` — same element names and props as web SVG. The path `d` attribute string works unchanged.

---

## 7. iOS Path Research

When the app goes to iOS, the Expo codebase supports it with minimal changes:

- **EAS Build:** `eas build --platform ios` — requires Apple Developer account ($99/yr)
- **App Store Review:** 1–3 days review time (stricter than Google Play)
- **Simulator testing:** `npx expo run:ios` requires macOS with Xcode
- **App Privacy labels:** Same honest declarations apply (Apple's equivalent of Data Safety)
- **`expo-sqlite`:** Works identically on iOS
- **`react-native-quick-crypto`:** Works on iOS (OpenSSL bindings)
- **No code changes needed** for core app — iOS and Android share 100% of source

The only iOS-specific work: App Store screenshots, description, and Apple Developer enrollment.

---

## 8. Screen Map

| Web Page | Native Screen | Route |
|----------|--------------|-------|
| `pick.html` | UserPickerScreen | `/` |
| `index.html` | BagScreen | `/bag` |
| `flightshape.html` | FlightShapeScreen | `/flightshape` |
| `discsuggestion.html` | DiscSuggestScreen | `/suggest` |

Bottom tab navigator for Bag / Flight Shape / Disc Suggest once user is picked.

---

## 9. Web → Native API Mapping

| Web | Native |
|-----|--------|
| CSS variables (`--accent`) | `src/theme.ts` constants |
| `<input type="color">` | Color picker modal or wheel |
| `<input type="range">` (horizontal) | `@react-native-community/slider` |
| Vertical sliders (CSS transform) | Custom `PanResponder` vertical slider |
| `localStorage` | `AsyncStorage` or SQLite `user_meta` |
| `fetch('/api/data')` | Direct `expo-sqlite` calls |
| `<svg>` arc | `react-native-svg` `<Svg><Path>` |
| Drag reorder (mouse/touch events) | `react-native-draggable-flatlist` |
| `document.getElementById` | React refs / state |

---

## 10. Package List (all MIT licensed)

| Package | Purpose |
|---------|---------|
| `expo` | Core SDK |
| `expo-router` | File-based navigation |
| `expo-sqlite` | Local database |
| `react-native-svg` | Arc flight shape SVG |
| `react-native-draggable-flatlist` | Drag-reorder disc bag |
| `@react-native-community/slider` | Sliders (arm, spin, wind, etc.) |
| `react-native-quick-crypto` | Encryption for opt-in backup |
| `react-native-gesture-handler` | Touch gesture primitives |
| `react-native-reanimated` | Smooth animations |
| `expo-file-system` | CSV export to device storage |
| `expo-sharing` | Share/export CSV file |

---

## 11. Project File Structure

```
disc_tracker/
├── LICENSE                          ← MIT (covers everything)
├── app.py                           ← Flask backend (unchanged)
├── templates/                       ← Web app (unchanged)
├── static/
│   └── discs_master.json            ← Master library (233 KB)
└── app/                             ← Expo project root
    ├── LICENSE                      ← MIT
    ├── RESEARCH.md                  ← This document
    ├── app.json                     ← Expo config
    ├── eas.json                     ← EAS build profiles
    ├── package.json
    ├── tsconfig.json
    ├── assets/
    │   ├── icon.png
    │   ├── splash.png
    │   └── discs_master.json        ← Bundled copy of master library
    └── src/
        ├── theme.ts                 ← Color constants (CSS vars → JS)
        ├── db/
        │   └── db.ts                ← expo-sqlite CRUD layer
        ├── utils/
        │   ├── disc.ts              ← stab(), stabClass(), CSV
        │   ├── physics.ts           ← applyModifiers(), estimateDist()
        │   ├── scenarios.ts         ← 12 disc suggest scenarios
        │   └── crypto.ts            ← PBKDF2 + AES-256-GCM (backup only)
        ├── screens/
        │   ├── UserPickerScreen.tsx
        │   ├── BagScreen.tsx
        │   ├── FlightShapeScreen.tsx
        │   └── DiscSuggestScreen.tsx
        └── components/
            ├── DiscCard.tsx
            ├── ArcSvg.tsx
            ├── VerticalSlider.tsx
            └── StabilityChip.tsx
```

---

## 12. Open Questions (resolve before building)

1. **Backup in v1 or v1.1?** Shipping without backup keeps the Data Safety form at "no data collected" — cleanest Play Store submission. Recommended: ship v1 local-only, add encrypted backup in v1.1.

2. **Multi-user or single-user on mobile?** Web app supports multiple users (household use). On mobile, single-user + device-local is more natural UX. Simplify to single-user for v1?

3. **App name / Play Store slug?** `com.disctracker.app` as package name — check availability in Play Console before building.

4. **Self-hosted VPS backup vs third-party?** Current plan uses the existing VPS. Alternative: Cloudflare R2 or Supabase for encrypted blob storage (simpler ops, same privacy since blobs are encrypted before upload).

5. **Offline disc library updates?** `discs_master.json` is bundled — new discs require an app update. Alternative: fetch a versioned JSON from the VPS on launch (no personal data, purely additive).

6. **Crash reporting?** Adding Sentry (self-hosted) would catch crashes without sending data to third parties. Or ship with none and rely on Play Console's built-in ANR/crash reports.

---

## 13. EAS Build Quick Reference

```bash
# Initial setup (once)
npm install -g eas-cli
eas login
eas build:configure

# Development build (for device testing via Expo Go)
npx expo start

# Preview APK (sideload for testing, no Play Store)
eas build --platform android --profile preview

# Production AAB (Play Store upload)
eas build --platform android --profile production

# iOS (when ready, requires Apple Developer account)
eas build --platform ios --profile production
```

### `eas.json` profiles
```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

---

## 14. Implementation Phases (when ready)

### Phase 1 — Scaffold + Data Layer (~2 hrs)
1. `npx create-expo-app app --template blank-typescript` inside `disc_tracker/`
2. Install all packages from Section 10
3. Write `src/db/db.ts` with schema + CRUD
4. Write `src/utils/disc.ts`, `physics.ts`, `scenarios.ts` (JS ports)
5. Copy `static/discs_master.json` → `app/assets/`
6. Write `src/theme.ts` (CSS vars → constants)

### Phase 2 — Screens (~4–6 hrs)
1. `UserPickerScreen` — user list, add, delete (confirm tap)
2. `BagScreen` — disc cards, drag-reorder, add/edit modal, stability chips
3. `FlightShapeScreen` — disc picker, 5 sliders, SVG arc, distance bar
4. `DiscSuggestScreen` — scenario grid, filtered results (bag + library)

### Phase 3 — Backup Feature (~1–2 hrs, v1.1)
1. Settings screen: enable backup toggle + passphrase input
2. `src/utils/crypto.ts`: PBKDF2 key derive + AES-256-GCM encrypt/decrypt
3. VPS: add 3 backup endpoints to `app.py`
4. Sync on app foreground + manual "backup now" button

### Phase 4 — Play Store Prep (~1 hr)
1. `eas build --platform android --profile preview` → APK → smoke test on device
2. Write privacy policy (plain English, host on GitHub Pages)
3. Fill Data Safety form accurately
4. `eas build --platform android --profile production` → AAB → upload to Play Console
