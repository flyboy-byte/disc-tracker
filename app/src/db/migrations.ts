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
