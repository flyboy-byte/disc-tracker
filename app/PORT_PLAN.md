# Disc Tracker — Mobile Port Plan

> Phased implementation plan. Each phase is independently completable and testable.
> The website is the spec — do not change disc suggestion behavior, flight model, or
> stability logic unless a bug is proven and explicitly marked as a fix.
>
> Hard constraints throughout:
> - Do not rewrite the physics model (port it as `legacyPhysics.ts`, improve separately)
> - Do not invent new formulas or change flight number interpretation
> - Do not add cloud backup, analytics, Firebase, Sentry, OAuth, or ads
> - Do not make the app depend on the Flask server
> - Local-only v1. Single-user UX. Android-first.

---

## Phase 0 — Parity Test Fixtures

> Before writing any app code, define known-good input/output pairs from the **running website**.
> These are the acceptance criteria that prove the mobile port matches website behavior.

Run each test case on the website, capture the exact output, record it here.

### 0A — Stability Classification Fixtures

| Disc | Speed | Glide | Turn | Fade | Net (fade+turn) | Expected label |
|------|-------|-------|------|------|-----------------|----------------|
| Aviar | 2 | 3 | 0 | 1 | +1 | OS |
| Leopard3 | 7 | 5 | -2 | 1 | -1 | ST (boundary) |
| Destroyer | 12 | 5 | -1 | 3 | +2 | OS |
| Sonic (putter) | 2 | 1 | 0 | 4 | +4 | OS |
| Roadrunner | 9 | 5 | -4 | 1 | -3 | US |
| Buzz | 5 | 4 | -1 | 2 | +1 | OS |
| River | 7 | 7 | -1 | 1 | 0 | ST |

**Expected formula:** `stability = fade + turn`. OS ≥ 1, US ≤ -1, ST in between.

### 0B — Distance Estimate Fixtures

Test `estimateDist()` with known inputs. Capture from the website's distance bar.

| Disc (speed) | Arm% | Wind | Glide | Nose° | Hyzer° | Expected dist (ft) |
|-------------|------|------|-------|-------|--------|-------------------|
| Aviar (spd 2) | 100 | 0 | 3 | 0 | 0 | ~130 |
| Leopard3 (spd 7) | 100 | 0 | 5 | 0 | 0 | ~255 |
| Destroyer (spd 12) | 100 | 0 | 5 | 0 | 0 | ~380 |
| Destroyer (spd 12) | 50 | 0 | 5 | 0 | 0 | ~190 |
| Destroyer (spd 12) | 100 | +15 | 5 | 0 | 0 | ~334 (headwind −12%) |
| Destroyer (spd 12) | 100 | 0 | 5 | +10 | 0 | ~323 (nose up −15%) |
| Destroyer (spd 12) | 100 | 0 | 5 | 0 | +30 | ~342 (hyzer −18%) |

**Formula to verify:** `baseFt*(arm/100)*(0.85+glide*0.03)*(1-wind*0.008)*(noseFactor)*(hyzerFactor)`

### 0C — Arc Path Shape Fixtures

Not exact SVG strings — shape class labels. Set up each throw on the website and record the stability badge shown on the adjusted disc.

| Disc | Arm% | Hyzer° | Nose° | Wind | Spin% | Expected adjusted stability |
|------|------|--------|-------|------|-------|----------------------------|
| Destroyer (12/5/-1/3) | 100 | 0 | 0 | 0 | 100 | OS (net +2) |
| Destroyer (12/5/-1/3) | 40 | 0 | 0 | 0 | 100 | More OS (underpowered) |
| Roadrunner (9/5/-4/1) | 100 | 0 | 0 | 0 | 100 | US (net -3) |
| Roadrunner (9/5/-4/1) | 100 | +20 | 0 | 0 | 100 | Less US (hyzer counters turn) |
| Roadrunner (9/5/-4/1) | 100 | 0 | 0 | +15 | 100 | More US (headwind reveals turn) |
| Leopard3 (7/5/-2/1) | 100 | 0 | 0 | 0 | 30 | More US (low spin → less gyro) |

### 0D — Scenario Filter Fixtures

