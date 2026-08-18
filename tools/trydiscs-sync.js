#!/usr/bin/env node
// Developer-only tool (NOT shipped, NOT app UI): pull the TryDiscs catalog (api.trydiscs.com)
// and reconcile it against the current bundled master library (static/discs_master.json).
//
// This is Phase 1 of the TryDiscs integration ONLY — it writes nothing outside
// tools/.trydiscs-cache/ (gitignored) and never touches static/discs_master.json or
// app/assets/discs_master.json. See the plan this came from for the full context: nothing
// from TryDiscs' catalog is committed to the repo until packaging is coordinated with them.
//
// Usage:
//   export TRYDISCS_API_KEY="..."      # set this yourself, never commit it
//   node tools/trydiscs-sync.js check      # cheap: is there a newer dataset_version upstream?
//   node tools/trydiscs-sync.js fetch      # pull the full catalog into the local cache
//   node tools/trydiscs-sync.js reconcile  # compare cached pull against our library
//   node tools/trydiscs-sync.js generate   # build a catalog-vN.json + manifest.json data pack
//   node tools/trydiscs-sync.js publish    # scp the generated pack to the VPS's private data dir
//
//   fetch --force   re-fetch even if the cached dataset_version is unchanged
//   publish --dry-run   print the scp command instead of running it
//
// The maintainer runbook (when `check` finds something new):
//   check -> reconcile (READ the report — sanity-check new-count and flight-number drift before
//   going any further) -> generate -> publish. Never skip straight from check to publish; the
//   whole point of reconcile is catching a bad pull before it goes live to real users.
//
// `publish` is intentionally separate from deploy.sh — deploy.sh pushes CODE via git; this
// pushes PRIVATE DATA via scp straight to data/catalog/ on the VPS, which is gitignored and
// never touched by `git pull`. That separation is the whole point: the generated TryDiscs
// catalog must never land in the public GitHub repo (Try Discs' own term of use).
//
// `generate` output (catalog-vN.json + manifest.json) stays inside tools/.trydiscs-cache/
// (gitignored) — same as fetch/reconcile. This is the format app/src/catalog/ consumes, built
// so the full client pipeline (manifest -> download -> verify -> activate) can be dry-run
// locally against a real TryDiscs pull without deciding real hosting or touching the repo.
// See app/plan/docs/catalog-v2-scope.md.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const API_BASE = 'https://api.trydiscs.com/v1';
const PAGE_LIMIT = 2000;
const SCHEMA_VERSION = 1;

// Same VPS/user deploy.sh already uses (ubuntu@51.81.80.126) -- publishing via SSH/SCP goes
// straight to the IP that's already a trusted known_host, not the public HTTPS domain
// (disc.flyboybyte.com), which is a separate, unrelated hostname for the app's own requests.
const PUBLISH_HOST = 'ubuntu@51.81.80.126';
const PUBLISH_PATH = '~/disc_tracker/data/catalog/';

const CACHE_DIR = path.join(__dirname, '.trydiscs-cache');
const CATALOG_CACHE = path.join(CACHE_DIR, 'catalog.json');
const VERSION_CACHE = path.join(CACHE_DIR, 'version.json');
const REPORT_MD = path.join(CACHE_DIR, 'reconciliation-report.md');
const REPORT_JSON = path.join(CACHE_DIR, 'reconciliation-report.json');
const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json');

const MASTER_PATH = path.join(__dirname, '..', 'static', 'discs_master.json');

// TryDiscs lowercase type -> our Innova-style bucket labels.
const TYPE_MAP = {
  putter: 'Putt & Approach',
  'putt & approach': 'Putt & Approach',
  midrange: 'Mid Range',
  'mid range': 'Mid Range',
  'control driver': 'Control Driver',
  'fairway driver': 'Control Driver',
  'distance driver': 'Distance Driver',
};

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

async function fetchPage(offset, apiKey) {
  const url = `${API_BASE}/discs?limit=${PAGE_LIMIT}&offset=${offset}`;
  const resp = await fetch(url, { headers: { 'X-API-Key': apiKey } });
  if (!resp.ok) {
    fail(`TryDiscs API returned ${resp.status} ${resp.statusText} for offset=${offset}.`);
  }
  return resp.json();
}

