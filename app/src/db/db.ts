// Local SQLite is the only store for v1 — the app works fully offline, forever, with no
// server dependency (RESEARCH.md §2, Path B). Every function here is written so that, when
// sync ships in v1.1 (Path D — pull/push the *entire* bag to the same VPS the website already
// uses, full-replace, no merge logic, single-user last-write-wins), the sync layer can call
// getDiscs()/saveDiscs() with server-fetched data instead of local UI edits and nothing here
// has to change. saveDiscs() already does a full delete+reinsert rather than incremental
// upserts specifically because that's the same "replace this user's entire disc set" operation
// a sync pull/push would need — this isn't a shortcut, it's the shape sync will reuse directly.
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Disc } from '../utils/disc';
import { runMigrations } from './migrations';

export interface UserMeta {
  nextId: number;
  sortMode: string;
  arcView: string;
}

const DB_NAME = 'disc_tracker.db';
const DEFAULT_USERNAME = 'My Bag';

let dbInstance: SQLiteDatabase | null = null;

// Serialize every public DB operation onto a single promise chain. expo-sqlite's
// withExclusiveTransactionAsync (used by saveDiscs) takes a lock that a concurrent read on
// the same connection can collide with — observed on-device (2026-07-24) as an unhandled
// "database is locked" rejection on finalizeAsync when a tab's focus-effect getDiscs raced a
// drag-reorder write. Running operations strictly one-at-a-time removes the race. Each caller
// still receives its own result/rejection; only ordering is forced. NOTE: functions wrapped
// with serialize() must never call another serialize()-wrapped function (that would deadlock —
// the inner call queues behind the outer, which is waiting on it); use the raw *Impl helpers.
let dbQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(op: () => Promise<T>): Promise<T> {
  const run = dbQueue.then(op, op);
  // Keep the chain alive regardless of this op's outcome; swallow only for the chain, not the caller.
  dbQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function openDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // Must run on every connection — SQLite does not enforce foreign keys by default, and
  // without this ON DELETE CASCADE silently fails, leaving orphaned discs behind.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  dbInstance = db;
  return db;
}

// v1 hides the multi-user picker (schema supports it for later, RESEARCH.md §2) — auto-create
// a single default user on first launch and use it for everything.
export function getOrCreateDefaultUser(): Promise<number> {
  return serialize(async () => {
    const db = await openDatabase();
    const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM users WHERE username = ?', [DEFAULT_USERNAME]);
    if (existing) return existing.id;
    let userId: number;
    try {
      const result = await db.runAsync('INSERT INTO users (username) VALUES (?)', [DEFAULT_USERNAME]);
      userId = result.lastInsertRowId;
    } catch {
      // Two concurrent first-launch calls can both miss the SELECT above and race on the
      // UNIQUE(username) constraint — re-select rather than crash on the loser.
      const created = await db.getFirstAsync<{ id: number }>('SELECT id FROM users WHERE username = ?', [DEFAULT_USERNAME]);
      if (!created) throw new Error('Failed to create or find default user');
      return created.id;
    }
    await db.runAsync('INSERT INTO user_meta (user_id, next_id, sort_mode, arc_view) VALUES (?, 100, ?, ?)', [
      userId,
      'speed-desc',
      'RHBH',
    ]);
    return userId;
  });
}

interface DiscRow {
  disc_id: number;
  mfr: string;
  mold: string;
  plastic: string;
  weight: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  use_desc: string;
  thr: string;
  notes: string;
  color: string;
  in_bag: number;
}

export function getDiscs(userId: number): Promise<Disc[]> {
  return serialize(async () => {
    const db = await openDatabase();
    const rows = await db.getAllAsync<DiscRow>(
      `SELECT disc_id, mfr, mold, plastic, weight, speed, glide, turn, fade,
              use_desc, thr, notes, color, in_bag
       FROM discs WHERE user_id = ? ORDER BY sort_order`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.disc_id,
      mfr: r.mfr,
      mold: r.mold,
      plastic: r.plastic,
      weight: r.weight,
      speed: r.speed,
      glide: r.glide,
      turn: r.turn,
      fade: r.fade,
      use: r.use_desc,
      thr: r.thr,
      notes: r.notes,
      color: r.color || '',
      inBag: !!r.in_bag,
    }));
  });
}

// Bulk replace — same semantics as Flask's POST /api/data (delete all, reinsert in order).
// Uses withExclusiveTransactionAsync (not withTransactionAsync — per expo-sqlite's own docs,
// a plain transaction "is not exclusive and can be interrupted by other async queries," which
// would be a real bug here: this is the write path every future screen mutation calls, so a
// concurrent getDiscs() could read mid-delete. All queries below run on `txn`, not `db` —
// that's required for the exclusivity to actually apply.
export function saveDiscs(userId: number, discs: Disc[]): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM discs WHERE user_id = ?', [userId]);
      let sortOrder = 0;
      for (const d of discs) {
        if (!d.mold?.trim()) continue; // skip discs with no mold name, matches app.py
        await txn.runAsync(
          `INSERT INTO discs (user_id, disc_id, mfr, mold, plastic, weight,
             speed, glide, turn, fade, use_desc, thr, notes, color, sort_order, in_bag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            d.id ?? 0,
            d.mfr ?? '',
            d.mold,
            d.plastic ?? '',
            d.weight ?? '',
            d.speed ?? 0,
            d.glide ?? 0,
            d.turn ?? 0,
            d.fade ?? 0,
            d.use ?? '',
            d.thr ?? '',
            d.notes ?? '',
            d.color ?? '',
            sortOrder,
            d.inBag ? 1 : 0,
          ]
        );
        sortOrder++;
      }
    });
  });
}

// Raw read shared by getMeta (serialized) and setMeta (serialized) — must NOT itself be
// serialized, or setMeta would deadlock waiting on a slot queued behind its own.
async function readMeta(db: SQLiteDatabase, userId: number): Promise<UserMeta> {
  const row = await db.getFirstAsync<{ next_id: number; sort_mode: string; arc_view: string }>(
    'SELECT next_id, sort_mode, arc_view FROM user_meta WHERE user_id = ?',
    [userId]
  );
  return {
    nextId: row?.next_id ?? 100,
    sortMode: row?.sort_mode ?? 'speed-desc',
    arcView: row?.arc_view ?? 'RHBH',
  };
}

export function getMeta(userId: number): Promise<UserMeta> {
  return serialize(async () => readMeta(await openDatabase(), userId));
}

export function setMeta(userId: number, updates: Partial<UserMeta>): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    const current = await readMeta(db, userId);
    const next = { ...current, ...updates };
    await db.runAsync(
      `INSERT INTO user_meta (user_id, next_id, sort_mode, arc_view) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         next_id = excluded.next_id, sort_mode = excluded.sort_mode, arc_view = excluded.arc_view`,
      [userId, next.nextId, next.sortMode, next.arcView]
    );
  });
}

export function deleteUser(userId: number): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync('DELETE FROM users WHERE id = ?', [userId]);
  });
}

// Test-only: forces the next openDatabase() call to open a fresh connection.
export function __resetDbInstanceForTests(): void {
  dbInstance = null;
}
