// Runtime-swappable disc catalog. Defaults to the bundled fallback (masterLibrary.ts, baked
// into the app bundle via require() — always buildable from public source, no network). If a
// previously-downloaded, verified catalog pack exists in app-private storage, initCatalog()
// swaps to it instead. Any failure at any step here leaves the bundled fallback active — this
// module must never throw past initCatalog(), since a broken catalog file must never break the
// app. See app/plan/docs/catalog-v2-scope.md for the full design.
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
export const ACTIVE_FILE_NAME = 'active.json';
export const PREVIOUS_FILE_NAME = 'active-previous.json';

export function catalogDir(): Directory {
  return new Directory(Paths.document, CATALOG_DIR_NAME);
}

export type CatalogSource = 'bundled' | 'downloaded';

let activeCatalog: MasterDisc[] = masterDiscs;
let activeSource: CatalogSource = 'bundled';

export function getCatalog(): MasterDisc[] {
  return activeCatalog;
}

export function getCatalogSource(): CatalogSource {
  return activeSource;
}

// Exposed for tests — resets module state between tests without needing app restart.
export function __resetCatalogForTests(): void {
  activeCatalog = masterDiscs;
  activeSource = 'bundled';
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

// Call once during app startup (alongside openDatabase()). Never throws — any problem reading
// or parsing a previously-downloaded catalog just leaves the bundled fallback in place.
export async function initCatalog(): Promise<void> {
  try {
    const file = new File(catalogDir(), ACTIVE_FILE_NAME);
    if (!file.exists) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (isValidCatalogArray(parsed)) {
      activeCatalog = parsed;
      activeSource = 'downloaded';
    }
  } catch {
    // Bundled fallback stays active — see module doc comment.
  }
}

export function searchCatalog(query: string, limit = 60): MasterDisc[] {
  return searchIn(getCatalog(), query, limit);
}

export function searchLibraryCatalog(query: string, custom: CustomMasterDisc[], limit = 60, mfr = ''): LibraryDisc[] {
  return searchLibraryIn(getCatalog(), query, custom, limit, mfr);
}
