#!/usr/bin/env node
// PLAN.md Track C — fails CI if the merged AndroidManifest.xml (after Expo's config-plugin
// merge, i.e. what actually ships) declares a permission not on the explicit allowlist below.
// This is the exact class of bug that shipped SYSTEM_ALERT_WINDOW undisclosed for an unknown
// number of releases before the 2026-08-20 privacy audit caught it by hand-reading the
// manifest. Run against a freshly-`expo prebuild`'d android/ — never a stale committed copy
// (that's the whole reason `expo prebuild --clean` proved a hand-edited android/ isn't durable).
const fs = require('fs');
const path = require('path');

// The 4 permissions docs/privacy.html already discloses. Any other <uses-permission> in the
// merged manifest fails the build — extend this list (and privacy.html, and README.md) in the
// same commit that adds a new one, never silently.
const ALLOWED = new Set([
  'android.permission.INTERNET',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.VIBRATE',
]);

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found at ${manifestPath} — run "npx expo prebuild -p android --clean" first.`);
  process.exit(1);
}

const xml = fs.readFileSync(manifestPath, 'utf8');
// Expo's `blockedPermissions` (app.json) emits `<uses-permission ... tools:node="remove"/>`
// rather than deleting the line — the Android manifest merger strips these at build time, so a
// permission tagged this way never actually ships. Match the whole tag so that directive can be
// checked before counting it as "found."
const found = [...xml.matchAll(/<uses-permission\b[^>]*\/>/g)]
  .map((m) => m[0])
  .filter((tag) => !/tools:node="remove"/.test(tag))
  .map((tag) => {
    const nameMatch = tag.match(/android:name="([^"]+)"/);
    return nameMatch ? nameMatch[1] : null;
  })
  .filter(Boolean);

const unapproved = found.filter((p) => !ALLOWED.has(p));

if (unapproved.length > 0) {
  console.error('Unapproved permission(s) in the merged AndroidManifest.xml:');
  for (const p of unapproved) console.error(`  - ${p}`);
  console.error('\nIf this is intentional, add it to ALLOWED in scripts/check-manifest-permissions.js AND disclose it in docs/privacy.html + README.md in the same commit.');
  process.exit(1);
}

console.log(`OK — ${found.length} permission(s) found, all on the allowlist:`);
for (const p of found) console.log(`  - ${p}`);