For each scenario, record which of these 5 discs appear in bag results:

Test discs:
- **A:** Aviar (2/3/0/1) — net +1, Putt & Approach
- **B:** Buzz (5/4/-1/2) — net +1, Mid Range
- **C:** Leopard3 (7/5/-2/1) — net -1, Control Driver
- **D:** Destroyer (12/5/-1/3) — net +2, Distance Driver
- **E:** Roadrunner (9/5/-4/1) — net -3, Distance Driver

| Scenario | Expect A | Expect B | Expect C | Expect D | Expect E |
|----------|----------|----------|----------|----------|----------|
| Dead Straight | ❌ (speed<4? No, spd=2<4) | ✅ | ✅ (net=-1 boundary) | ❌ net>1 | ❌ net<-1 |
| Reliable Hyzer | ❌ fade=1 | ❌ fade=2 | ❌ fade=1 | ✅ fade=3,turn≥-1 | ❌ turn=-4 |
| Max Distance | ❌ spd<11 | ❌ spd<11 | ❌ spd<11 | ✅ spd≥11,fade≤3,turn≤-0.5 | ❌ spd<11? No, spd=9<11 |
| Tailwind | ❌ spd<9 | ❌ spd<9 | ❌ spd<9 | ❌ turn=-1 not ≤-1 | ✅ spd≥9,turn≤-1,net≤0 |
| Turnover | ❌ | ❌ | ❌ turn=-2 but net=-1 OK? Check: turn≤-2 ✅ fade≤2 ✅ net≤-1 ✅ | ❌ | ✅ turn=-4,fade=1,net=-3 |
| Roller | ❌ | ❌ | ❌ turn=-2 not ≤-3 | ❌ | ✅ turn=-4,fade=1≤1 |

> Verify these against the running website. Correct any wrong cells above before porting.

---

## Phase 1 — Expo Scaffold

**Goal:** Blank Expo project with navigation, theme, and bundled assets. No business logic yet.

```bash
cd /home/ubuntu/disc_tracker
npx create-expo-app app --template blank-typescript
cd app
npx expo install expo-sqlite expo-router react-native-svg \
  @react-native-community/slider react-native-gesture-handler \
  react-native-reanimated react-native-draggable-flatlist \
  expo-file-system expo-sharing expo-document-picker
cp ../static/discs_master.json assets/

# Run prebuild immediately and commit the output — don't gitignore android/
npx expo prebuild --platform android --clean
git add android/
```

**Deliverables:**
- `app.json` with `slug`, `android.package = "com.disctracker.app"`, SDK 54+
- `eas.json` with `preview` (APK) and `production` (AAB) profiles
- `android/gradle.properties` with `-Xmx4g -XX:MaxMetaspaceSize=1g` JVM args (add before first build)
- `src/theme.ts` with all color constants matching web CSS vars
- Bottom tab navigator: Bag / Flight Shaper / Disc Suggest
- `npx expo start` runs without errors

**Do not yet:** write any disc logic, DB calls, or screen content.

---

## Phase 2 — Port Pure Utility Functions

**Goal:** All pure logic functions in TypeScript, tested against Phase 0 fixtures.

Files to create:
- `src/utils/disc.ts` — `stab()`, `stabClass()`, `stabShort()`, `bagToDisc()`, `typeShort()`
- `src/utils/legacyPhysics.ts` — `MOD`, `applyModifiers()`, `arcPoints()`, `estimateDist()` (exact port, no changes)
- `src/utils/scenarios.ts` — `SCENARIOS` array, `filterBag()`, `filterLibrary()`
- `src/utils/csv.ts` — `exportCSV()`, `importCSV()`

**Verification:** Write TypeScript unit tests (Jest or Vitest) that take the Phase 0 fixture inputs and assert the expected outputs. These tests must pass before moving to Phase 3.

