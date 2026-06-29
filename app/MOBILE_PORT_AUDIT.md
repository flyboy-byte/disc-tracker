# Mobile Port Audit — Disc Tracker Website → Expo App

> The website is the spec. The mobile app is a port, not a redesign.
> This document maps every feature, function, and data structure in the current website
> so the port has a verified source of truth before any React Native code is written.

---

## 1. Repo File Tree (relevant to port)

```
disc_tracker/
├── app.py                        301 lines — Flask routes + SQLite schema
├── static/
│   └── discs_master.json         233 KB — 1,660+ disc library
└── templates/
    ├── pick.html                 147 lines — user picker
    ├── index.html               1151 lines — bag view (main screen)
    ├── flightshape.html          830 lines — flight physics simulator
    └── discsuggestion.html       506 lines — disc scenario suggestions
```

---

## 2. Screen / Page Inventory

| Screen | Template | Lines | Purpose |
|--------|----------|-------|---------|
| User Picker | `pick.html` | 147 | Create/select/delete user profiles |
| Bag View | `index.html` | 1151 | Main disc bag — add, edit, delete, sort, search discs |
| Flight Shaper | `flightshape.html` | 830 | Interactive flight path simulator with 5 physics sliders |
| Disc Suggest | `discsuggestion.html` | 506 | Scenario-based disc recommendations from bag + library |

---

## 3. Feature → File Ownership

| Feature | File | Notes |
|---------|------|-------|
| User create/select/delete | `pick.html` + `app.py` | HTML form POSTs; Flask handles |
| Disc bag (CRUD) | `index.html` | All client-side; synced to server via `/api/data` |
| Drag-reorder | `index.html` | Custom touch/mouse drag events |
| Disc search / filter | `index.html` | Client-side filter on in-memory disc array |
| Stability labels (bag) | `index.html` | `stab()` function, `STAB_META` object |
| Color picker | `index.html` | `<input type="color">` |
| CSV import/export | `index.html` | JS FileReader + Blob download |
| Field arc view | `index.html` | SVG top-down arc overlay |
| Welcome modal | `index.html` | `localStorage` key `disc_welcome_v1` |
| Flight shape arc | `flightshape.html` | `arcPoints()` + `drawArc()` |
| Physics sliders | `flightshape.html` | 5 `<input type="range">` sliders |
| Modifier math | `flightshape.html` | `applyModifiers()` with `MOD` constants |
| Distance estimate | `flightshape.html` | `estimateDist()` |
| Angle reference diagram | `flightshape.html` | SVG back/side view of disc angle |
| Scenario grid | `discsuggestion.html` | 12 cards, click to filter |
| Bag filter | `discsuggestion.html` | `filterBag()` + per-scenario `bagTest()` |
| Library filter | `discsuggestion.html` | `filterLibrary()` against master JSON |
| Stability bar | `discsuggestion.html` | `stabBar()` — visual bar with zero marker |
| Master disc library | `app.py` `/api/master` | Serves `static/discs_master.json` cached |

---

## 4. Pure Logic Functions (port directly to TypeScript)

These functions have **zero DOM or browser dependencies** — pure inputs → pure outputs.

### `disc.ts`

| Function | Source | Signature |
|----------|--------|-----------|
| `stab(d)` | `index.html`, `flightshape.html` | `(d: {turn,fade}) → 'overstable' \| 'stable' \| 'understable'` |
| `stabClass(stab)` | `discsuggestion.html` | `(stab: number) → 'stab-os' \| 'stab-st' \| 'stab-us'` |
| `stabShort(stab)` | `discsuggestion.html` | `(stab: number) → 'OS' \| 'ST' \| 'US'` |
| `bagToDisc(d)` | `discsuggestion.html` | Converts bag disc to library-compatible shape, computes stability |
| `typeShort(type)` | `discsuggestion.html` | Maps disc type string to short label |
| `esc(s)` | all templates | HTML-escape string — in RN, not needed (JSX escapes by default) |

### `scenarios.ts`

