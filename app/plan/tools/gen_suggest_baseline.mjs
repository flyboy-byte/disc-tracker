// B1 step 1 — capture the CURRENT disc-suggestion library picks as a baseline yardstick.
//
// Runs the *existing* filterLibrary logic (from src/utils/scenarios.ts) against the full
// disc library and records the top-15 ordered picks per scenario. This is the frozen
// "before" that the B1 rewrite is measured against, so every change is defensible (per the
// "prove the change" rule in CLAUDE.md, whose "don't change suggestion behavior" guard is
// explicitly lifted for the B1 rewrite — see plan/docs/direction-2026-07-29.md).
//
// MUST STAY IN LOCKSTEP with src/utils/scenarios.ts filterLibrary + the SCENARIOS
// library-filter metadata (stabMin/stabMax/speedMin/types). The bagTest predicates are
// captured verbatim as text (bag picks need a live bag; the library ranking is the
// reproducible part). If scenarios.ts changes, regenerate: `node plan/tools/gen_suggest_baseline.mjs`.
//
// Output: src/utils/__fixtures__/suggest-baseline.json

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..');

const library = JSON.parse(readFileSync(join(appRoot, 'assets', 'discs_master.json'), 'utf8'));

// --- Mirror of SCENARIOS (library-filter fields) + bagTest text, from src/utils/scenarios.ts ---
const SCENARIOS = [
  { id: 'straight', title: 'Dead Straight', stabMin: -1, stabMax: 1, types: ['Control Driver', 'Mid Range'], bagTest: 'd.fade + d.turn >= -1 && d.fade + d.turn <= 1 && d.speed >= 4' },
  { id: 'hyzer', title: 'Reliable Hyzer', stabMin: 2, types: ['Control Driver', 'Distance Driver', 'Mid Range'], bagTest: 'd.fade >= 3 && d.turn >= -1' },
  { id: 'distance', title: 'Max Distance', stabMin: -1, stabMax: 2, speedMin: 11, bagTest: 'd.speed >= 11 && d.fade <= 3 && d.turn <= -0.5' },
  { id: 'headwind', title: 'Into Headwind', stabMin: 2.5, types: ['Control Driver', 'Distance Driver'], bagTest: 'd.fade >= 3 && d.turn >= -0.5 && d.speed >= 7' },
  { id: 'tailwind', title: 'Tailwind', stabMin: -2, stabMax: 0, speedMin: 9, types: ['Control Driver', 'Distance Driver'], bagTest: 'd.speed >= 9 && d.turn <= -1 && d.fade + d.turn <= 0' },
  { id: 'turnover', title: 'Turnover', stabMax: -1.5, types: ['Control Driver', 'Distance Driver'], bagTest: 'd.turn <= -2 && d.fade <= 2 && d.fade + d.turn <= -1' },
  { id: 'forehand', title: 'Forehand', stabMin: 2, types: ['Control Driver', 'Distance Driver', 'Mid Range'], bagTest: 'd.fade >= 2 && d.turn >= -0.5 && d.speed >= 6' },
  { id: 'tomahawk', title: 'Tomahawk', stabMin: 1, stabMax: 4, types: ['Control Driver', 'Distance Driver'], bagTest: 'd.speed >= 7 && d.fade >= 2 && d.turn >= -2' },
  { id: 'approach', title: 'Approach', stabMin: -1, stabMax: 2.5, types: ['Putt & Approach', 'Mid Range'], bagTest: 'd.speed <= 6 && d.fade <= 3 && d.turn >= -2 && d.fade + d.turn >= -1' },
  { id: 'accurate_mid', title: 'Accurate Mid', stabMin: 0, stabMax: 2, types: ['Mid Range'], bagTest: 'd.speed >= 4 && d.speed <= 6 && d.fade + d.turn >= 0 && d.fade + d.turn <= 2' },
  { id: 'hyzerflip', title: 'Hyzer Flip', stabMin: -2, stabMax: 0, types: ['Control Driver', 'Distance Driver'], bagTest: 'd.speed >= 7 && d.speed <= 12 && d.turn <= -1 && d.turn >= -2 && d.fade >= 1 && d.fade <= 2 && d.fade + d.turn <= 0' },
  { id: 'roller', title: 'Roller', stabMax: -2.5, types: ['Control Driver', 'Distance Driver'], bagTest: 'd.turn <= -3 && d.fade <= 1' },
  { id: 'flex', title: 'Flex Shot', stabMin: -2, stabMax: 1, speedMin: 10, types: ['Control Driver', 'Distance Driver'], bagTest: 'd.speed >= 10 && d.turn <= -1.5 && d.turn >= -3 && d.fade >= 1 && d.fade <= 3' },
];

// Exact mirror of filterLibrary() in src/utils/scenarios.ts
function filterLibrary(sc, all) {
  return all
    .filter((d) => {
      if (sc.stabMin !== undefined && d.stability < sc.stabMin) return false;
      if (sc.stabMax !== undefined && d.stability > sc.stabMax) return false;
      if (sc.speedMin !== undefined && d.speed < sc.speedMin) return false;
      if (sc.types && !sc.types.includes(d.type)) return false;
      return true;
    })
    .sort((a, b) => {
      const mid = ((sc.stabMin ?? -4) + (sc.stabMax ?? 7)) / 2;
      return Math.abs(a.stability - mid) - Math.abs(b.stability - mid);
    })
    .slice(0, 15);
}

const out = {
  _note: 'B1 baseline — CURRENT filterLibrary picks. Frozen yardstick for the rewrite. Regenerate via plan/tools/gen_suggest_baseline.mjs.',
  generated: new Date().toISOString().slice(0, 10),
  libraryCount: library.length,
  scenarios: {},
};

for (const sc of SCENARIOS) {
  const picks = filterLibrary(sc, library);
  out.scenarios[sc.id] = {
    title: sc.title,
    filter: { stabMin: sc.stabMin, stabMax: sc.stabMax, speedMin: sc.speedMin, types: sc.types },
    bagTest: sc.bagTest,
    libraryMatchCount: library.filter((d) => {
      if (sc.stabMin !== undefined && d.stability < sc.stabMin) return false;
      if (sc.stabMax !== undefined && d.stability > sc.stabMax) return false;
      if (sc.speedMin !== undefined && d.speed < sc.speedMin) return false;
      if (sc.types && !sc.types.includes(d.type)) return false;
      return true;
    }).length,
    top15: picks.map((d) => ({
      name: d.name, mfr: d.mfr, type: d.type,
      speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade, stability: d.stability,
    })),
  };
}

const dest = join(appRoot, 'src', 'utils', '__fixtures__', 'suggest-baseline.json');
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${dest}`);
for (const [id, s] of Object.entries(out.scenarios)) {
  console.log(`  ${id.padEnd(13)} matches=${String(s.libraryMatchCount).padStart(4)}  top: ${s.top15.slice(0, 3).map((d) => d.name).join(', ')}`);
}