// Cheap check: one page (just for its meta.dataset_version), no full fetch, no cache writes.
// Safe to run often — this is the thing to actually remember to do periodically, since there's
// no automation here on purpose (no cron, no CI — matches this project's no-unattended-jobs
// posture).
async function cmdCheck() {
  const apiKey = process.env.TRYDISCS_API_KEY;
  if (!apiKey) {
    fail('TRYDISCS_API_KEY is not set. Export it yourself first: export TRYDISCS_API_KEY="..."');
  }

  const first = await fetchPage(0, apiKey);
  const liveVersion = first?.meta?.dataset_version ?? 'unknown';
  const cachedVersion = fs.existsSync(VERSION_CACHE) ? JSON.parse(fs.readFileSync(VERSION_CACHE, 'utf8')).dataset_version : null;

  if (cachedVersion === liveVersion) {
    console.log(`✓ Up to date (dataset_version: ${liveVersion}).`);
  } else if (cachedVersion == null) {
    console.log(`No local cache yet. Live dataset_version: ${liveVersion}.`);
    console.log('  Run: fetch -> reconcile (read it!) -> generate -> publish');
  } else {
    console.log(`⚠ NEW dataset available: ${cachedVersion} -> ${liveVersion}`);
    console.log('  Run: fetch -> reconcile (read it!) -> generate -> publish');
  }
}

async function cmdFetch(args) {
  const apiKey = process.env.TRYDISCS_API_KEY;
  if (!apiKey) {
    fail('TRYDISCS_API_KEY is not set. Export it yourself first: export TRYDISCS_API_KEY="..."');
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Skip re-fetch if the cached dataset_version is unchanged, unless --force.
  if (!args.includes('--force') && fs.existsSync(VERSION_CACHE) && fs.existsSync(CATALOG_CACHE)) {
    const first = await fetchPage(0, apiKey);
    const cachedVersion = JSON.parse(fs.readFileSync(VERSION_CACHE, 'utf8')).dataset_version;
    if (first?.meta?.dataset_version && first.meta.dataset_version === cachedVersion) {
      console.log(`✓ Dataset unchanged (version ${cachedVersion}) — using existing cache. Use --force to re-fetch anyway.`);
      return;
    }
  }

  let all = [];
  let offset = 0;
  let total = Infinity;
  let datasetVersion = null;

  while (offset < total) {
    const page = await fetchPage(offset, apiKey);
    const discs = page.discs || page.data || page.results || [];
    if (!Array.isArray(discs)) {
      fail('Unexpected response shape from TryDiscs API — no discs array found. Inspect the API response manually.');
    }
    all = all.concat(discs);
    datasetVersion = page.meta?.dataset_version ?? datasetVersion;
    total = page.meta?.total ?? discs.length + offset;
    offset += PAGE_LIMIT;
    if (discs.length === 0) break; // safety valve against an infinite loop
  }

  fs.writeFileSync(CATALOG_CACHE, JSON.stringify(all));
  fs.writeFileSync(VERSION_CACHE, JSON.stringify({ dataset_version: datasetVersion, fetchedAt: new Date().toISOString(), count: all.length }));

  console.log(`✓ Fetched ${all.length} discs from TryDiscs (dataset_version: ${datasetVersion ?? 'unknown'}).`);
  console.log(`  Cached at ${CATALOG_CACHE}`);
}

function loadMaster() {
  if (!fs.existsSync(MASTER_PATH)) fail(`Master library not found at ${MASTER_PATH}`);
  return JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));
}

function loadCachedCatalog() {
  if (!fs.existsSync(CATALOG_CACHE)) {
    fail('No cached TryDiscs catalog found — run `node tools/trydiscs-sync.js fetch` first.');
  }
  return JSON.parse(fs.readFileSync(CATALOG_CACHE, 'utf8'));
}

