// Pure scoring math for the offline scorekeeper (B3). No SQLite, no UI — just totals and
// vs-par from plain data, so it's fully unit-testable (roundMath.test.ts). The DB layer
// (db.ts) and the Score screens feed these functions the round's holes/players/scores.

export interface RoundHole {
  hole: number; // 1-based
  par: number;
}
export interface RoundPlayer {
  id: number;
  name: string;
}
export interface RoundScore {
  playerId: number;
  hole: number;
  strokes: number;
}

// A round is sparse: `scores` only has entries for holes actually played, so mid-round totals
// and vs-par reflect what's been scored so far (not the whole course).
export interface Round {
  id: number;
  label: string;
  course: string;
  playedOn: string;
  holeCount: number;
  finished: boolean;
  holes: RoundHole[];
  players: RoundPlayer[];
  scores: RoundScore[];
}

export interface Standing {
  player: RoundPlayer;
  total: number; // strokes over holes this player has scored
  holesPlayed: number;
  vsPar: number; // total − par of the holes this player has scored (E/±N)
}

// Par for a single hole (default 3 if the hole has no explicit par row).
export function parForHole(holes: RoundHole[], hole: number): number {
  return holes.find((h) => h.hole === hole)?.par ?? 3;
}

// Sum of par across every hole in the round (the course par).
export function coursePar(holes: RoundHole[], holeCount: number): number {
  let sum = 0;
  for (let h = 1; h <= holeCount; h++) sum += parForHole(holes, h);
  return sum;
}

// One player's scored holes → their strokes total, holes played, and vs-par *for those holes*.
// vs-par is measured only over holes the player has actually scored, so it's meaningful at any
// point during a round, not just at the end.
export function standingFor(round: Round, playerId: number): Omit<Standing, 'player'> {
  const mine = round.scores.filter((s) => s.playerId === playerId);
  let total = 0;
  let parPlayed = 0;
  for (const s of mine) {
    total += s.strokes;
    parPlayed += parForHole(round.holes, s.hole);
  }
  return { total, holesPlayed: mine.length, vsPar: total - parPlayed };
}

// All players ranked best-first (fewest strokes). Ties keep the players' listed order (stable
// sort). Players with zero holes played sort last so an unscored player doesn't lead at 0.
export function standings(round: Round): Standing[] {
  return round.players
    .map((player) => ({ player, ...standingFor(round, playerId(player)) }))
    .sort((a, b) => {
      if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
      if (a.holesPlayed === 0) return 1;
      if (b.holesPlayed === 0) return -1;
      return a.total - b.total;
    });
}

function playerId(p: RoundPlayer): number {
  return p.id;
}

// "E" / "+3" / "-2" for display.
export function formatVsPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

// Look up a single player's strokes on a single hole (undefined = not yet scored).
export function strokesAt(scores: RoundScore[], playerId: number, hole: number): number | undefined {
  return scores.find((s) => s.playerId === playerId && s.hole === hole)?.strokes;
}

// UDisc-style scoring tier relative to par, for color-coding a stored score. Pure/testable —
// score.tsx maps each tier to a theme color rather than hardcoding colors here.
export type ScoreTier = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double';
export function scoreTier(strokes: number, par: number): ScoreTier {
  const diff = strokes - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double';
}

// Is every hole scored for every player? (drives the "round complete" hint / finish prompt.)
// A hole counts as done only when EVERY player has a score on it — the useful question mid-round
// is "what still needs entering", and with up to 8 players a hole with one score in isn't done.
// Stated explicitly because the hole strip (UX_AUDIT.md E3) renders off this and "scored" is
// ambiguous for multiplayer rounds; solo rounds behave identically either way.
export function holeComplete(round: Round, hole: number): boolean {
  if (round.players.length === 0) return false;
  return round.players.every((p) => strokesAt(round.scores, p.id, hole) !== undefined);
}

export function isRoundComplete(round: Round): boolean {
  if (round.players.length === 0 || round.holeCount === 0) return false;
  for (let h = 1; h <= round.holeCount; h++) {
    if (!holeComplete(round, h)) return false;
  }
  return true;
}
