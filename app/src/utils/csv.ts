// Exact port of the CSV export/import logic in templates/index.html (buildCSV, csvCell,
// parseCSV, discKey, and the dedupe/cap behavior in previewImport). Column order and header
// names must stay byte-identical to the website's, since export/import round-trips between
// the two are a documented parity requirement (see PORT_PLAN.md Phase 7).

import type { Disc } from './disc';

export const MAX_IMPORT = 500;

function csvCell(s: unknown): string {
  const str = String(s ?? '');
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

export function buildCSV(discs: Disc[]): string {
  const hdr = 'Manufacturer,Mold,Plastic,Weight,Speed,Glide,Turn,Fade,Primary Use,Throw Style,Notes\n';
  const rows = discs
    .map((d) =>
      [d.mfr, d.mold, d.plastic || 'Unknown', d.weight || 'Unknown', d.speed, d.glide, d.turn, d.fade, d.use, d.thr, d.notes || '']
        .map(csvCell)
        .join(',')
    )
    .join('\n');
  return hdr + rows;
}

function splitRow(row: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (q) {
      if (c === '"' && row[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        q = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') q = true;
      else if (c === ',') {
        cells.push(cell);
        cell = '';
      } else cell += c;
    }
  }
  cells.push(cell);
  return cells;
}

export function parseCSV(text: string): Disc[] {
  const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (rows.length < 2) return [];
  const headers = splitRow(rows[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);
  const result: Disc[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i].trim()) continue;
    const v = splitRow(rows[i]);
    const get = (name: string) => (v[col(name)] || '').trim();
    const mold = get('mold');
    if (!mold) continue;
    const plastic = get('plastic');
    const weight = get('weight');
    result.push({
      mfr: get('manufacturer'),
      mold,
      plastic: plastic === 'Unknown' ? '' : plastic,
      weight: weight === 'Unknown' ? '' : weight,
      speed: parseFloat(get('speed')) || 0,
      glide: parseFloat(get('glide')) || 0,
      turn: parseFloat(get('turn')) || 0,
      fade: parseFloat(get('fade')) || 0,
      use: get('primary use'),
      thr: get('throw style'),
      notes: get('notes'),
      color: '',
    });
  }
  return result;
}

export function discKey(d: Pick<Disc, 'mfr' | 'mold' | 'plastic' | 'weight'>): string {
  return [d.mfr, d.mold, d.plastic, d.weight].map((s) => String(s || '').trim().toLowerCase()).join('|');
}

export interface ImportPreview {
  discs: Disc[];
  duplicatesSkipped: number;
  truncated: boolean;
}

// Dedupes against both the existing bag and duplicates within the pasted file itself, and
// caps at MAX_IMPORT — matches the website's previewImport() behavior exactly.
export function previewImport(rawText: string, existingDiscs: Disc[]): ImportPreview {
  const parsed = parseCSV(rawText);
  const existingKeys = new Set(existingDiscs.map(discKey));
  const seen = new Set<string>();
  let duplicatesSkipped = 0;
  let discs = parsed.filter((d) => {
    const key = discKey(d);
    if (existingKeys.has(key) || seen.has(key)) {
      duplicatesSkipped++;
      return false;
    }
    seen.add(key);
    return true;
  });
  const truncated = discs.length > MAX_IMPORT;
  if (truncated) discs = discs.slice(0, MAX_IMPORT);
  return { discs, duplicatesSkipped, truncated };
}
