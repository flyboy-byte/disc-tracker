import {
  coursePar,
  parForHole,
  standingFor,
  standings,
  formatVsPar,
  strokesAt,
  isRoundComplete,
  type Round,
} from './roundMath';

// A 3-hole round, two players, partially scored.
function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 1,
    label: '',
    course: '',
    playedOn: '2026-07-30',
    holeCount: 3,
    finished: false,
    holes: [
      { hole: 1, par: 3 },
      { hole: 2, par: 4 },
      { hole: 3, par: 3 },
    ],
    players: [
      { id: 10, name: 'Me' },
      { id: 20, name: 'Alex' },
    ],
    scores: [
      { playerId: 10, hole: 1, strokes: 3 },
      { playerId: 10, hole: 2, strokes: 5 }, // +1 on a par 4
      { playerId: 20, hole: 1, strokes: 2 }, // birdie on a par 3
    ],
    ...overrides,
  };
}

describe('parForHole / coursePar', () => {
  it('reads explicit par and defaults missing holes to 3', () => {
    const holes = [{ hole: 2, par: 4 }];
    expect(parForHole(holes, 2)).toBe(4);
    expect(parForHole(holes, 1)).toBe(3); // no row → default 3
  });

  it('sums course par across all holes including defaulted ones', () => {
    expect(coursePar([{ hole: 1, par: 4 }], 3)).toBe(4 + 3 + 3); // hole 1 explicit, 2 & 3 default
  });
});

describe('standingFor (per player, over scored holes only)', () => {
  it('totals strokes and vs-par only for holes the player scored', () => {
    const r = makeRound();
    // Me: 3 (par 3) + 5 (par 4) = 8 strokes over par 7 → +1, 2 holes
    expect(standingFor(r, 10)).toEqual({ total: 8, holesPlayed: 2, vsPar: 1 });
    // Alex: 2 on a par 3 → -1, 1 hole
    expect(standingFor(r, 20)).toEqual({ total: 2, holesPlayed: 1, vsPar: -1 });
  });

  it('a player with no scores is even/zero, not negative', () => {
    const r = makeRound({ scores: [] });
    expect(standingFor(r, 10)).toEqual({ total: 0, holesPlayed: 0, vsPar: 0 });
  });
});

describe('standings ordering', () => {
  it('ranks by fewest total strokes, unscored players last', () => {
    const r = makeRound({
      scores: [
        { playerId: 10, hole: 1, strokes: 5 },
        { playerId: 20, hole: 1, strokes: 2 },
      ],
    });
    const order = standings(r).map((s) => s.player.id);
    expect(order).toEqual([20, 10]); // Alex 2 < Me 5
  });

  it('puts players with zero holes played at the bottom (not leading at 0)', () => {
    const r = makeRound({ scores: [{ playerId: 10, hole: 1, strokes: 4 }] });
    const order = standings(r).map((s) => s.player.id);
    expect(order).toEqual([10, 20]); // Me played (4), Alex unscored → last despite 0
  });
});

describe('formatVsPar', () => {
  it('formats even, over, and under', () => {
    expect(formatVsPar(0)).toBe('E');
    expect(formatVsPar(3)).toBe('+3');
    expect(formatVsPar(-2)).toBe('-2');
  });
});

describe('strokesAt', () => {
  it('returns the stroke count or undefined when unscored', () => {
    const r = makeRound();
    expect(strokesAt(r.scores, 10, 2)).toBe(5);
    expect(strokesAt(r.scores, 10, 3)).toBeUndefined(); // not yet played
  });
});

describe('isRoundComplete', () => {
  it('is false while any player has an unscored hole', () => {
    expect(isRoundComplete(makeRound())).toBe(false);
  });

  it('is true only when every player has every hole scored', () => {
    const full = makeRound({
      holeCount: 2,
      holes: [
        { hole: 1, par: 3 },
        { hole: 2, par: 3 },
      ],
      players: [{ id: 10, name: 'Me' }],
      scores: [
        { playerId: 10, hole: 1, strokes: 3 },
        { playerId: 10, hole: 2, strokes: 4 },
      ],
    });
    expect(isRoundComplete(full)).toBe(true);
  });
});