| Export | Source | Notes |
|--------|--------|-------|
| `SCENARIOS` array | `discsuggestion.html` | All 12 scenario objects with `bagTest`, `stabMin/Max`, `types`, `speedMin` |
| `filterBag(sc, bagDiscs)` | `discsuggestion.html` | Returns bag discs matching `sc.bagTest` |
| `filterLibrary(sc, allDiscs)` | `discsuggestion.html` | Filters + sorts by proximity to scenario midpoint, slices top 15 |

### `legacyPhysics.ts` (preserved exactly — do not alter)

| Function | Source | Signature |
|----------|--------|-----------|
| `applyModifiers(base, sliders)` | `flightshape.html` | Applies MOD constants to produce adjusted turn/fade |
| `arcPoints(d, W, H)` | `flightshape.html` | Computes Bézier control points for flight arc SVG |
| `estimateDist(base, armSpeed, wind, glide, nose, hyzer)` | `flightshape.html` | Returns estimated distance in feet |
| `MOD` constants object | `flightshape.html` | 10 modifier coefficients (hyzer/pitch/wind/arm/spin × turn/fade) |

---

## 5. DOM / Browser Code That Must Be Rewritten for React Native

| Web API | Used in | React Native replacement |
|---------|---------|--------------------------|
| `document.getElementById` | all templates | React state + refs |
| `<input type="range">` (horizontal) | `flightshape.html` | `@react-native-community/slider` |
| Vertical sliders (CSS `rotate(-90deg)`) | `flightshape.html` | Custom `PanResponder` vertical slider |
| `<input type="color">` | `index.html` | Color picker modal |
| `<svg>` inline SVG | `flightshape.html`, `index.html` | `react-native-svg` `<Svg>`, `<Path>`, etc. |
| Mouse/touch drag events (reorder) | `index.html` | `react-native-draggable-flatlist` |
| `fetch('/api/data')` | `index.html`, `flightshape.html` | Direct `expo-sqlite` calls |
| `fetch('/api/master')` | `discsuggestion.html` | `require('../assets/discs_master.json')` |
| `localStorage` | `index.html` (welcome modal) | `AsyncStorage` or skip modal entirely |
| `FileReader` + `Blob` (CSV) | `index.html` | `expo-file-system` + `expo-sharing` |
| `scrollIntoView` | `discsuggestion.html` | `FlatList.scrollToIndex` |
| `innerHTML` / template strings | all templates | JSX components |
| CSS variables (`--accent`, etc.) | all templates | `src/theme.ts` constants |
| `form` POST / page navigation | `pick.html` | React Navigation / Expo Router |

---

## 6. Current SQLite Schema (from `app.py init_db()`)

```sql
-- Core tables
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
  weight     TEXT DEFAULT '',     -- stored as TEXT (e.g. "175g")
  speed      REAL DEFAULT 0,
  glide      REAL DEFAULT 0,
  turn       REAL DEFAULT 0,
  fade       REAL DEFAULT 0,
  use_desc   TEXT DEFAULT '',
  thr        TEXT DEFAULT '',     -- throw type (RHBH, RHFH, etc.)
  notes      TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_meta (
  user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  next_id   INTEGER DEFAULT 100,         -- auto-increment counter for disc IDs
  sort_mode TEXT DEFAULT 'speed-desc',   -- 'speed-desc','speed-asc','name','mfr','custom'
  arc_view  TEXT DEFAULT 'RHBH'          -- 'RHBH','RHFH','LHBH','LHFH'
);

-- Migrations added after initial deploy
ALTER TABLE discs ADD COLUMN color TEXT DEFAULT '';      -- hex color, e.g. '#ff0000'
ALTER TABLE user_meta ADD COLUMN arc_view TEXT DEFAULT 'RHBH';
```

**Key detail:** `get_db()` always runs `PRAGMA foreign_keys = ON`. Mobile `db.ts` must do the same or CASCADE deletes silently fail.

---

## 7. Flask API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET/POST | `/pick` | None | User picker page |
| POST | `/add_user` | None | Create user, auto-login |
| POST | `/delete_user` | Required | Delete current user (cascades to discs) |
| POST | `/switch` | None | Clear session, back to picker |
| GET | `/` | Required | Serve `index.html` with username |
| GET | `/flightshape` | Required | Serve `flightshape.html` |
| GET | `/discsuggestion` | Required | Serve `discsuggestion.html` |
| GET | `/api/data` | Required | Returns `{discs, nextId, sortMode, arcView}` |
| POST | `/api/data` | Required | Bulk replace all discs + meta (destructive) |
| POST | `/api/arcview` | Required | Update only the arcView setting |
| GET | `/api/master` | None | Returns `discs_master.json` (cached in memory) |