function cmdReconcile() {
  const master = loadMaster();
  const catalog = loadCachedCatalog();

  // Index master by exact key (normalized name + mfr) and by normalized-name-only for fuzzy pass.
  const masterByExact = new Map();
  const masterByNameOnly = new Map();
  for (const d of master) {
    const exactKey = `${normName(d.name)}|${normName(d.mfr)}`;
    masterByExact.set(exactKey, d);
    const nameKey = normName(d.name);
    if (!masterByNameOnly.has(nameKey)) masterByNameOnly.set(nameKey, []);
    masterByNameOnly.get(nameKey).push(d);
  }

  const exactMatches = [];
  const probableMatches = [];
  const newTryDiscsOnly = [];
  const flightDiffs = [];
  const typeDiffs = [];
  const matchedMasterKeys = new Set();

  for (const td of catalog) {
    const tdName = td.name;
    const tdBrand = td.brand;
    const exactKey = `${normName(tdName)}|${normName(tdBrand)}`;
    const exact = masterByExact.get(exactKey);

    if (exact) {
      matchedMasterKeys.add(exactKey);
      exactMatches.push({ name: tdName, mfr: tdBrand });

      if (td.speed != null && td.glide != null && td.turn != null && td.fade != null) {
        const diffs = [];
        if (Math.abs((exact.speed ?? 0) - td.speed) > 0.01) diffs.push(`speed ${exact.speed}->${td.speed}`);
        if (Math.abs((exact.glide ?? 0) - td.glide) > 0.01) diffs.push(`glide ${exact.glide}->${td.glide}`);
        if (Math.abs((exact.turn ?? 0) - td.turn) > 0.01) diffs.push(`turn ${exact.turn}->${td.turn}`);
        if (Math.abs((exact.fade ?? 0) - td.fade) > 0.01) diffs.push(`fade ${exact.fade}->${td.fade}`);
        if (diffs.length) flightDiffs.push({ name: tdName, mfr: tdBrand, diffs });
      }

      const mappedType = TYPE_MAP[String(td.type || '').toLowerCase()] || td.type;
      if (mappedType && exact.type && mappedType !== exact.type) {
        typeDiffs.push({ name: tdName, mfr: tdBrand, ours: exact.type, theirs: mappedType, tryDiscsRaw: td.type });
      }
      continue;
    }

    // Fuzzy pass: same normalized name, different/missing brand match.
    const nameOnly = masterByNameOnly.get(normName(tdName));
    if (nameOnly && nameOnly.length) {
      probableMatches.push({ name: tdName, mfr: tdBrand, candidateMfrs: nameOnly.map((d) => d.mfr) });
      continue;
    }

    newTryDiscsOnly.push({ name: tdName, mfr: tdBrand, type: td.type, speed: td.speed, glide: td.glide, turn: td.turn, fade: td.fade });
  }

  const oldOnly = master.filter((d) => !matchedMasterKeys.has(`${normName(d.name)}|${normName(d.mfr)}`));

  const summary = {
    existingCount: master.length,
    tryDiscsCount: catalog.length,
    exactMatchCount: exactMatches.length,
    probableMatchCount: probableMatches.length,
    newTryDiscsOnlyCount: newTryDiscsOnly.length,
    oldOnlyCount: oldOnly.length,
    flightDiffCount: flightDiffs.length,
    typeDiffCount: typeDiffs.length,
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    REPORT_JSON,
    JSON.stringify({ summary, exactMatches, probableMatches, newTryDiscsOnly, oldOnly, flightDiffs, typeDiffs }, null, 2)
  );

  const md = [
    '# TryDiscs reconciliation report',
    '',
    `Generated ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|---|---|`,
    `| Existing library (\`discs_master.json\`) | ${summary.existingCount} |`,
    `| TryDiscs catalog | ${summary.tryDiscsCount} |`,
    `| Exact matches (name+mfr) | ${summary.exactMatchCount} |`,
    `| Probable matches (name only, mfr differs) | ${summary.probableMatchCount} |`,
    `| New TryDiscs-only molds | ${summary.newTryDiscsOnlyCount} |`,
    `| Old-only (in our library, absent from TryDiscs) | ${summary.oldOnlyCount} |`,
    `| Flight-number diffs on matched discs | ${summary.flightDiffCount} |`,
    `| Type-bucket diffs on matched discs | ${summary.typeDiffCount} |`,
    '',
    '## Probable matches (spot-check these)',
    '',
    ...probableMatches.slice(0, 50).map((m) => `- **${m.name}** (TryDiscs: ${m.mfr}) — our candidates: ${m.candidateMfrs.join(', ')}`),
    probableMatches.length > 50 ? `\n_(${probableMatches.length - 50} more not shown — see reconciliation-report.json)_` : '',
    '',
    '## Flight-number diffs on matched discs',
    '',
    ...flightDiffs.slice(0, 50).map((m) => `- **${m.name}** (${m.mfr}): ${m.diffs.join(', ')}`),
    flightDiffs.length > 50 ? `\n_(${flightDiffs.length - 50} more not shown — see reconciliation-report.json)_` : '',
    '',
    '## Type-bucket diffs on matched discs',
    '',
    ...typeDiffs.slice(0, 50).map((m) => `- **${m.name}** (${m.mfr}): ours=${m.ours}, TryDiscs=${m.theirs} (raw: "${m.tryDiscsRaw}")`),
    typeDiffs.length > 50 ? `\n_(${typeDiffs.length - 50} more not shown — see reconciliation-report.json)_` : '',
    '',
    '## New TryDiscs-only molds (sample of 50)',
    '',
    ...newTryDiscsOnly.slice(0, 50).map((m) => `- **${m.name}** (${m.mfr}) — ${m.type ?? 'no type'}, ${m.speed ?? '?'}/${m.glide ?? '?'}/${m.turn ?? '?'}/${m.fade ?? '?'}`),
    newTryDiscsOnly.length > 50 ? `\n_(${newTryDiscsOnly.length - 50} more not shown — see reconciliation-report.json)_` : '',
    '',
    '## Old-only (in our library, absent from TryDiscs — sample of 50)',
    '',
    ...oldOnly.slice(0, 50).map((m) => `- **${m.name}** (${m.mfr})`),
    oldOnly.length > 50 ? `\n_(${oldOnly.length - 50} more not shown — see reconciliation-report.json)_` : '',
    '',
  ].join('\n');

  fs.writeFileSync(REPORT_MD, md);

  console.log('✓ Reconciliation complete:');
  console.log(`  existing=${summary.existingCount} tryDiscs=${summary.tryDiscsCount} exact=${summary.exactMatchCount} probable=${summary.probableMatchCount}`);
  console.log(`  newTryDiscsOnly=${summary.newTryDiscsOnlyCount} oldOnly=${summary.oldOnlyCount} flightDiffs=${summary.flightDiffCount} typeDiffs=${summary.typeDiffCount}`);
  console.log(`  Report: ${REPORT_MD}`);
}

