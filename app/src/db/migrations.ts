// Schema identical to Flask's init_db() (app.py) — same tables, same column-by-column
// migration pattern (base schema, then tolerant ALTER TABLE for columns added after initial
// deploy). Kept in lockstep deliberately: this is what "the website is the spec" means for
// the data layer, and it's also what makes sync (RESEARCH.md §2, Path D) a straight full-
// replace of a bag shaped exactly like the server's, not a translation step.
import type { SQLiteDatabase } from 'expo-sqlite';

// Exported so persistence.test.ts can parse the live table list straight from the schema
// itself, rather than a hand-copied list that can drift out of sync with what's actually here.
export const BASE_SCHEMA = `
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
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS user_meta (
  user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  next_id   INTEGER DEFAULT 100,
  sort_mode TEXT DEFAULT 'speed-desc'
);
-- Local cache of DiscIt (Marshall Street) reference-image lookups — same shape/purpose as the
-- website's ms_pic_cache (app.py): keyed by "mfr|mold" lowercase, stores the image URL or '' for
-- a confirmed "no match" so each disc is looked up over the network at most once. Purely a cache;
-- the feature works entirely from it once populated, and is safe to wipe. See src/net/msPic.ts.
CREATE TABLE IF NOT EXISTS ms_pic_cache (
  lookup_key TEXT PRIMARY KEY,
  pic        TEXT
);
-- Offline scorekeeper (B3) — app-only, no website counterpart (like the physics sim). A round is
-- rounds + its holes' pars + its players + a sparse score grid. Totals/vs-par are computed in JS
-- (src/utils/roundMath.ts), never stored. ON DELETE CASCADE (needs PRAGMA foreign_keys = ON, set on
-- every connection in db.ts) tears a round's holes/players/scores down with it. See
-- app/plan/docs/scorekeeper-scope.md.
CREATE TABLE IF NOT EXISTS rounds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT DEFAULT '',
  course     TEXT DEFAULT '',
  played_on  TEXT,
  hole_count INTEGER DEFAULT 18,
  finished   INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS round_holes (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole     INTEGER NOT NULL,
  par      INTEGER DEFAULT 3,
  PRIMARY KEY (round_id, hole)
);
CREATE TABLE IF NOT EXISTS round_players (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id   INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  name       TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS round_scores (
  round_id  INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES round_players(id) ON DELETE CASCADE,
  hole      INTEGER NOT NULL,
  strokes   INTEGER NOT NULL,
  PRIMARY KEY (round_id, player_id, hole)
);
-- App-only (no website counterpart): the user's personal disc library — discs they own that
-- aren't in the bundled 1,660-disc master list. These surface in the "Autofill from disc library"
-- search alongside the bundled discs (marked as custom), so a disc the library is missing only has
-- to be entered once and is reusable across bag adds. This is the first concrete slice of the
-- C-series "user-declared flight" layer (plan/docs/direction-2026-08-08.md, Decision 1): declared
-- numbers, kept separate from the immutable factory catalog, never written back over it.
CREATE TABLE IF NOT EXISTS custom_discs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mfr        TEXT DEFAULT '',
  name       TEXT NOT NULL,
  speed      REAL DEFAULT 0,
  glide      REAL DEFAULT 0,
  turn       REAL DEFAULT 0,
  fade       REAL DEFAULT 0,
  type       TEXT DEFAULT '',
  created_at TEXT
);
-- suggest-swipe-scope.md — Gmail-style swipe-to-dismiss on Disc Suggest result cards. A swipe
-- always does this: drop the disc to the bottom of *this scenario's* list (list_key namespaces
-- by mode so a Throw-mode swipe never touches Buy mode's ordering or vice versa, and a swipe on
-- one scenario never touches another). Nothing is ever deleted — just reordered client-side on
-- top of rankDiscs()'s output. position increases monotonically per (user_id, list_key), so the
-- most recently swiped disc always lands at the very bottom, below earlier swipes.
CREATE TABLE IF NOT EXISTS suggest_demotions (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_key TEXT NOT NULL,
  disc_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (user_id, list_key, disc_key)
);
-- suggest-swipe-scope.md — Buy mode's learning engine, one row per user (global across
-- scenarios, unlike suggest_demotions above). avoid_* is a running centroid of the flight
-- numbers of discs swiped away; avoid_strength governs how hard that centroid is applied and
-- decays fast (session-local, "aggressive this session"); brand_aversion decays slowly ("long
-- term memory" on brand). See suggestScore.ts learningPenalty() and db.ts getLearningState().
CREATE TABLE IF NOT EXISTS suggest_learning (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avoid_speed    REAL DEFAULT 0,
  avoid_glide    REAL DEFAULT 0,
  avoid_turn     REAL DEFAULT 0,
  avoid_fade     REAL DEFAULT 0,
  avoid_strength REAL DEFAULT 0,
  brand_aversion TEXT DEFAULT '{}',
  engine_enabled INTEGER DEFAULT 1,
  decayed_at     TEXT
);
`;

