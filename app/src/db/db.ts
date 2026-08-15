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
import type { SkillPreset, ThrowStyle } from '../utils/suggestScore';
import type { Round } from '../utils/roundMath';
import type { CustomMasterDisc } from '../utils/masterLibrary';
import { runMigrations } from './migrations';

export interface UserMeta {
  nextId: number;
  sortMode: string;
  arcView: string;
  // Marshall Street reference images opt-in. Defaults OFF — the app stays fully offline until
  // the user turns this on in Settings (F-Droid privacy bar). See src/net/msPic.ts.
  msRefEnabled: boolean;
  // Disc-suggestion skill preset — drives suggestScore.ts. Default 'intermediate'.
  skill: SkillPreset;
  // Disc-suggestion throw style modifier — drives suggestScore.ts. Default 'backhand'.
  throwStyle: ThrowStyle;
  // Field view scope (B2). false = today's-bag discs only (default); true = whole filtered set
  // when it's small enough to stay readable. See plan/docs/b2-spike.md.
  fieldShowAll: boolean;
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
  stability_adj: number;
}

export function getDiscs(userId: number): Promise<Disc[]> {
  return serialize(async () => {
    const db = await openDatabase();
    const rows = await db.getAllAsync<DiscRow>(
      `SELECT disc_id, mfr, mold, plastic, weight, speed, glide, turn, fade,
              use_desc, thr, notes, color, in_bag, stability_adj
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
      stabilityAdj: r.stability_adj ?? 0,
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
             speed, glide, turn, fade, use_desc, thr, notes, color, sort_order, in_bag, stability_adj)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            d.stabilityAdj ?? 0,
          ]
        );
        sortOrder++;
      }
    });
  });
}

// ── Incremental single-row writes (B2) ────────────────────────────────────────
// saveDiscs() above rewrites the WHOLE table on every call. That was fine at bag scale but is an
// O(N) cliff at collection scale (measured ~400ms per in-bag toggle at 200 rows — b2-spike.md).
// These targeted writes touch only the affected row(s). saveDiscs stays the path for bulk replace
// (CSV import, delete-all, sync) where a full rewrite is genuinely what's wanted. discs are keyed
// by (user_id, disc_id) — disc_id is the app-facing id, unique per user.

// Flip one disc's in-bag flag. Single UPDATE — replaces a full-table rewrite for the most
// frequent mutation there is (today's-bag toggling).
export function setDiscInBag(userId: number, discId: number, inBag: boolean): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync('UPDATE discs SET in_bag = ? WHERE user_id = ? AND disc_id = ?', [inBag ? 1 : 0, userId, discId]);
  });
}

// Unmark every in-bag disc in one statement (the "Clear bag" bulk action).
export function clearTodaysBag(userId: number): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync('UPDATE discs SET in_bag = 0 WHERE user_id = ? AND in_bag = 1', [userId]);
  });
}

// Delete one disc (ON DELETE CASCADE only matters for users; discs are leaf rows).
export function deleteDisc(userId: number, discId: number): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync('DELETE FROM discs WHERE user_id = ? AND disc_id = ?', [userId, discId]);
  });
}

// ── Custom disc library (custom_discs) ────────────────────────────────────────────────────────
// The user's own library entries, surfaced in the "Autofill from disc library" search alongside
// the bundled master list. See migrations.ts and masterLibrary.ts (CustomMasterDisc).
export function getCustomDiscs(userId: number): Promise<CustomMasterDisc[]> {
  return serialize(async () => {
    const db = await openDatabase();
    const rows = await db.getAllAsync<{
      id: number; mfr: string; name: string; speed: number; glide: number; turn: number; fade: number; type: string;
    }>('SELECT id, mfr, name, speed, glide, turn, fade, type FROM custom_discs WHERE user_id = ? ORDER BY name COLLATE NOCASE', [userId]);
    return rows.map((r) => ({
      id: r.id,
      mfr: r.mfr,
      name: r.name,
      speed: r.speed,
      glide: r.glide,
      turn: r.turn,
      fade: r.fade,
      stability: r.turn + r.fade, // net; the badge scale (masterLibrary/disc.ts) — never drives overlap logic
      type: r.type ?? '',
      custom: true as const,
    }));
  });
}

export function addCustomDisc(
  userId: number,
  d: { mfr: string; name: string; speed: number; glide: number; turn: number; fade: number; type?: string }
): Promise<CustomMasterDisc> {
  return serialize(async () => {
    const db = await openDatabase();
    const res = await db.runAsync(
      'INSERT INTO custom_discs (user_id, mfr, name, speed, glide, turn, fade, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, d.mfr ?? '', d.name, d.speed ?? 0, d.glide ?? 0, d.turn ?? 0, d.fade ?? 0, d.type ?? '', new Date().toISOString()]
    );
    return {
      id: res.lastInsertRowId,
      mfr: d.mfr ?? '',
      name: d.name,
      speed: d.speed ?? 0,
      glide: d.glide ?? 0,
      turn: d.turn ?? 0,
      fade: d.fade ?? 0,
      stability: (d.turn ?? 0) + (d.fade ?? 0),
      type: d.type ?? '',
      custom: true as const,
    };
  });
}

export function deleteCustomDisc(userId: number, id: number): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync('DELETE FROM custom_discs WHERE user_id = ? AND id = ?', [userId, id]);
  });
}

// Full replace of the custom library (restore path). No-op-safe: an empty list clears it.
export function replaceCustomDiscs(userId: number, discs: CustomMasterDisc[]): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM custom_discs WHERE user_id = ?', [userId]);
      for (const d of discs) {
        await txn.runAsync(
          'INSERT INTO custom_discs (user_id, mfr, name, speed, glide, turn, fade, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, d.mfr ?? '', d.name, d.speed ?? 0, d.glide ?? 0, d.turn ?? 0, d.fade ?? 0, d.type ?? '', new Date().toISOString()]
        );
      }
    });
  });
}

// Insert one new disc at the end (sortOrder = current max + 1). Returns nothing; caller already
// holds the disc object in UI state. Skips a blank mold, matching saveDiscs / app.py.
export function insertDisc(userId: number, d: Disc): Promise<void> {
  return serialize(async () => {
    if (!d.mold?.trim()) return;
    const db = await openDatabase();
    const row = await db.getFirstAsync<{ maxSort: number | null }>(
      'SELECT MAX(sort_order) AS maxSort FROM discs WHERE user_id = ?',
      [userId]
    );
    const sortOrder = (row?.maxSort ?? -1) + 1;
    await db.runAsync(
      `INSERT INTO discs (user_id, disc_id, mfr, mold, plastic, weight,
         speed, glide, turn, fade, use_desc, thr, notes, color, sort_order, in_bag, stability_adj)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, d.id ?? 0, d.mfr ?? '', d.mold, d.plastic ?? '', d.weight ?? '', d.speed ?? 0, d.glide ?? 0, d.turn ?? 0, d.fade ?? 0, d.use ?? '', d.thr ?? '', d.notes ?? '', d.color ?? '', sortOrder, d.inBag ? 1 : 0, d.stabilityAdj ?? 0]
    );
  });
}