```typescript
// Example parity test
it('Destroyer stability is OS', () => {
  expect(stab({ turn: -1, fade: 3 })).toBe('overstable');
  expect(stabShort(2)).toBe('OS');
});

it('estimateDist Destroyer full power calm', () => {
  const d = { speed: 12, glide: 5 };
  expect(estimateDist(d, 100, 0, 5, 0, 0)).toBe(380);
});

it('Roadrunner matches Tailwind scenario', () => {
  const roadrunner = { speed: 9, glide: 5, turn: -4, fade: 1 };
  const sc = SCENARIOS.find(s => s.id === 'tailwind');
  expect(sc.bagTest(roadrunner)).toBe(true);
});
```

**Do not yet:** connect to any screen or database.

---

## Phase 3 — SQLite Schema and CRUD

**Goal:** Database layer identical to Flask backend behavior.

**Package:** `expo-sqlite` v14+ (built into Expo SDK 54) — native async/await, no community package needed.

Files: `src/db/db.ts` + `src/db/migrations.ts`

```typescript
// db.ts — must run on every connection:
db.execAsync('PRAGMA foreign_keys = ON');

// Functions to implement:
openDatabase(): Promise<void>         // run migrations, set PRAGMA
getOrCreateDefaultUser(): Promise<number>   // v1: auto-create "My Bag" user
getDiscs(userId: number): Promise<Disc[]>
saveDiscs(userId: number, discs: Disc[]): Promise<void>   // bulk replace (same as POST /api/data)
getMeta(userId: number): Promise<UserMeta>
setMeta(userId: number, updates: Partial<UserMeta>): Promise<void>
```

**Migration pattern:** All schema versions live in `migrations.ts`, applied in sequence on app launch. Version the schema — don't just rely on `CREATE IF NOT EXISTS`. Same logic as Flask's `init_db()`: base tables first, then `ALTER TABLE ADD COLUMN` for `color` and `arc_view`, each wrapped in try/catch.

**Verification:** Write a test that:
1. Opens DB
2. Creates default user
3. Saves 3 discs
4. Reads them back
5. Deletes user — confirms discs are gone (CASCADE working via PRAGMA)

---

## Phase 4 — Bag Screen

**Goal:** Full disc bag view matching `index.html` behavior.

**Features in priority order:**
1. Display disc list (cards with stability chip, flight numbers, color swatch)
2. Add disc from master library search
3. Edit disc (all fields)
4. Delete disc (confirm)
5. Sort modes (speed-desc, speed-asc, name, mfr, custom)
6. Drag-reorder (`react-native-draggable-flatlist`)
7. Search / filter by stability class or disc type
8. Color picker
9. CSV export
10. CSV import

**Web behavior to match:**
- Card shows: mfr, mold, plastic, weight, speed/glide/turn/fade, use_desc, notes, color, stability chip
- Stability chip: OS (purple), ST (green), US (amber) — using `stabClass()` / `stabShort()`
- Sort persisted to `user_meta.sort_mode`
- Custom sort order persisted to `discs.sort_order`

**Skip for v1:** Welcome modal (one-time tooltip shown to new users).

---

## Phase 5 — Flight Shape Screen

**Goal:** Flight simulator matching `flightshape.html` behavior.

**Features:**
1. Disc picker (from bag + manual number entry)
2. 5 sliders: hyzer (-30°..+30°), nose (-20°..+20°), wind (-20..+20), arm (0–100%), spin (0–100%)
3. Arc SVG redraws on every slider change
4. Ghost arc shown when sliders deviate from default
5. Adjusted stability badge + flight numbers
6. Distance estimate bar
7. arcView selector (RHBH/RHFH/LHBH/LHFH) — persisted to `user_meta.arc_view`
8. Hyzer reference diagram (X-shaped SVG with disc silhouettes)
9. Side-view and back-view angle diagrams
10. Reset button

**Key mapping decisions:**
- Horizontal `<input type="range">` → `@react-native-community/slider` (horizontal, default)
- Vertical sliders → Custom `VerticalSlider.tsx` using **Reanimated 4 + `useSharedValue`** — gives 60fps arc update on-device without threading headaches (smoother than canvas-based web approach)
- `arcPoints()` output → `<Svg>` + `<Path>` in `react-native-svg`
- `drawArc()` → `ArcSvg.tsx` component that takes adjusted disc + sliders, renders SVG