// Normalizes one TryDiscs record into the app/website MasterDisc shape. Returns null for
// records without usable flight numbers (~273/2,147 discontinued/niche molds per the
// reconciliation report) — a catalog-v2 pack should be flight-number-complete, same bar the
// existing bundled library already meets.
function normalizeRecord(td) {
  if (td.speed == null || td.glide == null || td.turn == null || td.fade == null) return null;
  const type = TYPE_MAP[String(td.type || '').toLowerCase()] || td.type || 'Mid Range';
  return {
    name: td.name,
    mfr: td.brand,
    speed: td.speed,
    glide: td.glide,
    turn: td.turn,
    fade: td.fade,
    stability: td.stability != null ? td.stability : td.turn + td.fade,
    type,
  };
}

function nextCatalogVersion() {
  if (!fs.existsSync(MANIFEST_PATH)) return 1;
  try {
    const prev = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return (prev.catalogVersion || 0) + 1;
  } catch {
    return 1;
  }
}

function cmdGenerate() {
  const catalog = loadCachedCatalog();
  const versionMeta = fs.existsSync(VERSION_CACHE) ? JSON.parse(fs.readFileSync(VERSION_CACHE, 'utf8')) : {};

  const normalized = catalog.map(normalizeRecord).filter(Boolean);
  const skipped = catalog.length - normalized.length;

  const catalogVersion = nextCatalogVersion();
  const assetName = `catalog-v${catalogVersion}.json`;
  const assetText = JSON.stringify(normalized);
  const sha256 = crypto.createHash('sha256').update(assetText).digest('hex');

  const manifest = {
    catalogVersion,
    provider: 'Try Discs',
    datasetVersion: versionMeta.dataset_version || 'unknown',
    schemaVersion: SCHEMA_VERSION,
    recordCount: normalized.length,
    size: Buffer.byteLength(assetText),
    sha256,
    asset: assetName,
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, assetName), assetText);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`✓ Generated ${assetName} — ${normalized.length} discs (${skipped} skipped, no flight numbers).`);
  console.log(`  catalogVersion=${catalogVersion} datasetVersion=${manifest.datasetVersion} sha256=${sha256.slice(0, 12)}…`);
  console.log(`  Manifest: ${MANIFEST_PATH}`);
  console.log('  (Still gitignored, still local-only — not committed, not hosted anywhere yet.)');
}

function cmdPublish(args) {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail('No generated manifest found — run `node tools/trydiscs-sync.js generate` first.');
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const assetPath = path.join(CACHE_DIR, manifest.asset);
  if (!fs.existsSync(assetPath)) {
    fail(`Generated asset ${manifest.asset} not found in the cache — re-run generate.`);
  }

  const dest = `${PUBLISH_HOST}:${PUBLISH_PATH}`;
  const scpCmd = `scp "${MANIFEST_PATH}" "${assetPath}" "${dest}"`;

  if (args.includes('--dry-run')) {
    console.log('Dry run — would publish via:');
    console.log(`  ${scpCmd}`);
    console.log(`  (catalogVersion=${manifest.catalogVersion}, asset=${manifest.asset})`);
    return;
  }

  console.log(`Publishing catalogVersion=${manifest.catalogVersion} (${manifest.asset}) to ${dest} ...`);
  execFileSync('scp', [MANIFEST_PATH, assetPath, dest], { stdio: 'inherit' });
  console.log('✓ Published. data/catalog/ on the VPS is gitignored — this never touches git history.');
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (cmd === 'check') {
    await cmdCheck();
  } else if (cmd === 'fetch') {
    await cmdFetch(rest);
  } else if (cmd === 'reconcile') {
    cmdReconcile();
  } else if (cmd === 'generate') {
    cmdGenerate();
  } else if (cmd === 'publish') {
    cmdPublish(rest);
  } else {
    fail('Usage: node tools/trydiscs-sync.js <check|fetch|reconcile|generate|publish> [--force|--dry-run]');
  }
}

main();
