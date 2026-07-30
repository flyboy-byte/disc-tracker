import { buildBackup, parseBackup, backupSummary, type BackupMeta } from './backup';
import type { Disc } from './disc';
import type { Round } from './roundMath';

const meta: BackupMeta = { sortMode: 'name', arcView: 'RHFH', skill: 'advanced', msRefEnabled: true, fieldShowAll: true };
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
