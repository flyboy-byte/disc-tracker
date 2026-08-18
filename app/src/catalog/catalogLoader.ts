// Runtime-swappable disc catalog. Defaults to the bundled fallback (masterLibrary.ts, baked
// into the app bundle via require() — always buildable from public source, no network). Two
// more sources can be cached on-device and switched between without re-downloading: 'trydiscs'
// (the Try Discs pack) and 'custom' (a user-imported file or self-hosted manifest URL). Any
// failure at any step here leaves the bundled fallback active — this module must never throw
// past initCatalog(), since a broken catalog file must never break the app. See
// app/plan/docs/catalog-v2-scope.md for the full design.
import { Directory, File, Paths } from 'expo-file-system';
import {
  masterDiscs,
  searchIn,
  searchLibraryIn,
  type MasterDisc,
  type CustomMasterDisc,
  type LibraryDisc,
} from '../utils/masterLibrary';

export const CATALOG_DIR_NAME = 'catalog';
const SOURCE_PREF_FILE = 'source-pref.json';

export type CatalogSource = 'bundled' | 'trydiscs' | 'custom';
export type DownloadableSource = 'trydiscs' | 'custom';

export interface CatalogSlotMeta {
  recordCount: number;
  // Human-readable origin: "Try Discs", a filename, or a URL host.
  label: string;
  datasetVersion?: string;
}

export function catalogDir(): Directory {
  return new Directory(Paths.document, CATALOG_DIR_NAME);
}

export function activeFileName(source: DownloadableSource): string {
  return `${source}-active.json`;
}
export function metaFileName(source: DownloadableSource): string {
  return `${source}-meta.json`;
}

let activeCatalog: MasterDisc[] = masterDiscs;
let activeSource: CatalogSource = 'bundled';
let activeMeta: CatalogSlotMeta | null = null;

export function getCatalog(): MasterDisc[] {
  return activeCatalog;
}

export function getCatalogSource(): CatalogSource {
  return activeSource;
}

// null when the bundled catalog is active — it has no meta pack.
export function getActiveCatalogMeta(): CatalogSlotMeta | null {
  return activeMeta;
}

// Exposed for tests — resets module state between tests without needing app restart.
export function __resetCatalogForTests(): void {
  activeCatalog = masterDiscs;
  activeSource = 'bundled';
  activeMeta = null;
}

export function isValidMasterDisc(d: unknown): d is MasterDisc {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.mfr === 'string' &&
    typeof o.speed === 'number' &&
    typeof o.glide === 'number' &&
    typeof o.turn === 'number' &&
    typeof o.fade === 'number' &&
    typeof o.type === 'string'
  );
}

export function isValidCatalogArray(parsed: unknown): parsed is MasterDisc[] {
  return Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidMasterDisc);
}

// Reads a cached slot's metadata sidecar file, if present. Returns null if the source was never
// downloaded/imported, or if the sidecar is unreadable.
export async function getSlotMeta(source: DownloadableSource): Promise<CatalogSlotMeta | null> {
  try {
    const f = new File(catalogDir(), metaFileName(source));
    if (!f.exists) return null;
    const parsed = JSON.parse(await f.text());
    if (typeof parsed?.recordCount !== 'number' || typeof parsed?.label !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

// Whether a cached catalog file exists for this slot (regardless of whether it's currently
// active) — lets Settings show "tap to switch" vs. "tap to download/import".
export async function isSlotCached(source: DownloadableSource): Promise<boolean> {
  return new File(catalogDir(), activeFileName(source)).exists;
}

async function readSourcePref(): Promise<CatalogSource> {
  try {
    const f = new File(catalogDir(), SOURCE_PREF_FILE);
    if (!f.exists) return 'bundled';
    const { source } = JSON.parse(await f.text());
    return source === 'trydiscs' || source === 'custom' ? source : 'bundled';
  } catch {
    return 'bundled';
  }
}

async function writeSourcePref(source: CatalogSource): Promise<void> {
  try {
    const dir = catalogDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const f = new File(dir, SOURCE_PREF_FILE);
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify({ source }));
  } catch {
    // Non-fatal — worst case the choice doesn't stick and initCatalog falls back to bundled
    // next launch, which is always safe.
  }
}

async function activateFromCache(source: DownloadableSource): Promise<boolean> {
  try {
    const file = new File(catalogDir(), activeFileName(source));
    if (!file.exists) return false;
    const parsed = JSON.parse(await file.text());
    if (!isValidCatalogArray(parsed)) return false;
    activeCatalog = parsed;
    activeSource = source;
    activeMeta = await getSlotMeta(source);
    return true;
  } catch {
    return false;
  }
}

// Call once during app startup (alongside openDatabase()). Never throws — restores whichever
// source was last selected, if its cached file is still present and valid; otherwise falls back
// to bundled and corrects the stored preference so it doesn't keep retrying a broken file.
export async function initCatalog(): Promise<void> {
  const pref = await readSourcePref();
  if (pref === 'bundled') return;
  const ok = await activateFromCache(pref);
  if (!ok) await writeSourcePref('bundled');
}

// Switches the active catalog to a source that's already cached on disk (or to 'bundled', which
// is always available). Returns false if the requested source isn't cached/valid — the caller
// should download/import it first. Persists the choice so it survives an app restart.
export async function switchToSource(source: CatalogSource): Promise<boolean> {
  if (source === 'bundled') {
    activeCatalog = masterDiscs;
    activeSource = 'bundled';
    activeMeta = null;
    await writeSourcePref('bundled');
    return true;
  }
  const ok = await activateFromCache(source);
  if (ok) await writeSourcePref(source);
  return ok;
}

export function searchCatalog(query: string, limit = 60): MasterDisc[] {
  return searchIn(getCatalog(), query, limit);
}

export function searchLibraryCatalog(query: string, custom: CustomMasterDisc[], limit = 60, mfr = ''): LibraryDisc[] {
  return searchLibraryIn(getCatalog(), query, custom, limit, mfr);
}
