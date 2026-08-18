// Azeem (Try Discs) approved Option C — VPS-hosted, app-downloaded, never committed to the
// public repo. See app/plan/docs/catalog-v2-scope.md. Shared by Settings (the manual "Check for
// updates" / picker flow) and the app-level first-run prompt, so both point at the same URL.
export const TRYDISCS_MANIFEST_URL = 'https://disc.flyboybyte.com/catalog/manifest.json';
// The only Try Discs URL confirmed to exist from Azeem's own correspondence — their public
// marketing site's URL wasn't given, so this points at the documented API instead of guessing.
export const TRYDISCS_URL = 'https://api.trydiscs.com';
