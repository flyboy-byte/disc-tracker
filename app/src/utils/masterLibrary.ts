// The app ships with NO bundled disc data (removed 2026-10-18: the old bundle's provenance couldn't
// be confirmed). The catalog is empty until the user downloads the Try Discs catalog or imports
// their own file — see catalogLoader.ts. If a simple, genuinely open default dataset turns up,
// load it here.
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

export const masterDiscs: MasterDisc[] = [];

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

// Generic versions parameterized by the disc list to search — lets catalogLoader.ts search
// whatever catalog is currently active (bundled fallback or a downloaded override) by reusing
// this exact ranking logic, instead of duplicating it.
export function searchIn(discs: MasterDisc[], query: string, limit = 60): MasterDisc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return sortByRank(discs.filter((d) => matches(d, q)), q).slice(0, limit);
}

export function searchLibraryIn(discs: MasterDisc[], query: string, custom: CustomMasterDisc[], limit = 60, mfr = ''): LibraryDisc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const mfrQ = mfr.trim().toLowerCase();
  const customHits = sortByRank(custom.filter((d) => matches(d, q)), q);
  let masterHits = discs.filter((d) => matches(d, q));
  if (mfrQ) {
    const sameMfr = masterHits.filter((d) => d.mfr.toLowerCase().includes(mfrQ));
    const otherMfr = masterHits.filter((d) => !d.mfr.toLowerCase().includes(mfrQ));
    masterHits = [...sortByRank(sameMfr, q), ...sortByRank(otherMfr, q)];
  } else {
    masterHits = sortByRank(masterHits, q);
  }
  return [...customHits, ...masterHits].slice(0, limit);
}

export function searchMaster(query: string, limit = 60): MasterDisc[] {
  return searchIn(masterDiscs, query, limit);
}

// Search the whole library the user sees: their custom discs first (so a disc they declared always
// ranks above the bundled catalog), then the bundled master list. When `mfr` is already typed
// (the common add-disc flow — manufacturer first, then mold), narrow to that manufacturer first so
// a short mold query like "pa" doesn't get crowded out by unrelated discs that merely contain it.
export function searchLibrary(query: string, custom: CustomMasterDisc[], limit = 60, mfr = ''): LibraryDisc[] {
  return searchLibraryIn(masterDiscs, query, custom, limit, mfr);
}
