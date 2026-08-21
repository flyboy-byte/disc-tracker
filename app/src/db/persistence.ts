// PLAN.md Track B — a single source of truth for "every table that holds user data, and
// whether backup.ts actually carries it." The 2026-08-19 bug (full backup silently dropping
// suggest_demotions/suggest_learning until someone noticed by hand) happened because nothing
// forced this list and BackupData's shape to stay in sync. persistence.test.ts parses the real
// schema out of migrations.ts and cross-checks it against this registry, so adding a table via
// a migration without updating this file fails a test, by name, instead of shipping silently.
export interface PersistenceEntry {
  table: string;
  // true = this table's data round-trips through buildBackup()/parseBackup() (backup.ts).
  backedUp: boolean;
  // Why a `backedUp: false` entry is fine — every one of these must have a note, so an
  // exemption is a documented decision, not an unnoticed gap.
  note?: string;
}

export const PERSISTENCE_REGISTRY: PersistenceEntry[] = [
  { table: 'users', backedUp: false, note: 'device-local identity row (v1 is single-user); nothing about it is user data worth restoring' },
  { table: 'discs', backedUp: true },
  { table: 'user_meta', backedUp: true, note: 'covered via BackupData.meta' },
  { table: 'ms_pic_cache', backedUp: false, note: 'reconstructable network-lookup cache, not user data — safe to wipe and refill' },
  { table: 'rounds', backedUp: true },
  { table: 'round_holes', backedUp: true, note: 'covered via BackupData.rounds[].holes' },
  { table: 'round_players', backedUp: true, note: 'covered via BackupData.rounds[].players' },
  { table: 'round_scores', backedUp: true, note: 'covered via BackupData.rounds[].scores' },
  { table: 'custom_discs', backedUp: true, note: 'covered via BackupData.customDiscs' },
  { table: 'suggest_demotions', backedUp: true, note: 'covered via BackupData.suggestDemotions (the exact table v0.24 fixed after it shipped uncovered)' },
  { table: 'suggest_learning', backedUp: true, note: 'covered via BackupData.suggestLearning (the exact table v0.24 fixed after it shipped uncovered)' },
];