**Mobile app does not use any of these routes.** All data access goes through `expo-sqlite` directly.

---

## 8. `discs_master.json` Shape

```json
[
  {
    "name": "Destroyer",
    "mfr": "Innova",
    "type": "Distance Driver",
    "speed": 12,
    "glide": 5,
    "turn": -1,
    "fade": 3,
    "stability": 2
  },
  ...
]
```

- 1,660+ discs total
- `stability` = pre-computed `fade + turn` (net stability)
- `type` is one of: `"Putt & Approach"`, `"Mid Range"`, `"Control Driver"`, `"Distance Driver"`
- File: `static/discs_master.json` → bundle as `assets/discs_master.json` in Expo project
- Load via: `const master = require('../assets/discs_master.json')` — no network call

---

## 9. `localStorage` Usage

| Key | Used in | Purpose |
|-----|---------|---------|
| `disc_welcome_v1` | `index.html` | Tracks whether welcome modal has been shown |

Only one key. In mobile v1, skip the welcome modal entirely or show it once using `AsyncStorage`.

---

## 10. CSV Import / Export

### Export (current behavior in `index.html`)
Fields exported per disc:
```
mfr, mold, plastic, weight, speed, glide, turn, fade, use, thr, notes, color
```
File created as Blob + auto-download via `<a>` click trigger.

### Import (current behavior)
- Parses CSV with header row
- Maps columns to disc fields
- Strips leading `#` from color (some export formats add it)
- Adds discs to current bag with generated IDs
- Does NOT clear existing bag first

**Mobile equivalent:**
- Export: `expo-file-system` write → `expo-sharing` share sheet
- Import: `expo-document-picker` → parse CSV text → insert into SQLite

---

## 11. Flight Shape Math Inventory

### Inputs

| Input | Source | Range |
|-------|--------|-------|
| `disc.speed` | Selected disc | 1–14 |
| `disc.glide` | Selected disc | 1–7 |
| `disc.turn` | Selected disc | -5 to 1 |
| `disc.fade` | Selected disc | 0–5 |
| `hyzer` | Slider `sl-hyzer` | -30° to +30° (positive = hyzer) |
| `nose` | Slider `sl-nose` | -20° to +20° (positive = nose up) |
| `wind` | Slider `sl-wind` | -20 to +20 (positive = headwind) |
| `armSpeed` | Slider `sl-arm` | 0–100% (100 = full power) |
| `spin` | Slider `sl-spin` | 0–100% (100 = normal spin) |
| `arcView` | Dropdown | RHBH / RHFH / LHBH / LHFH |

### MOD Constants (from `flightshape.html`)

```javascript
const MOD = {
  hyzer_turn: +0.07,   // hyzer > 0: more positive turn → less understable
  pitch_turn: -0.08,   // nose up: more turn (higher AOA, Kamaruddin/Potts)
  wind_turn:  -0.08,   // headwind: more negative turn → more understable (acts faster)
  arm_turn:   +0.03,   // underArm: more positive turn → less understable (can't reach speed)
  spin_turn:  +0.008,  // spinEffect: inverse formula, low spin → more understable

  hyzer_fade: +0.06,   // hyzer: more fade (finishes harder)
  pitch_fade: -0.03,   // nose up: slight fade reduction
  wind_fade:  +0.02,   // headwind: slight fade increase (drag slows disc sooner)
  arm_fade:   +0.03,   // underArm: more fade (underpowered fades earlier)
  spin_fade:  -0.008,  // spinEffect: less spin → slightly more fade
};
```

### `applyModifiers()` Logic

