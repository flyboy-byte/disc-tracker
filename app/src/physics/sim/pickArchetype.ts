// Port of pickArchetype() from templates/flightshape.html. Chooses which of shotshaper's 4
// pre-built driver archetypes best matches a real disc's PDGA numbers. This never invents physics
// — it only selects among the vendor's discs; the empirical basis of each branch is documented in
// app.py's ARCHETYPE_PROFILE. No putter/midrange data exists upstream, so slow discs fall to fd2
// and the UI shows the extrapolation caveat.
import type { Archetype } from './coeffs';

export function pickArchetype(d: { speed?: number; turn?: number; fade?: number }): Archetype {
  const speed = d.speed ?? 7;
  const net = (d.turn ?? 0) + (d.fade ?? 2);
  if (speed < 9) return 'fd2'; // fairway-and-below: shortest, most turn-prone archetype
  if (net <= -1) return 'cd1'; // understable driver — never fades back in characterization
  if (speed >= 12) return 'dd2'; // fast + stable/overstable — longest, full S-curve
  return 'cd5'; // control driver, overstable — partial fade-back
}
