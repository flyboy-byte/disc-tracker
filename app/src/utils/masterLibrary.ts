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

export function searchMaster(query: string, limit = 60): MasterDisc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return masterDiscs.filter((d) => matches(d, q)).slice(0, limit);
}

// Search the whole library the user sees: their custom discs first (so a disc they declared always
// ranks above the bundled catalog), then the bundled master list.
export function searchLibrary(query: string, custom: CustomMasterDisc[], limit = 60): LibraryDisc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const customHits = custom.filter((d) => matches(d, q));
  const masterHits = masterDiscs.filter((d) => matches(d, q));
  return [...customHits, ...masterHits].slice(0, limit);
}
