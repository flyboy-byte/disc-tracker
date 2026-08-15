#!/usr/bin/env node
// Maintenance tool (developer-only, NOT shipped, NOT app UI): add a disc to the shared master
// library. Writes BOTH copies — static/discs_master.json (website) and app/assets/discs_master.json
// (bundled into the Android app) — and keeps them byte-identical, which masterLibrary.ts relies on.
//
// The files are serialized the way Python's json.dumps wrote them originally (single line,
// ", " / ": " separators, floats like 1.0). This script reproduces that exactly and self-checks:
// it re-serializes the current file from its own parse and refuses to write if that doesn't match
// byte-for-byte, so a formatter drift can never silently corrupt the file.
//
// Usage:
//   node tools/add-master-disc.js --name "Firebird" --mfr "Innova" \
//        --speed 9 --glide 3 --turn 0 --fade 4 [--type "Distance Driver"] [--force]
//
//   --type   optional; derived from speed if omitted
//   --force  allow adding even if a same name+mfr already exists

const fs = require('fs');
const path = require('path');

const FILES = [
  path.join(__dirname, '..', 'static', 'discs_master.json'),
  path.join(__dirname, '..', 'app', 'assets', 'discs_master.json'),
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') { out.force = true; continue; }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      out[key] = val;
      i++;
    }
  }
  return out;
}

// Mirror Python json.dumps default float rendering: integers get a trailing ".0".
function floatStr(n) {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

function discToStr(d) {
  return (
    '{' +
    [
      `"name": ${JSON.stringify(d.name)}`,
      `"mfr": ${JSON.stringify(d.mfr)}`,
      `"speed": ${floatStr(d.speed)}`,
      `"glide": ${floatStr(d.glide)}`,
      `"turn": ${floatStr(d.turn)}`,
      `"fade": ${floatStr(d.fade)}`,
      `"stability": ${floatStr(d.stability)}`,
      `"type": ${JSON.stringify(d.type)}`,
    ].join(', ') +
    '}'
  );
}

function serialize(discs) {
  return '[' + discs.map(discToStr).join(', ') + ']';
}

function deriveType(speed) {
  if (speed <= 3) return 'Putt & Approach';
  if (speed <= 5) return 'Mid Range';
  if (speed <= 8) return 'Control Driver';
  return 'Distance Driver';
}

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.name || !args.mfr) fail('--name and --mfr are required.');
  for (const k of ['speed', 'glide', 'turn', 'fade']) {
    if (args[k] === undefined) fail(`--${k} is required.`);
    if (!Number.isFinite(parseFloat(args[k]))) fail(`--${k} must be a number (got "${args[k]}").`);
  }

  const speed = parseFloat(args.speed);
  const glide = parseFloat(args.glide);
  const turn = parseFloat(args.turn);
  const fade = parseFloat(args.fade);
  const disc = {
    name: String(args.name),
    mfr: String(args.mfr),
    speed,
    glide,
    turn,
    fade,
    stability: args.stability !== undefined ? parseFloat(args.stability) : turn + fade,
    type: args.type ? String(args.type) : deriveType(speed),
  };

  // Load + validate both files are the identical starting point.
  const contents = FILES.map((f) => fs.readFileSync(f, 'utf8'));
  if (contents[0] !== contents[1]) {
    fail('The two master files are NOT byte-identical to begin with — refusing to touch them. Reconcile them first.');
  }

  const discs = JSON.parse(contents[0]);

  // Format self-check: our serializer must reproduce the current file exactly, or we bail.
  if (serialize(discs) !== contents[0]) {
    fail('Format self-check failed: re-serializing the current file does not match it byte-for-byte. The serializer would corrupt formatting — aborting.');
  }

  const dup = discs.find(
    (d) => d.name.toLowerCase() === disc.name.toLowerCase() && d.mfr.toLowerCase() === disc.mfr.toLowerCase()
  );
  if (dup && !args.force) {
    fail(`"${disc.name}" by ${disc.mfr} is already in the library. Use --force to add anyway.`);
  }

  const next = [...discs, disc];
  const out = serialize(next);

  for (const f of FILES) fs.writeFileSync(f, out);

  console.log(`✓ Added ${disc.name} (${disc.mfr}) — ${disc.speed}/${disc.glide}/${disc.turn}/${disc.fade}, ${disc.type}`);
  console.log(`  Library is now ${next.length} discs. Wrote both copies (byte-identical).`);
}

main();
