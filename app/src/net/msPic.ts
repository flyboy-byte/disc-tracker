// Marshall Street reference images — network + cache orchestration.
//
// FOSS/F-Droid privacy contract (PORT_PLAN.md "Network-feature privacy bar"):
//   - The ONLY host this app ever contacts. One request, user-initiated: it fires only when the
//     user has enabled the feature in Settings AND opens a disc's detail sheet in RHBH view.
//   - No request on launch, in the background, or on a cache hit — once a disc is cached the
//     feature is fully offline.
//   - Fails silently: any error/timeout/offline returns null and the UI keeps the computed arc.
//   - Never throws.
//
// RHBH-only, because the Marshall Street flight-path image is a real measured RHBH throw — it has
// no meaning for the other three throw views (same restriction the website enforces).
import { getCachedMsPic, putCachedMsPic } from '../db/db';
import { matchPic, msLookupKey, MS_API_BASE, type DiscItResult } from './msMatch';

const TIMEOUT_MS = 3500;

// Returns the reference-image URL for a disc, or null if there's no match / we're offline / the
// lookup failed. Consults the local cache first; only hits the network on a cache miss, and only
// writes back to the cache on a definitive API response (so an offline miss doesn't get frozen in
// as a permanent "not found").
export async function fetchMsPicUrl(mfr: string, mold: string): Promise<string | null> {
  const cleanMold = (mold || '').trim();
  if (!cleanMold) return null;

  const key = msLookupKey(mfr, cleanMold);
  const cached = await getCachedMsPic(key);
  if (cached !== undefined) return cached || null; // '' = confirmed no match

  let matched: string | null = null;
  let definitive = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let results: DiscItResult[] = [];
    try {
      const resp = await fetch(`${MS_API_BASE}?name=${encodeURIComponent(cleanMold)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (resp.ok) {
        const body = await resp.json();
        results = Array.isArray(body) ? body : [];
        definitive = true; // got a real answer — safe to cache the outcome (match or not)
      }
    } finally {
      clearTimeout(timer);
    }
    if (definitive) matched = matchPic(results, mfr, cleanMold);
  } catch {
    // Offline, aborted, or malformed JSON — leave definitive=false so we retry next time.
    definitive = false;
  }

  if (definitive) {
    // Cache the URL, or '' to record a confirmed no-match (so we never refetch it).
    await putCachedMsPic(key, matched ?? '');
  }
  return matched;
}
