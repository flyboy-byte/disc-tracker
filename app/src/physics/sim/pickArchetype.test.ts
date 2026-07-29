import { pickArchetype } from './pickArchetype';

describe('pickArchetype', () => {
  it('fairway-and-below → fd2', () => {
    expect(pickArchetype({ speed: 5, turn: 0, fade: 2 })).toBe('fd2'); // putter/mid/fairway
    expect(pickArchetype({ speed: 8, turn: -1, fade: 1 })).toBe('fd2');
  });
  it('understable driver (net turn+fade ≤ -1) → cd1', () => {
    expect(pickArchetype({ speed: 12, turn: -3, fade: 1 })).toBe('cd1');
    expect(pickArchetype({ speed: 10, turn: -2, fade: 1 })).toBe('cd1');
  });
  it('fast stable/overstable (speed ≥ 12) → dd2', () => {
    expect(pickArchetype({ speed: 13, turn: 0, fade: 3 })).toBe('dd2');
    expect(pickArchetype({ speed: 12, turn: -1, fade: 2 })).toBe('dd2');
  });
  it('control driver otherwise → cd5', () => {
    expect(pickArchetype({ speed: 9, turn: 0, fade: 2 })).toBe('cd5');
    expect(pickArchetype({ speed: 11, turn: 0, fade: 3 })).toBe('cd5');
  });
  it('uses the same defaults as the website (speed 7, fade 2)', () => {
    expect(pickArchetype({})).toBe('fd2');
  });
});