// Update one disc's editable fields in place (edit form save). Does NOT touch sort_order or
// in_bag — those have their own paths — so an edit can't accidentally reshuffle or un-bag a disc.
export function updateDisc(userId: number, d: Disc): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync(
      `UPDATE discs SET mfr = ?, mold = ?, plastic = ?, weight = ?, speed = ?, glide = ?,
         turn = ?, fade = ?, use_desc = ?, thr = ?, notes = ?, color = ?, stability_adj = ?
       WHERE user_id = ? AND disc_id = ?`,
      [d.mfr ?? '', d.mold, d.plastic ?? '', d.weight ?? '', d.speed ?? 0, d.glide ?? 0, d.turn ?? 0, d.fade ?? 0, d.use ?? '', d.thr ?? '', d.notes ?? '', d.color ?? '', d.stabilityAdj ?? 0, userId, d.id ?? 0]
    );
  });
}

// Persist a new custom order after a drag. Rewrites only sort_order (one UPDATE per row in a
// single transaction — no DELETE, no reinsert of the other 15 columns), keyed by disc_id.
export function reorderDiscs(userId: number, orderedIds: number[]): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await txn.runAsync('UPDATE discs SET sort_order = ? WHERE user_id = ? AND disc_id = ?', [i, userId, orderedIds[i]]);
      }
    });
  });
}

