import { BASE_SCHEMA } from './migrations';
import { PERSISTENCE_REGISTRY } from './persistence';
import { buildBackup, parseBackup } from '../utils/backup';
import type { Disc } from '../utils/disc';
import type { Round } from '../utils/roundMath';
import type { CustomMasterDisc } from '../utils/masterLibrary';
import type { LearningState } from '../utils/suggestScore';

function schemaTableNames(): string[] {
  const names: string[] = [];
  const re = /CREATE TABLE IF NOT EXISTS (\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(BASE_SCHEMA))) names.push(m[1]);
  return names;
}

describe('persistence registry stays in sync with the real schema (PLAN.md Track B)', () => {
  it('has a registry entry for every table the schema actually creates', () => {
    const registered = new Set(PERSISTENCE_REGISTRY.map((e) => e.table));
    const missing = schemaTableNames().filter((t) => !registered.has(t));
    expect(missing).toEqual([]);
  });

  it("doesn't register a table that no longer exists in the schema", () => {
    const live = new Set(schemaTableNames());
    const stale = PERSISTENCE_REGISTRY.filter((e) => !live.has(e.table)).map((e) => e.table);
    expect(stale).toEqual([]);
  });

  it('requires a note explaining every backedUp: false exemption', () => {
    const undocumented = PERSISTENCE_REGISTRY.filter((e) => !e.backedUp && !e.note).map((e) => e.table);
    expect(undocumented).toEqual([]);
  });
});

describe('full backup round-trip covers every backedUp:true table (Disc Suggest fields included)', () => {
  it('preserves discs, rounds (+holes/players/scores), custom discs, demotions, and learning state together', () => {
    const discs: Disc[] = [
      { id: 1, mfr: 'Innova', mold: 'Firebird', plastic: 'Star', weight: '175', speed: 9, glide: 3, turn: 0, fade: 4, use: '', thr: 'RHBH', notes: '', color: '#ff0000', inBag: true },
    ];
    const meta = { sortMode: 'name', arcView: 'RHFH', skill: 'advanced', throwStyle: 'forehand' as const, suggestMode: 'buying' as const, msRefEnabled: true, fieldShowAll: true };
    const rounds: Round[] = [
      {
        id: 5,
        label: 'Test',
        course: 'Maple',
        playedOn: '2026-07-30',
        holeCount: 1,
        finished: true,
        holes: [{ hole: 1, par: 3 }],
        players: [{ id: 10, name: 'Me' }],
        scores: [{ playerId: 10, hole: 1, strokes: 3 }],
      },
    ];
    const customDiscs: CustomMasterDisc[] = [
      { id: 1, mfr: 'Local', name: 'Widget', speed: 4, glide: 4, turn: 0, fade: 1, stability: 0, type: 'putter', custom: true },
    ];
    const demotions = [{ listKey: 'buy:straight', discKey: 'innova|firebird', position: 1 }];
    const learning: LearningState = {
      avoidSpeed: 12,
      avoidGlide: 5,
      avoidTurn: -2,
      avoidFade: 2,
      avoidStrength: 0.6,
      brandAversion: { innova: 0.5 },
      engineEnabled: false,
    };

    const json = buildBackup(discs, meta, rounds, customDiscs, demotions, learning);
    const back = parseBackup(json);

    expect(back.discs).toEqual(discs);
    expect(back.meta).toEqual(meta);
    expect(back.rounds).toEqual(rounds);
    expect(back.customDiscs).toEqual(customDiscs);
    expect(back.suggestDemotions).toEqual(demotions);
    expect(back.suggestLearning).toEqual(learning);
  });
});
