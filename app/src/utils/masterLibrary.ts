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

export function searchMaster(query: string, limit = 60): MasterDisc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return masterDiscs
    .filter((d) => d.name.toLowerCase().includes(q) || d.mfr.toLowerCase().includes(q))
    .slice(0, limit);
}