// Raw read shared by getMeta (serialized) and setMeta (serialized) — must NOT itself be
// serialized, or setMeta would deadlock waiting on a slot queued behind its own.
async function readMeta(db: SQLiteDatabase, userId: number): Promise<UserMeta> {
  const row = await db.getFirstAsync<{
    next_id: number; sort_mode: string; arc_view: string; ms_ref: number; skill: string; field_show_all: number; throw_style: string;
  }>(
    'SELECT next_id, sort_mode, arc_view, ms_ref, skill, field_show_all, throw_style FROM user_meta WHERE user_id = ?',
    [userId]
  );
  const skill = row?.skill;
  const throwStyle = row?.throw_style;
  return {
    nextId: row?.next_id ?? 100,
    sortMode: row?.sort_mode ?? 'speed-desc',
    arcView: row?.arc_view ?? 'RHBH',
    msRefEnabled: !!row?.ms_ref,
    skill: skill === 'beginner' || skill === 'advanced' ? skill : 'intermediate',
    fieldShowAll: !!row?.field_show_all,
    throwStyle: throwStyle === 'forehand' ? 'forehand' : 'backhand',
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
      `INSERT INTO user_meta (user_id, next_id, sort_mode, arc_view, ms_ref, skill, field_show_all, throw_style) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         next_id = excluded.next_id, sort_mode = excluded.sort_mode,
         arc_view = excluded.arc_view, ms_ref = excluded.ms_ref, skill = excluded.skill,
         field_show_all = excluded.field_show_all, throw_style = excluded.throw_style`,
      [userId, next.nextId, next.sortMode, next.arcView, next.msRefEnabled ? 1 : 0, next.skill, next.fieldShowAll ? 1 : 0, next.throwStyle]
    );
  });
}

// ── Marshall Street reference-image cache ──────────────────────────────────────
// Mirror of the website's ms_pic_cache (app.py fetch_ms_pic). getCachedMsPic returns:
//   undefined → this disc has never been looked up (caller may fetch over the network)
//   ''        → looked up before, confirmed no match (don't refetch)
//   'https://…' → cached image URL
// Only src/net/msPic.ts writes here, and only after a definitive API response, so a transient
// offline failure never poisons the cache as a permanent "not found".
export function getCachedMsPic(lookupKey: string): Promise<string | undefined> {
  return serialize(async () => {
    const db = await openDatabase();
    const row = await db.getFirstAsync<{ pic: string | null }>(
      'SELECT pic FROM ms_pic_cache WHERE lookup_key = ?',
      [lookupKey]
    );
    return row ? row.pic ?? '' : undefined;
  });
}

export function putCachedMsPic(lookupKey: string, pic: string): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync(
      'INSERT INTO ms_pic_cache (lookup_key, pic) VALUES (?, ?) ON CONFLICT(lookup_key) DO UPDATE SET pic = excluded.pic',
      [lookupKey, pic]
    );
  });
}

// ── Offline scorekeeper (B3) ───────────────────────────────────────────────────
// Round CRUD. The app-facing Round shape lives in src/utils/roundMath.ts (one source of truth for
// the scoring math too). Totals/vs-par are never stored — always computed from round_scores. Score
// writes are single-row UPSERTs (per-hole), never a table rewrite (the B2 lesson).

export interface NewRoundInput {
  label: string;
  course: string;
  playedOn: string;
  holeCount: number;
  pars: number[]; // length holeCount, par per hole (1-based → pars[0] is hole 1)
  playerNames: string[]; // 1..4
}

export function createRound(userId: number, input: NewRoundInput): Promise<number> {
  return serialize(async () => {
    const db = await openDatabase();
    let roundId = 0;
    await db.withExclusiveTransactionAsync(async (txn) => {
      const res = await txn.runAsync(
        'INSERT INTO rounds (user_id, label, course, played_on, hole_count, finished, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
        [userId, input.label ?? '', input.course ?? '', input.playedOn, input.holeCount, new Date().toISOString()]
      );
      roundId = res.lastInsertRowId;
      for (let h = 1; h <= input.holeCount; h++) {
        await txn.runAsync('INSERT INTO round_holes (round_id, hole, par) VALUES (?, ?, ?)', [roundId, h, input.pars[h - 1] ?? 3]);
      }
      let order = 0;
      for (const name of input.playerNames) {
        await txn.runAsync('INSERT INTO round_players (round_id, name, sort_order) VALUES (?, ?, ?)', [roundId, name || 'Player', order++]);
      }
    });
    return roundId;
  });
}