**Parity check:** Load Destroyer (12/5/-1/3) at 100%/0°/0°/calm/100%. Arc should show slight right turn then firm left fade. Distance bar ~380ft.

---

## Phase 6 — Disc Suggest Screen

**Goal:** Scenario recommendation matching `discsuggestion.html` behavior.

**Features:**
1. 12-scenario grid (2 columns mobile → 3 → 6 at wider widths)
2. Tap scenario → show bag matches + library matches
3. Bag matches: "In your bag" highlighted cards
4. Library matches: top 15 sorted by proximity to scenario midpoint stability, deduplicated against bag
5. Stability chip + stability bar on each card

**Master library:** Loaded from `assets/discs_master.json` via `require()` — no network call.

**Parity check:** Select "Roller" scenario. Only discs with `turn <= -3` and `fade <= 1` should appear in bag results.

---

## Phase 7 — Import / Export

**Goal:** CSV round-trip matches web behavior.

**Export fields (in order):** `mfr, mold, plastic, weight, speed, glide, turn, fade, use, thr, notes, color`

**Import behavior:**
- Parse header row to find column positions (order-agnostic)
- Strip leading `#` from color if present
- Assign new `disc_id` values (from `user_meta.next_id`)
- Append to current bag (do not clear existing discs)

**Mobile implementation:**
- Export: `expo-file-system` write temp file → `expo-sharing` share sheet
- Import: `expo-document-picker` pick `.csv` → read text → parse → insert into SQLite

**Parity check:** Export bag from web app, import CSV into mobile app. All discs appear with correct fields.

---

## Phase 8 — Android Build and Smoke Test

**Goal:** Real APK installed on a physical Android device, all screens verified.

```bash
eas build --platform android --profile preview
# Download APK from EAS dashboard → install via adb or direct download
```

**Smoke test checklist:**
- [ ] App opens cold — no crash
- [ ] Default user auto-created on first launch
- [ ] Bag screen loads empty bag
- [ ] Add a Destroyer from library search
- [ ] Stability chip shows OS (purple)
- [ ] Flight Shape: select Destroyer → arc visible → move hyzer slider → arc updates
- [ ] Distance bar shows ~380ft at 100% arm, flat, calm
- [ ] Disc Suggest: tap "Max Distance" → Destroyer appears in bag results
- [ ] Tap "Roller" → Destroyer does NOT appear (fade=3, not ≤1)
- [ ] Export CSV → share sheet appears with file
- [ ] Kill app → reopen → Destroyer still in bag (SQLite persistence confirmed)
- [ ] Play target SDK check: `aapt dump badging app.apk | grep sdkVersion` → `targetSdkVersion='35'`

---

## Scope Boundaries for v1

Keep v1 focused — these can be revisited after shipping:

| Defer to later | Notes |
|----------------|-------|
| Cloud backup | v1.1 — don't let it block shipping |
| Physics V2 (`physicsV2.ts`) | Build alongside, switch when validated against real throw data |
| Multi-user picker screen | Schema supports it; UI can wait |
| User login / OAuth | Not needed — local-only |
| Third-party analytics | Not planned |

**Technical musts** (these will cause real problems if skipped):
- `PRAGMA foreign_keys = ON` on every SQLite connection — or CASCADE deletes silently fail
- Target API 35 — Play Store requirement as of Aug 31 2025; Expo SDK 52+ handles it
- EAS dev build (not Expo Go) once any native module is added (e.g. `react-native-quick-crypto` in v1.1)
- Port `applyModifiers()` and `arcPoints()` exactly — improve via `physicsV2.ts`, not by editing the port

---

## Physics V2 (Parallel Track — Not Blocking v1)

Build `physicsV2.ts` alongside the port, but do not switch the Flight Shape screen to V2 until:
1. `simulateFlight()` passes all Phase 0C arc shape fixtures
2. At least 10 real throw data points have been collected and used to tune `DEFAULT_FLIGHT_TUNING`
3. User explicitly approves the switch

See `RESEARCH.md` Section 7 for full V2 architecture and real-throw data collection format.
