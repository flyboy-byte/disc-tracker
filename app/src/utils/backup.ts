// Full-device backup (B4) — replaces the dropped VPS sync. A single JSON file captures EVERYTHING
// (discs with in-bag/color/order, settings, and scorekeeper rounds), so you move your whole app to a
// new device with any file transfer — AirDrop, email, your own cloud — no server, no account. CSV
// export stays for disc-list interop (it can't carry in-bag flags, settings, or rounds); this is the
// "move me to a new phone" path. See app/plan/docs/... roadmap B4.
import type { Disc } from './disc';
import type { Round } from './roundMath';
import type { CustomMasterDisc } from './masterLibrary';
import type { LearningState } from './suggestScore';

// suggest-swipe-scope.md's per-scenario manual reorder — kept as a plain shape here (not
// imported from db.ts) so this module stays DB-agnostic, same as every other type above.
export interface BackupDemotion {
  listKey: string;
  discKey: string;
  position: number;
}

const DEFAULT_LEARNING: LearningState = {
  avoidSpeed: 0,
  avoidGlide: 0,
  avoidTurn: 0,
  avoidFade: 0,
  avoidStrength: 0,
  brandAversion: {},
  engineEnabled: true,
};

export interface BackupMeta {
  sortMode: string;
  arcView: string;
  skill: string;
  // Optional + additive, same tolerant pattern as everything else here: absent in pre-2026-08
  // backups, which default to 'backhand' (the pre-existing, unbiased behavior) on restore.
  throwStyle?: string;
  // Optional + additive, same pattern — absent in pre-2026-08-16 backups, defaults to
  // 'throwing' (today's behavior) on restore.
  suggestMode?: string;
  msRefEnabled: boolean;
  fieldShowAll: boolean;
}

export interface BackupData {
  version: 1;
  exportedAt: string;
  discs: Disc[];
  meta: BackupMeta;
  rounds: Round[];
  // Optional + additive: the personal custom-disc library. Absent in pre-2026-08 backups, which
  // parse to [] — so old files restore cleanly and never wipe an existing library by surprise.
  customDiscs: CustomMasterDisc[];
  // Optional + additive (suggest-swipe-scope.md, 2026-08-19): Disc Suggest's swipe-to-dismiss
  // state. Absent in older backups, which parse to "nothing swiped/learned yet" — restoring an
  // old backup never wipes a device's existing swipe history, it just doesn't carry any over.
  suggestDemotions: BackupDemotion[];
  suggestLearning: LearningState;
}

const DEFAULT_META: BackupMeta = {
  sortMode: 'speed-desc',
  arcView: 'RHBH',
  skill: 'intermediate',
  throwStyle: 'backhand',
  suggestMode: 'throwing',
  msRefEnabled: false,
  fieldShowAll: false,
};

export function buildBackup(
  discs: Disc[],
  meta: BackupMeta,
  rounds: Round[],
  customDiscs: CustomMasterDisc[] = [],
  suggestDemotions: BackupDemotion[] = [],
  suggestLearning: LearningState = DEFAULT_LEARNING
): string {
  const data: BackupData = { version: 1, exportedAt: new Date().toISOString(), discs, meta, rounds, customDiscs, suggestDemotions, suggestLearning };
  return JSON.stringify(data, null, 2);
}

// Parse + validate a backup file. Throws with a friendly message if it's not one (e.g. a CSV or
// unrelated JSON). Tolerant of missing optional sections (older/partial backups) — discs is the only
// hard requirement; meta and rounds default to empty.
export function parseBackup(text: string): BackupData {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("This doesn't look like a backup file (not valid JSON).");
  }
  if (!obj || typeof obj !== 'object') throw new Error('This backup file is empty or malformed.');
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.discs)) throw new Error("This file isn't a Disc Tracker backup (no discs).");
  const meta = (o.meta && typeof o.meta === 'object' ? o.meta : {}) as Partial<BackupMeta>;
  return {
    version: 1,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
    discs: o.discs as Disc[],
    meta: {
      sortMode: meta.sortMode ?? DEFAULT_META.sortMode,
      arcView: meta.arcView ?? DEFAULT_META.arcView,
      skill: meta.skill ?? DEFAULT_META.skill,
      throwStyle: meta.throwStyle ?? DEFAULT_META.throwStyle,
      suggestMode: meta.suggestMode ?? DEFAULT_META.suggestMode,
      msRefEnabled: !!meta.msRefEnabled,
      fieldShowAll: !!meta.fieldShowAll,
    },
    rounds: Array.isArray(o.rounds) ? (o.rounds as Round[]) : [],
    customDiscs: Array.isArray(o.customDiscs) ? (o.customDiscs as CustomMasterDisc[]) : [],
    suggestDemotions: Array.isArray(o.suggestDemotions) ? (o.suggestDemotions as BackupDemotion[]) : [],
    suggestLearning: o.suggestLearning && typeof o.suggestLearning === 'object' ? { ...DEFAULT_LEARNING, ...(o.suggestLearning as Partial<LearningState>) } : DEFAULT_LEARNING,
  };
}

// A short human summary for the restore-confirmation dialog.
export function backupSummary(b: BackupData): string {
  const parts = [`${b.discs.length} disc${b.discs.length === 1 ? '' : 's'}`];
  if (b.rounds.length) parts.push(`${b.rounds.length} round${b.rounds.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
