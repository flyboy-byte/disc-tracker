import { buildBackup, parseBackup, backupSummary, type BackupDemotion, type BackupMeta } from './backup';
import type { Disc } from './disc';
import type { Round } from './roundMath';
import type { LearningState } from './suggestScore';

const meta: BackupMeta = { sortMode: 'name', arcView: 'RHFH', skill: 'advanced', throwStyle: 'forehand', suggestMode: 'buying', msRefEnabled: true, fieldShowAll: true };
const discs: Disc[] = [
  { id: 1, mfr: 'Innova', mold: 'Firebird', plastic: 'Star', weight: '175', speed: 9, glide: 3, turn: 0, fade: 4, use: '', thr: 'RHBH', notes: '', color: '#ff0000', inBag: true },
];
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

describe('buildBackup / parseBackup round-trip', () => {
  it('preserves discs, meta, and rounds through a JSON round-trip', () => {
    const json = buildBackup(discs, meta, rounds);
    const back = parseBackup(json);
    expect(back.version).toBe(1);
    expect(back.discs).toEqual(discs);
    expect(back.meta).toEqual(meta);
    expect(back.rounds).toEqual(rounds);
    expect(typeof back.exportedAt).toBe('string');
  });

  it('preserves suggest-swipe demotions and learning state (suggest-swipe-scope.md)', () => {
    const demotions: BackupDemotion[] = [{ listKey: 'buy:straight', discKey: 'innova|firebird', position: 1 }];
    const learning: LearningState = {
      avoidSpeed: 12,
      avoidGlide: 5,
      avoidTurn: -2,
      avoidFade: 2,
      avoidStrength: 0.6,
      brandAversion: { innova: 0.5 },
      engineEnabled: false,
    };
    const json = buildBackup(discs, meta, rounds, [], demotions, learning);
    const back = parseBackup(json);
    expect(back.suggestDemotions).toEqual(demotions);
    expect(back.suggestLearning).toEqual(learning);
  });

  it('defaults suggest-swipe fields to empty/zeroed for backups predating the feature', () => {
    const back = parseBackup(JSON.stringify({ discs: [] }));
    expect(back.suggestDemotions).toEqual([]);
    expect(back.suggestLearning.avoidStrength).toBe(0);
    expect(back.suggestLearning.engineEnabled).toBe(true);
    expect(back.suggestLearning.brandAversion).toEqual({});
  });
});

describe('parseBackup validation', () => {
  it('rejects non-JSON with a friendly message', () => {
    expect(() => parseBackup('Manufacturer,Mold\nInnova,Firebird')).toThrow(/backup file/i);
  });

  it('rejects JSON without a discs array', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow(/Disc Tracker backup/i);
  });

  it('tolerates a discs-only backup (meta/rounds default)', () => {
    const back = parseBackup(JSON.stringify({ discs: [] }));
    expect(back.discs).toEqual([]);
    expect(back.rounds).toEqual([]);
    expect(back.meta.arcView).toBe('RHBH'); // defaulted
    expect(back.meta.skill).toBe('intermediate');
    expect(back.meta.throwStyle).toBe('backhand'); // defaulted — old backups predate this field
    expect(back.meta.suggestMode).toBe('throwing'); // defaulted — old backups predate this field
  });

  it('coerces truthy/missing meta booleans', () => {
    const back = parseBackup(JSON.stringify({ discs: [], meta: { arcView: 'LHBH' } }));
    expect(back.meta.arcView).toBe('LHBH');
    expect(back.meta.msRefEnabled).toBe(false);
    expect(back.meta.fieldShowAll).toBe(false);
  });
});

describe('backupSummary', () => {
  it('summarizes discs and rounds', () => {
    expect(backupSummary(parseBackup(buildBackup(discs, meta, rounds)))).toBe('1 disc · 1 round');
  });
  it('omits rounds when there are none', () => {
    expect(backupSummary(parseBackup(buildBackup(discs, meta, [])))).toBe('1 disc');
  });
});
