// PLAN.md Track D — flight-arc + stability parity fixture. static/physics.js is the acknowledged
// canonical implementation (CLAUDE.md), so this file just re-derives the fixture vectors and
// diffs against the checked-in copy at fixtures/flight-arc-vectors.json — a mismatch here means
// physics.js itself changed behavior without regenerating the fixture (run
// `node static/generate-flight-arc-fixture.js > fixtures/flight-arc-vectors.json` and review the
// diff). legacyPhysics.fixture.test.ts (the app side) loads the *same* file and asserts its
// TypeScript port reproduces it — this file is what proves the fixture still matches its own
// source of truth.
const path = require('path');
const { generateVectors } = require('./generate-flight-arc-fixture.js');
const fixture = require(path.join(__dirname, '..', 'fixtures', 'flight-arc-vectors.json'));

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error('FAIL:', msg); }
}

const fresh = generateVectors();
assert(fresh.vectors.length === fixture.vectors.length, `fixture has ${fixture.vectors.length} vectors, regenerating produces ${fresh.vectors.length} — did a disc/slider case get added on only one side?`);

for (let i = 0; i < fixture.vectors.length; i++) {
  const want = fixture.vectors[i];
  const got = fresh.vectors[i];
  assert(got && got.name === want.name, `vector ${i} name matches ("${want.name}")`);
  if (got) {
    assert(JSON.stringify(got.expected) === JSON.stringify(want.expected), `vector "${want.name}" matches the checked-in fixture (physics.js changed behavior — regenerate fixtures/flight-arc-vectors.json)`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
