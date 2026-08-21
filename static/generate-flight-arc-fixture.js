// PLAN.md Track D — generates fixtures/flight-arc-vectors.json from static/physics.js, the
// acknowledged canonical implementation (CLAUDE.md: "the website wins when they disagree").
// Run directly to regenerate after a deliberate physics.js change:
//   node static/generate-flight-arc-fixture.js > fixtures/flight-arc-vectors.json
// Also required as a module by physics.fixture.test.js, which diffs a fresh run against the
// checked-in file so an *undeclared* physics.js change (fixture not regenerated) fails CI.
const path = require('path');
const { arcPoints, applyModifiers, stab } = require(path.join(__dirname, 'physics.js'));

// Representative disc archetypes spanning speed/glide/turn/fade space (putter..distance driver,
// each stability class) — not exhaustive, but real coverage of the input space both ports handle.
const DISCS = [
  { name: 'putter-stable', speed: 3, glide: 3, turn: 0, fade: 1 },
  { name: 'putter-understable', speed: 2, glide: 4, turn: -1, fade: 0 },
  { name: 'mid-overstable', speed: 5, glide: 4, turn: -1, fade: 3 },
  { name: 'fairway-stable', speed: 7, glide: 5, turn: -1, fade: 1 },
  { name: 'driver-overstable', speed: 12, glide: 5, turn: -1, fade: 4 },
  { name: 'driver-understable', speed: 11, glide: 6, turn: -3, fade: 1 },
  { name: 'edge-case-zero', speed: 4, glide: 4, turn: 0, fade: 0 },
  { name: 'edge-case-extreme', speed: 14, glide: 7, turn: -5, fade: 4 },
];

const SLIDER_SETS = [
  { name: 'neutral', hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 },
  { name: 'hyzer-30', hyzer: 30, nose: 0, wind: 0, armSpeed: 100, spin: 100 },
  { name: 'anhyzer-20', hyzer: -20, nose: 0, wind: 0, armSpeed: 100, spin: 100 },
  { name: 'headwind', hyzer: 0, nose: 0, wind: 15, armSpeed: 100, spin: 100 },
  { name: 'tailwind', hyzer: 0, nose: 0, wind: -15, armSpeed: 100, spin: 100 },
  { name: 'underarm', hyzer: 0, nose: 0, wind: 0, armSpeed: 60, spin: 100 },
  { name: 'nose-up', hyzer: 0, nose: 20, wind: 0, armSpeed: 100, spin: 100 },
  { name: 'low-spin', hyzer: 10, nose: 5, wind: 5, armSpeed: 80, spin: 50 },
];

const ARC_VIEWS = ['RHBH', 'RHFH', 'LHBH', 'LHFH'];
const W = 300, H = 400;

function generateVectors() {
  const vectors = [];
  for (const d of DISCS) {
    vectors.push({
      kind: 'stability',
      name: d.name,
      input: { speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade },
      expected: { stability: stab(d) },
    });
    for (const s of SLIDER_SETS) {
      const adjusted = applyModifiers(d, s);
      for (const view of ARC_VIEWS) {
        const arc = arcPoints(adjusted, W, H, view);
        vectors.push({
          kind: 'arc',
          name: `${d.name}__${s.name}__${view}`,
          input: { disc: { speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade }, sliders: s, W, H, arcView: view },
          expected: { adjusted, arc },
        });
      }
    }
  }
  return { generatedFrom: 'static/physics.js', W, H, vectors };
}

module.exports = { generateVectors, DISCS, SLIDER_SETS, ARC_VIEWS, W, H };

if (require.main === module) {
  console.log(JSON.stringify(generateVectors(), null, 2));
}
