// Shapes for the optional downloaded catalog pack (catalog-v2). See
// app/plan/docs/catalog-v2-scope.md — hosting/real data is not decided yet; this only
// describes the manifest/pack format the client-side loader/sync code is built against.

export interface CatalogManifest {
  catalogVersion: number;
  provider: string;
  datasetVersion: string;
  schemaVersion: number;
  recordCount: number;
  size: number;
  sha256: string;
  asset: string; // filename or URL of the data pack this manifest describes
}

export function isValidManifest(m: unknown): m is CatalogManifest {
  if (!m || typeof m !== 'object') return false;
  const o = m as Record<string, unknown>;
  return (
    typeof o.catalogVersion === 'number' &&
    typeof o.provider === 'string' &&
    typeof o.datasetVersion === 'string' &&
    typeof o.schemaVersion === 'number' &&
    typeof o.recordCount === 'number' &&
    typeof o.size === 'number' &&
    typeof o.sha256 === 'string' &&
    typeof o.asset === 'string'
  );
}
