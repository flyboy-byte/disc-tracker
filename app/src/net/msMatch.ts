// Pure matching logic for Marshall Street reference images — no I/O, no React, no db, so it's
// unit-testable in plain Jest. Ports the exact match rules from app.py's fetch_ms_pic():
//   - query DiscIt by mold name
//   - accept a result only if its name matches the mold exactly (case-insensitive)
//   - and its brand overlaps the disc's manufacturer (substring either direction)
//   - take the first such result that carries a usable image URL.
// The one addition over the website: we require the URL be https:// here (not just server-side),
// since on the app it goes straight into a native <Image> — an http/file/other-scheme URL from a
// misbehaving upstream should never be loaded.

export const MS_API_BASE = 'https://discit-api.fly.dev/disc';

export interface DiscItResult {
  brand?: string;
  name?: string;
  pic?: string;
}

// Cache key matches app.py's _ms_lookup_key: "mfr|mold", trimmed + lowercased.
export function msLookupKey(mfr: string, mold: string): string {
  return `${(mfr || '').trim().toLowerCase()}|${(mold || '').trim().toLowerCase()}`;
}

export function matchPic(results: DiscItResult[], mfr: string, mold: string): string | null {
  const wantMold = (mold || '').trim().toLowerCase();
  const wantMfr = (mfr || '').trim().toLowerCase();
  if (!wantMold) return null;
  for (const r of results) {
    if (String(r.name ?? '').trim().toLowerCase() !== wantMold) continue;
    const brand = String(r.brand ?? '').trim().toLowerCase();
    // Empty mfr on our side → don't filter on brand (matches app.py: `if mfr and ...`).
    if (wantMfr && !brand.includes(wantMfr) && !wantMfr.includes(brand)) continue;
    const pic = String(r.pic ?? '');
    if (pic.startsWith('https://')) return pic;
  }
  return null;
}
