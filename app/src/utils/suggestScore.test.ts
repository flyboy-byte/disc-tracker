// B1 step 3 — unit tests for the unified scorer, and step 6 — validation vs. the step-1 baseline.
// Pure/offline, no device. Run with `npm test`.

import { bandFor, PROFILES, PRESETS, rankDiscs, score, type SkillPreset } from './suggestScore';
import { masterDiscs } from './masterLibrary';
import type { ScenarioDisc } from './disc';
import baseline from './__fixtures__/suggest-baseline.json';

const LIBRARY: ScenarioDisc[] = masterDiscs.filter(
  (d): d is ScenarioDisc => d.stability != null && !!d.type
);

function disc(partial: Partial<ScenarioDisc>): ScenarioDisc {
  return { name: 'X', mfr: 'Y', type: 'Distance Driver', stability: 0, speed: 9, glide: 5, turn: 0, fade: 2, ...partial };
}

describe('scorer basics', () => {
  it('scores an ideal disc for a scenario near the top of the range', () => {
    // Reliable Hyzer ideal ≈ speed 9, glide 4, turn 0, fade 3.5
    const ideal = disc({ speed: 9, glide: 4, turn: 0, fade: 3.5 });
    expect(score(ideal, 'hyzer', 'intermediate')).toBeGreaterThanOrEqual(0.75);
  });

  it('scores an unrelated disc low', () => {
    // A speed-2 straight putter is a poor Max Distance disc
    const putter = disc({ speed: 2, glide: 3, turn: 0, fade: 1 });
    expect(score(putter, 'distance', 'intermediate')).toBeLessThan(0.55);
  });

  it('returns 0 for an unknown scenario', () => {
    expect(score(disc({}), 'not_a_scenario', 'intermediate')).toBe(0);
  });

  it('bands are ordered great > good > marginal > null', () => {
    expect(bandFor(0.8)).toBe('great');
    expect(bandFor(0.6)).toBe('good');
    expect(bandFor(0.4)).toBe('marginal');
    expect(bandFor(0.2)).toBeNull();
  });
});

describe('skill presets', () => {
  it('demotes a too-fast disc for a beginner vs. an advanced thrower', () => {
    const fast = disc({ speed: 14, glide: 6, turn: -1.5, fade: 1.5 }); // above beginner cap (9)
    const beg = score(fast, 'distance', 'beginner');
    const adv = score(fast, 'distance', 'advanced');
    expect(beg).toBeLessThan(adv);
  });

  it('soft cap never hard-excludes: a fast distance driver still scores > 0 for a beginner', () => {
    const fast = disc({ speed: 13, glide: 6, turn: -1.5, fade: 1.5 });
    expect(score(fast, 'distance', 'beginner')).toBeGreaterThan(0);
  });

  it('beginner stability nudge favors a slightly more understable straight disc', () => {
    const us = disc({ speed: 6, glide: 5, turn: -1.5, fade: 1 });
    const os = disc({ speed: 6, glide: 5, turn: -0.5, fade: 1 });
    // Beginner target turn shifts to -1.5, so the US disc should edge the OS one.
    expect(score(us, 'straight', 'beginner')).toBeGreaterThan(score(os, 'straight', 'beginner'));
  });
});

describe('the headline defect is fixed: hyzer !== forehand', () => {
  it('produces different library rankings for hyzer and forehand', () => {
    const hyzer = rankDiscs(LIBRARY, 'hyzer', 'intermediate').map((s) => `${s.disc.name}|${s.disc.mfr}`);
    const forehand = rankDiscs(LIBRARY, 'forehand', 'intermediate').map((s) => `${s.disc.name}|${s.disc.mfr}`);
    expect(hyzer).not.toEqual(forehand);
    // Baseline: these two were byte-identical. Assert real divergence, not a 1-disc shuffle.
    const overlap = hyzer.filter((n) => forehand.includes(n)).length;
    expect(overlap).toBeLessThan(hyzer.length);
  });
});

describe('determinism', () => {
  it('ranks identically across repeated runs (no sort-stability reliance)', () => {
    const a = rankDiscs(LIBRARY, 'roller', 'intermediate').map((s) => s.disc.name);
    const b = rankDiscs([...LIBRARY].reverse(), 'roller', 'intermediate').map((s) => s.disc.name);
    expect(a).toEqual(b); // input order must not change the output
  });
});

// --- Step 6: validation against the frozen baseline (set-level, per audit finding #2) ---
describe('validation vs. step-1 baseline', () => {
  const skills: SkillPreset[] = ['beginner', 'intermediate', 'advanced'];

  it('every scenario still yields recommendations across all skill levels', () => {
    for (const id of Object.keys(PROFILES)) {
      for (const skill of skills) {
        expect(rankDiscs(LIBRARY, id, skill).length).toBeGreaterThan(0);
      }
    }
  });

  it('reports overlap with the baseline top-15 (informational, not asserted per-disc)', () => {
    const rows: string[] = [];
    for (const [id, entry] of Object.entries<any>((baseline as any).scenarios)) {
      const baseNames = new Set(entry.top15.map((d: any) => `${d.name}|${d.mfr}`.toLowerCase()));
      const now = rankDiscs(LIBRARY, id, 'intermediate').map((s) => `${s.disc.name}|${s.disc.mfr}`.toLowerCase());
      const overlap = now.filter((n) => baseNames.has(n)).length;
      rows.push(`  ${id.padEnd(13)} overlap ${overlap}/${now.length} vs baseline top-15`);
    }
    // Surfaced in test output for the human validation pass; no hard threshold — the rewrite
    // is *meant* to change picks. We only assert the model is sane (below).
    // eslint-disable-next-line no-console
    console.log('[B1 validation] baseline overlap by scenario:\n' + rows.join('\n'));
    expect(rows.length).toBe(12);
  });

  it('sanity: overstable scenarios recommend overstable discs (positive net), US scenarios negative', () => {
    const top = (id: string) => rankDiscs(LIBRARY, id, 'intermediate')[0].disc;
    expect(top('headwind').fade + top('headwind').turn).toBeGreaterThan(1); // clearly OS
    expect(top('hyzer').fade).toBeGreaterThanOrEqual(3); // fade-forward
    expect(top('roller').turn).toBeLessThanOrEqual(-3); // clearly US
    expect(top('turnover').turn).toBeLessThanOrEqual(-2);
  });
});
