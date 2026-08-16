// Schema identical to Flask's init_db() (app.py) — same tables, same column-by-column
// migration pattern (base schema, then tolerant ALTER TABLE for columns added after initial
// deploy). Kept in lockstep deliberately: this is what "the website is the spec" means for
// the data layer, and it's also what makes sync (RESEARCH.md §2, Path D) a straight full-
// replace of a bag shaped exactly like the server's, not a translation step.
import type { SQLiteDatabase } from 'expo-sqlite';

const BASE_SCHEMA = `
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
  // '' (unset) | 'new' | 'seasoned' | 'beat'. Plain inert field this phase — no coupling to
  // stability_adj yet (flagged for a future refinement, not built).
  { ddl: "ALTER TABLE discs ADD COLUMN wear_level TEXT DEFAULT ''" },
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