// Raw (non-serialized) assembler shared by getRound + listRounds — see readMeta's note on why
// serialize()-wrapped fns must not call other serialize()-wrapped fns.
async function loadRounds(db: SQLiteDatabase, where: string, params: (string | number)[]): Promise<Round[]> {
  const rows = await db.getAllAsync<{ id: number; label: string; course: string; played_on: string; hole_count: number; finished: number }>(
    `SELECT id, label, course, played_on, hole_count, finished FROM rounds ${where} ORDER BY created_at DESC`,
    params
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const holes = await db.getAllAsync<{ round_id: number; hole: number; par: number }>(
    `SELECT round_id, hole, par FROM round_holes WHERE round_id IN (${placeholders}) ORDER BY hole`,
    ids
  );
  const players = await db.getAllAsync<{ id: number; round_id: number; name: string }>(
    `SELECT id, round_id, name FROM round_players WHERE round_id IN (${placeholders}) ORDER BY sort_order`,
    ids
  );
  const scores = await db.getAllAsync<{ round_id: number; player_id: number; hole: number; strokes: number }>(
    `SELECT round_id, player_id, hole, strokes FROM round_scores WHERE round_id IN (${placeholders})`,
    ids
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    course: r.course,
    playedOn: r.played_on,
    holeCount: r.hole_count,
    finished: !!r.finished,
    holes: holes.filter((h) => h.round_id === r.id).map((h) => ({ hole: h.hole, par: h.par })),
    players: players.filter((p) => p.round_id === r.id).map((p) => ({ id: p.id, name: p.name })),
    scores: scores.filter((s) => s.round_id === r.id).map((s) => ({ playerId: s.player_id, hole: s.hole, strokes: s.strokes })),
  }));
}

export function listRounds(userId: number): Promise<Round[]> {
  return serialize(async () => loadRounds(await openDatabase(), 'WHERE user_id = ?', [userId]));
}

export function getRound(roundId: number): Promise<Round | null> {
  return serialize(async () => {
    const rounds = await loadRounds(await openDatabase(), 'WHERE id = ?', [roundId]);
    return rounds[0] ?? null;
  });
}

// Enter/update one player's strokes on one hole (single UPSERT).
export function setScore(roundId: number, playerId: number, hole: number, strokes: number): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync(
      `INSERT INTO round_scores (round_id, player_id, hole, strokes) VALUES (?, ?, ?, ?)
       ON CONFLICT(round_id, player_id, hole) DO UPDATE SET strokes = excluded.strokes`,
      [roundId, playerId, hole, strokes]
    );
  });
}

// Edit a hole's par (setup or later correction).
export function setPar(roundId: number, hole: number, par: number): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync(
      `INSERT INTO round_holes (round_id, hole, par) VALUES (?, ?, ?)
       ON CONFLICT(round_id, hole) DO UPDATE SET par = excluded.par`,
      [roundId, hole, par]
    );
  });
}

export function updateRoundMeta(roundId: number, meta: { label?: string; course?: string; finished?: boolean }): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    const sets: string[] = [];
    const vals: (string | number)[] = [];
    if (meta.label !== undefined) (sets.push('label = ?'), vals.push(meta.label));
    if (meta.course !== undefined) (sets.push('course = ?'), vals.push(meta.course));
    if (meta.finished !== undefined) (sets.push('finished = ?'), vals.push(meta.finished ? 1 : 0));
    if (sets.length === 0) return;
    vals.push(roundId);
    await db.runAsync(`UPDATE rounds SET ${sets.join(', ')} WHERE id = ?`, vals);
  });
}

export function deleteRound(roundId: number): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.runAsync('DELETE FROM rounds WHERE id = ?', [roundId]); // cascades to holes/players/scores
  });
}

// Replace ALL of a user's rounds with the given set (backup restore, B4). player ids in the backup
// are remapped to the new AUTOINCREMENT ids as each round's players are reinserted, so round_scores
// stay correctly attached. One exclusive transaction — all-or-nothing.
export function replaceRounds(userId: number, rounds: Round[]): Promise<void> {
  return serialize(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM rounds WHERE user_id = ?', [userId]); // cascades
      for (const r of rounds) {
        const res = await txn.runAsync(
          'INSERT INTO rounds (user_id, label, course, played_on, hole_count, finished, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, r.label ?? '', r.course ?? '', r.playedOn ?? '', r.holeCount ?? 18, r.finished ? 1 : 0, new Date().toISOString()]
        );
        const roundId = res.lastInsertRowId;
        for (const h of r.holes ?? []) {
          await txn.runAsync('INSERT INTO round_holes (round_id, hole, par) VALUES (?, ?, ?)', [roundId, h.hole, h.par]);
        }
        const idMap = new Map<number, number>();
        let order = 0;
        for (const p of r.players ?? []) {
          const pr = await txn.runAsync('INSERT INTO round_players (round_id, name, sort_order) VALUES (?, ?, ?)', [roundId, p.name ?? '', order++]);
          idMap.set(p.id, pr.lastInsertRowId);
        }
        for (const s of r.scores ?? []) {
          const newPid = idMap.get(s.playerId);
          if (newPid != null) {
            await txn.runAsync('INSERT INTO round_scores (round_id, player_id, hole, strokes) VALUES (?, ?, ?, ?)', [roundId, newPid, s.hole, s.strokes]);
          }
        }
      }
    });
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
