// Download/verify/import logic for the two cacheable catalog slots ('trydiscs' and 'custom').
// See app/plan/docs/catalog-v2-scope.md.
//
// Every path here fails closed: any error at any point leaves the currently-active catalog and
// every already-cached slot completely untouched. Nothing is written to a slot's active file
// until the new content has been hash-verified (network path) or schema-validated (file path).
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { isValidManifest, type CatalogManifest } from './types';
import {
  catalogDir,
  isValidCatalogArray,
  activeFileName,
  metaFileName,
  type DownloadableSource,
  type CatalogSlotMeta,
} from './catalogLoader';

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
// Returns the temp File — nothing is activated yet (see writeSlot).
export async function downloadAndVerify(manifest: CatalogManifest, manifestUrl: string, target: DownloadableSource): Promise<File> {
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
  const tmpFile = new File(dir, `${target}-tmp-v${manifest.catalogVersion}.json`);
  if (tmpFile.exists) tmpFile.delete();
  tmpFile.create();
  tmpFile.write(text);
  return tmpFile;
}

// Moves an already-verified temp file into place as the given slot's active file, and writes
// its metadata sidecar. Overwrites anything previously cached for that slot.
async function writeSlot(tmpFile: File, target: DownloadableSource, meta: CatalogSlotMeta): Promise<void> {
  const dir = catalogDir();
  const activePath = new File(dir, activeFileName(target));
  if (activePath.exists) activePath.delete();
  await tmpFile.move(activePath);

  const metaPath = new File(dir, metaFileName(target));
  if (metaPath.exists) metaPath.delete();
  metaPath.create();
  metaPath.write(JSON.stringify(meta));
}

export interface SyncResult {
  manifest: CatalogManifest;
}

// Full pipeline for the Try Discs slot: check manifest -> download+verify -> cache. Call
// catalogLoader's switchToSource('trydiscs') afterward to activate it.
export async function syncTryDiscsCatalog(manifestUrl: string): Promise<SyncResult> {
  const manifest = await checkManifest(manifestUrl);
  const tmpFile = await downloadAndVerify(manifest, manifestUrl, 'trydiscs');
  await writeSlot(tmpFile, 'trydiscs', {
    recordCount: manifest.recordCount,
    label: manifest.provider || 'Try Discs',
    datasetVersion: manifest.datasetVersion,
    provider: manifest.provider,
  });
  return { manifest };
}

// Same pipeline, aimed at the 'custom' slot — for a self-hosted manifest+asset pair the user
// points the app at directly (same format Try Discs uses). Note: this can legitimately end up
// holding Try Discs' own data too (nothing stops a user pointing "Custom" at the same manifest
// URL) — attribution is keyed off `manifest.provider`, not which slot the data landed in, so the
// credit still shows correctly either way.
export async function syncCustomCatalogFromUrl(manifestUrl: string): Promise<SyncResult> {
  const manifest = await checkManifest(manifestUrl);
  const tmpFile = await downloadAndVerify(manifest, manifestUrl, 'custom');
  let label = manifest.provider || 'Custom';
  try {
    label = new URL(manifestUrl).host;
  } catch {
    // Keep the manifest-provided label if the URL somehow doesn't parse.
  }
  await writeSlot(tmpFile, 'custom', {
    recordCount: manifest.recordCount,
    label,
    datasetVersion: manifest.datasetVersion,
    provider: manifest.provider,
  });
  return { manifest };
}

// Imports a local JSON file (from the document picker) straight into the 'custom' slot — no
// hash to check since it isn't fetched over the network; schema validation is the only gate.
export async function importCustomCatalogFromFile(fileUri: string, fileName: string): Promise<{ recordCount: number }> {
  const text = await new File(fileUri).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CatalogSyncError('That file is not valid JSON.');
  }
  if (!isValidCatalogArray(parsed)) {
    throw new CatalogSyncError("That file doesn't match the expected disc catalog format.");
  }

  const dir = catalogDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const activePath = new File(dir, activeFileName('custom'));
  if (activePath.exists) activePath.delete();
  activePath.create();
  activePath.write(text);

  const metaPath = new File(dir, metaFileName('custom'));
  if (metaPath.exists) metaPath.delete();
  metaPath.create();
  const recordCount = (parsed as unknown[]).length;
  metaPath.write(JSON.stringify({ recordCount, label: fileName }));
  return { recordCount };
}