// Same three columns app.py has actually migrated in, in the same order, including the
// in_bag column added this session — this was previously a documented gap (the plan's schema
// hadn't caught up to the website's schema); closed here.
const COLUMN_MIGRATIONS: { ddl: string }[] = [
  { ddl: "ALTER TABLE discs ADD COLUMN color TEXT DEFAULT ''" },
  { ddl: "ALTER TABLE user_meta ADD COLUMN arc_view TEXT DEFAULT 'RHBH'" },
  { ddl: 'ALTER TABLE discs ADD COLUMN in_bag INTEGER DEFAULT 0' },
  // App-only column (no website counterpart): the Marshall Street reference-image opt-in.
  // The website persists this in localStorage and defaults it ON; the app defaults it OFF
  // (0) so the app makes zero network connections until the user explicitly enables it —
  // the F-Droid privacy bar (PORT_PLAN.md "Network-feature privacy bar").
  { ddl: 'ALTER TABLE user_meta ADD COLUMN ms_ref INTEGER DEFAULT 0' },
  // App-only column (no website counterpart yet): the disc-suggestion skill preset
  // (beginner | intermediate | advanced), default intermediate. Drives suggestScore.ts.
  { ddl: "ALTER TABLE user_meta ADD COLUMN skill TEXT DEFAULT 'intermediate'" },
  // App-only column (B2): Field view scope. Default 0 = show only today's-bag discs (the full
  // library is unreadable + slow to render as one SVG — see plan/docs/b2-spike.md). When 1, Field
  // view instead draws the whole filtered set, but only while it's small enough to stay legible.
  { ddl: 'ALTER TABLE user_meta ADD COLUMN field_show_all INTEGER DEFAULT 0' },
  // Disc-suggestion throw style (backhand | forehand), default backhand. A modifier applied on
  // top of whichever scenario is active — see suggestScore.ts THROW_STYLE_BIAS.
  { ddl: "ALTER TABLE user_meta ADD COLUMN throw_style TEXT DEFAULT 'backhand'" },
  // User-declared flight layer (Decision 1, direction-2026-08-08.md): an optional per-owned-disc
  // adjustment, -2..+2, "flies more understable" to "flies more overstable than stock." Default 0
  // is a no-op. Never written to the immutable master library — this column lives only on the
  // user's own discs row. See disc.ts bagToDisc / suggestScore.ts.
  { ddl: 'ALTER TABLE discs ADD COLUMN stability_adj REAL DEFAULT 0' },
  // Phase 3 (suggest-engine-plan.md) — personal role tag, e.g. "hyzer bomb" or "flex/utility."
  // Free text, optional, no website counterpart. Surfaced today on the disc form; the intended
  // future use is Phase 4 Bag Analysis reading this to distinguish "numerically redundant" from
  // "tagged for different roles" — not built yet, this column just captures the data going forward.
  { ddl: "ALTER TABLE discs ADD COLUMN role_tag TEXT DEFAULT ''" },
  // Phase 2 (data-audit-scope.md) — optional wear-level snapshot per owned disc:
  // '' (unset) | 'new' | 'seasoned' | 'beat'. Superseded 2026-08-16 by wear_estimate below — kept
  // in the schema (not dropped) since it's still derived and written on every save, so anything
  // that reads it stays correct without a destructive migration.
  { ddl: "ALTER TABLE discs ADD COLUMN wear_level TEXT DEFAULT ''" },
  // wear-estimate-scope.md, decision: supersede. The field the UI now actually shows: 1 (fresh)
  // .. 5 (trashed), NULL = unset. wear_level keeps getting derived from this on every save
  // (disc.ts deriveWearLevel), so it never silently goes stale.
  { ddl: 'ALTER TABLE discs ADD COLUMN wear_estimate INTEGER DEFAULT NULL' },
  // One-time backfill, not a schema change: a disc that already had a manually-chosen wear_level
  // before wear_estimate existed gets a matching estimate seeded in, so it doesn't suddenly look
  // "incomplete" in the Data Audit the moment this ships. Idempotent (WHERE wear_estimate IS
  // NULL) — harmless to re-run on every launch, only ever touches never-yet-estimated discs.
  {
    ddl: `UPDATE discs SET wear_estimate = CASE wear_level
            WHEN 'new' THEN 1 WHEN 'seasoned' THEN 3 WHEN 'beat' THEN 5 END
          WHERE wear_estimate IS NULL AND wear_level IS NOT NULL AND wear_level != ''`,
  },
  // buying-mode-scope.md — Disc Suggest's Throwing/Buying mode toggle. Default 'throwing' is a
  // no-op: existing behavior is completely unchanged until a user taps into Buying mode.
  { ddl: "ALTER TABLE user_meta ADD COLUMN suggest_mode TEXT DEFAULT 'throwing'" },
  // catalog-v2-scope.md — state for the optional downloaded disc catalog (src/catalog/).
  // All NULL/default until a user explicitly downloads a catalog pack; the app keeps using the
  // bundled fallback library until then. Never written to from anywhere except a successful
  // catalogSync.syncCatalog() activation.
  { ddl: 'ALTER TABLE user_meta ADD COLUMN catalog_version INTEGER DEFAULT NULL' },
  { ddl: 'ALTER TABLE user_meta ADD COLUMN catalog_dataset_version TEXT DEFAULT NULL' },
  { ddl: 'ALTER TABLE user_meta ADD COLUMN catalog_hash TEXT DEFAULT NULL' },
  // catalog-v2-scope.md follow-up — three-way catalog source picker (bundled/trydiscs/custom)
  // + the one-time first-run download prompt. Which source is *active* still lives entirely in
  // catalogLoader.ts's own source-pref.json (that's what actually decides what loads at startup)
  // — this column only tracks whether the first-run prompt has fired, since that's a one-time
  // user-facing event, not catalog state. Defaults 0 so existing installs (already past first
  // run) still see the prompt once — harmless, matches "explicit, never automatic" for anything
  // network.
  { ddl: 'ALTER TABLE user_meta ADD COLUMN catalog_prompt_shown INTEGER DEFAULT 0' },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(BASE_SCHEMA);
  for (const { ddl } of COLUMN_MIGRATIONS) {
    try {
      await db.execAsync(ddl);
    } catch {
      // Column already exists — same tolerate-and-continue pattern as app.py's init_db().
    }
  }
}
