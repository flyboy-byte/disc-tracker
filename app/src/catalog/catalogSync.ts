// Manifest-check / download / verify / atomic-swap logic for the optional downloaded catalog.
// This is decision-independent scaffolding — the manifest URL is never set to anything real
// until hosting is decided with Try Discs. See app/plan/docs/catalog-v2-scope.md.
//
// Every step here fails closed: any error at any point leaves the currently-active catalog
// (bundled fallback or a prior downloaded one) completely untouched. Nothing is activated until
// the downloaded content has been hash-verified and schema-validated.
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { isValidManifest, type CatalogManifest } from './types';
import { catalogDir, isValidCatalogArray, ACTIVE_FILE_NAME, PREVIOUS_FILE_NAME } from './catalogLoader';

export class CatalogSyncError extends Error {}

export async function checkManifest(manifestUrl: string): Promise<CatalogManifest> {
  const resp = await fetch(manifestUrl);
  if (!resp.ok) throw new CatalogSyncError(`Manifest fetch failed: ${resp.status} ${resp.statusText}`);
  const json = await resp.json();
  if (!isValidManifest(json)) throw new CatalogSyncError('Manifest failed shape validation.');
  return json;
}

function resolveAssetUrl(manifestUrl: string, asset: string): string {
  if (/^https?:\/\//i.test(asset)) return asset;
  return new URL(asset, manifestUrl).toString();
}

// Downloads + hash-verifies + schema-validates the catalog pack, writing it to a temp file.
// Returns the temp File — nothing is activated yet (see activateCatalog).
export async function downloadAndVerify(manifest: CatalogManifest, manifestUrl: string): Promise<File> {
  const assetUrl = resolveAssetUrl(manifestUrl, manifest.asset);
  const resp = await fetch(assetUrl);
  if (!resp.ok) throw new CatalogSyncError(`Catalog download failed: ${resp.status} ${resp.statusText}`);
  const text = await resp.text();

  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
  if (hash.toLowerCase() !== manifest.sha256.toLowerCase()) {
    throw new CatalogSyncError('Catalog hash mismatch — refusing to activate.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CatalogSyncError('Downloaded catalog is not valid JSON.');
  }
  if (!isValidCatalogArray(parsed)) {
    throw new CatalogSyncError('Downloaded catalog failed schema validation.');
  }

  const dir = catalogDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const tmpFile = new File(dir, `tmp-v${manifest.catalogVersion}.json`);
  if (tmpFile.exists) tmpFile.delete();
  tmpFile.create();
  tmpFile.write(text);
  return tmpFile;
}

// Atomically (as atomic as the filesystem allows) swaps the verified temp file in as the active
// catalog, keeping the previous active catalog around as a rollback point.
export async function activateCatalog(tmpFile: File): Promise<void> {
  const dir = catalogDir();
  const activePath = new File(dir, ACTIVE_FILE_NAME);
  const previousPath = new File(dir, PREVIOUS_FILE_NAME);

  if (activePath.exists) {
    if (previousPath.exists) previousPath.delete();
    await activePath.move(previousPath);
  }
  await tmpFile.move(new File(dir, ACTIVE_FILE_NAME));
}

// Restores the previously-active catalog, if one was kept. Returns false if there's nothing to
// roll back to (caller falls back to the bundled catalog, which is always available).
export async function rollbackCatalog(): Promise<boolean> {
  const dir = catalogDir();
  const previousPath = new File(dir, PREVIOUS_FILE_NAME);
  if (!previousPath.exists) return false;
  const activePath = new File(dir, ACTIVE_FILE_NAME);
  if (activePath.exists) activePath.delete();
  await previousPath.move(new File(dir, ACTIVE_FILE_NAME));
  return true;
}

export interface SyncResult {
  manifest: CatalogManifest;
}

// Full pipeline: check manifest -> download+verify -> activate. Call catalogLoader's
// initCatalog() again afterward (or restart the app) to pick up the newly-activated catalog —
// this function only updates the file on disk, it doesn't mutate the in-memory active catalog.
export async function syncCatalog(manifestUrl: string): Promise<SyncResult> {
  const manifest = await checkManifest(manifestUrl);
  const tmpFile = await downloadAndVerify(manifest, manifestUrl);
  await activateCatalog(tmpFile);
  return { manifest };
}
