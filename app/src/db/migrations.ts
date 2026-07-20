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
`;

// Same three columns app.py has actually migrated in, in the same order, including the
// in_bag column added this session — this was previously a documented gap (the plan's schema
// hadn't caught up to the website's schema); closed here.
const COLUMN_MIGRATIONS: { ddl: string }[] = [
  { ddl: "ALTER TABLE discs ADD COLUMN color TEXT DEFAULT ''" },
  { ddl: "ALTER TABLE user_meta ADD COLUMN arc_view TEXT DEFAULT 'RHBH'" },
  { ddl: 'ALTER TABLE discs ADD COLUMN in_bag INTEGER DEFAULT 0' },
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