```javascript
const speedNorm = Math.max(0.5, disc.speed / 9);
const underArm  = Math.max(0, 100 - armSpeed) * speedNorm;
// Inverse spin: halving spin doubles precession rate (p = M/IΩ)
const spinEffect = -(100 / Math.max(spin, 1) - 1) * 100;

rawTurn = disc.turn + MOD.hyzer_turn*hyzer + MOD.pitch_turn*nose
        + MOD.wind_turn*wind + MOD.arm_turn*underArm + MOD.spin_turn*spinEffect;
rawFade = disc.fade + MOD.hyzer_fade*hyzer + MOD.pitch_fade*nose
        + MOD.wind_fade*wind + MOD.arm_fade*underArm + MOD.spin_fade*spinEffect;

// Clamp: turn [-6, 3], fade [0, 7]
// Round to 1 decimal place
```

### `arcPoints()` — Bézier path geometry

```javascript
// Mirror multiplier for throw handedness
m = (RHFH or LHBH) ? -1 : 1;

// Canvas: W=280, H=420. Top = landing, bottom = tee.
sx = W/2, sy = H*0.925 (tee), ey = H*0.075 (landing)

// End X: turn pulls right (for RHBH), fade pulls left
endX = cx + m*(turnAmt - fadeAmt*1.25)*sc   // sc = W/50

// Apex: higher glide = higher up the canvas
apexFrac = min(0.55, 0.30 + glide*0.025)
mx = cx + m*effTurn*sc*3.5   // apex X (understable only)
my = sy - HR*apexFrac

// Control point 1: near tee, launch direction
q0x = cx + m*effTurn*sc*1.3 - m*hyzerLaunch*sc
q0y = sy - HR*0.12

// Control point 2: smooth G1 joint at apex
k = min(1.5, fade*0.3 + glide*0.05 + turn*0.08)
q2x = mx + k*(mx - q0x)
q2y = max(ey + HR*0.03, my + k*(my - q0y))

// Two quadratic Bézier curves:
// Segment 1: tee(sx,sy) → Q(q0x,q0y) → apex(mx,my)
// Segment 2: apex(mx,my) → Q(q2x,q2y) → landing(endX,ey)
```

### `estimateDist()` Formula

```javascript
baseFt      = 80 + speed * 25          // speed 4→180ft, 9→305ft, 14→430ft
powerFactor = armSpeed / 100
glideFactor = 0.85 + glide * 0.03      // glide 5→1.00×, glide 7→1.06×
windFactor  = 1 - wind * 0.008         // headwind: −8%/unit
noseFactor  = 1 - max(0,nose)*0.015 - max(0,-nose)*0.005
hyzerFactor = 1 - (|hyzer|/30)*0.18    // extreme angle: up to −18%

dist = round(baseFt * powerFactor * glideFactor * windFactor * noseFactor * hyzerFactor / 10) * 10
```

---

## 12. Disc Suggestion Scenario Inventory

All 12 scenarios in `SCENARIOS` array (`discsuggestion.html`):

| ID | Title | stabMin | stabMax | speedMin | types | `bagTest` key conditions |
|----|-------|---------|---------|---------|-------|--------------------------|
| `straight` | Dead Straight | -1 | 1 | — | CD, MR | net stab -1..1, speed≥4 |
| `hyzer` | Reliable Hyzer | 2 | — | — | CD, DD, MR | fade≥3, turn≥-1 |
| `distance` | Max Distance | -1 | 2 | 11 | — | speed≥11, fade≤3, turn≤-0.5 |
| `headwind` | Into Headwind | 3 | — | — | CD, DD | fade≥3, turn≥-0.5, speed≥7 |
| `tailwind` | Tailwind | -2 | 0 | 9 | CD, DD | speed≥9, turn≤-1, net stab≤0 |
| `turnover` | Turnover | — | -1.5 | — | CD, DD | turn≤-2, fade≤2, net stab≤-1 |
| `forehand` | Forehand | 2 | — | — | CD, DD, MR | fade≥2, turn≥-0.5, speed≥6 |
| `tomahawk` | Tomahawk | 1 | 4 | — | CD, DD | speed≥7, fade≥2, turn≥-2 |
| `approach` | Approach | 0 | 2.5 | — | P&A, MR | speed≤6, fade≤3, turn≥-2 |
| `accurate_mid` | Accurate Mid | 0 | 2 | — | MR | speed 4–6, net stab 0..2 |
| `hyzerflip` | Hyzer Flip | -2 | -0.5 | — | CD, DD | speed 7–12, turn -2..-1, fade 1–2 |
| `roller` | Roller | — | -2.5 | — | CD, DD | turn≤-3, fade≤1 |

