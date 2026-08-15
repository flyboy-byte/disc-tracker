// Bundled disc library — same source data as static/discs_master.json (byte-identical,
// confirmed 2026-07). Loaded via require() so it's baked into the app bundle, no network call.
import raw from '../../assets/discs_master.json';

export interface MasterDisc {
  name: string;
  mfr: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  stability: number;
  type: string;
}

export const masterDiscs: MasterDisc[] = raw as MasterDisc[];

// A disc the user added to their personal library (custom_discs table) — same shape as a bundled
// MasterDisc plus its row id and a flag so the UI can badge it. See migrations.ts / db.ts.
export interface CustomMasterDisc extends MasterDisc {
  id: number;
  custom: true;
}

export type LibraryDisc = MasterDisc | CustomMasterDisc;

export function isCustom(d: LibraryDisc): d is CustomMasterDisc {
  return (d as CustomMasterDisc).custom === true;
}

function matches(d: MasterDisc, q: string): boolean {
  return d.name.toLowerCase().includes(q) || d.mfr.toLowerCase().includes(q);
}

// Prefix matches on the mold name rank first (typing "pa" should surface "PA-5" before any
// disc that merely contains "pa" mid-name), then other name substring hits, then mfr-only hits.
function rank(d: MasterDisc, q: string): number {
  const name = d.name.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.includes(q)) return 1;
  return 2;
}

function sortByRank(discs: MasterDisc[], q: string): MasterDisc[] {
  return [...discs].sort((a, b) => rank(a, q) - rank(b, q));
}

export function searchMaster(query: string, limit = 60): MasterDisc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return sortByRank(masterDiscs.filter((d) => matches(d, q)), q).slice(0, limit);
}

// Search the whole library the user sees: their custom discs first (so a disc they declared always
// ranks above the bundled catalog), then the bundled master list. When `mfr` is already typed
// (the common add-disc flow — manufacturer first, then mold), narrow to that manufacturer first so
// a short mold query like "pa" doesn't get crowded out by unrelated discs that merely contain it.
export function searchLibrary(query: string, custom: CustomMasterDisc[], limit = 60, mfr = ''): LibraryDisc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const mfrQ = mfr.trim().toLowerCase();
  const customHits = sortByRank(custom.filter((d) => matches(d, q)), q);
  let masterHits = masterDiscs.filter((d) => matches(d, q));
  if (mfrQ) {
    const sameMfr = masterHits.filter((d) => d.mfr.toLowerCase().includes(mfrQ));
    const otherMfr = masterHits.filter((d) => !d.mfr.toLowerCase().includes(mfrQ));
    masterHits = [...sortByRank(sameMfr, q), ...sortByRank(otherMfr, q)];
  } else {
    masterHits = sortByRank(masterHits, q);
  }
  return [...customHits, ...masterHits].slice(0, limit);
}