**Library filter:** Filters `allDiscs` by `stabMin/stabMax/speedMin/types`, then sorts by proximity to scenario midpoint stability, slices top 15.

**Bag filter:** Applies `sc.bagTest(d)` directly to each bag disc.

**Deduplication:** Bag matches shown in "From your bag" section. Library results exclude discs already in bag section (matched by `name + mfr`).

---

## 13. Stability Classification Logic

**Unified across all three pages** (fixed during previous session):

```javascript
// Net stability = fade + turn (turn is negative for understable discs)
stab(d)       → net >= 1: 'overstable'  | net <= -1: 'understable' | else: 'stable'
stabClass(n)  → n >= 1: 'stab-os'      | n <= -1: 'stab-us'      | else: 'stab-st'
stabShort(n)  → n >= 1: 'OS'           | n <= -1: 'US'            | else: 'ST'
```

**Color mapping:**
- OS: `#915EFF` (purple/accent)
- ST: `#4ade80` (green)
- US: `#fbbf24` (amber)

**Stability bar:** Maps stability range -4..+7 to 0–100%, zero marker at 36% (4/11 of range).

---

## 14. Fragile / Mixed / Unclear Code

| Issue | Location | Notes |
|-------|---------|-------|
| Arc SVG path math mixed with rendering | `flightshape.html` `arcPoints()` | Physics, tuning constants, and geometry all in one function. V2 separates these. |
| Distance estimate uses `baseDisc` but applies adjusted `glide` | `flightshape.html` `updateArc()` | `estimateDist(baseDisc, ..., adj.glide, ...)` — speed from base, glide from adjusted. Intentional but subtle. |
| `isNeutral` check for ghost arc | `flightshape.html` | Must check all 5 sliders are at default. If slider defaults change, this breaks silently. |
| `sort_order` / drag reorder | `index.html` | Drag is client-side; re-saved to server as whole array. On mobile, `react-native-draggable-flatlist` handles this. |
| `disc_id` vs `id` in API | `app.py`, `index.html` | DB column is `disc_id`; API returns it as `id`. Mobile CRUD must preserve this mapping. |
| `weight` stored as TEXT | `app.py` schema | Stored as string (e.g. `"175g"`), not number. Preserve this; do not cast to float. |
| Welcome modal `localStorage` | `index.html` | One key only; safe to skip in mobile v1. |
| `bagTest` closures in SCENARIOS | `discsuggestion.html` | Each scenario has an inline arrow function. These are pure — port directly. |

---

## 15. Proposed Expo File Structure

> Only listed after completing the website inventory above. This is a destination, not a starting point.

```
app/src/
├── theme.ts                  ← { BG, CARD, BORDER, TEXT, MUTED, ACCENT, OS, ST, US, DANGER }
├── db/
│   └── db.ts                 ← openDatabase(), PRAGMA foreign_keys=ON, all CRUD
├── utils/
│   ├── disc.ts               ← stab(), stabClass(), stabShort(), bagToDisc(), typeShort()
│   ├── legacyPhysics.ts      ← MOD, applyModifiers(), arcPoints(), estimateDist() — exact port
│   ├── physicsV2.ts          ← simulateFlight(), DEFAULT_FLIGHT_TUNING (V2, built alongside)
│   ├── flightRenderer.ts     ← flightPointsToSvgPath(points) → SVG path string
│   ├── scenarios.ts          ← SCENARIOS array, filterBag(), filterLibrary()
│   └── csv.ts                ← exportCSV(), importCSV()
├── screens/
│   ├── BagScreen.tsx
│   ├── FlightShapeScreen.tsx
│   ├── DiscSuggestScreen.tsx
│   └── DevScreen.tsx         ← hidden physics tuning sliders
└── components/
    ├── DiscCard.tsx
    ├── ArcSvg.tsx            ← receives FlightPoint[] or path string, no physics
    ├── VerticalSlider.tsx
    ├── StabilityChip.tsx
    └── StabilityBar.tsx
```
