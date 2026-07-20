import { buildCSV, parseCSV, discKey, previewImport, MAX_IMPORT } from './csv';
import type { Disc } from './disc';

const ALPHA: Disc = {
  mfr: 'Innova',
  mold: 'Destroyer',
  plastic: 'Star',
  weight: '175g',
  speed: 12,
  glide: 5,
  turn: -1,
  fade: 3,
  use: 'Distance',
  thr: 'RHBH',
  notes: '',
};

describe('CSV round-trip', () => {
  it('parseCSV(buildCSV(discs)) reproduces the same discs', () => {
    const csv = buildCSV([ALPHA]);
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      mfr: ALPHA.mfr,
      mold: ALPHA.mold,
      plastic: ALPHA.plastic,
      weight: ALPHA.weight,
      speed: ALPHA.speed,
      glide: ALPHA.glide,
      turn: ALPHA.turn,
      fade: ALPHA.fade,
    });
  });

  it('quotes fields containing commas and preserves them through a round-trip', () => {
    const withComma: Disc = { ...ALPHA, notes: 'great, reliable disc' };
    const parsed = parseCSV(buildCSV([withComma]));
    expect(parsed[0].notes).toBe('great, reliable disc');
  });

  it('"Unknown" plastic/weight round-trips to empty string, not the literal word', () => {
    const noPlastic: Disc = { ...ALPHA, plastic: '', weight: '' };
    const parsed = parseCSV(buildCSV([noPlastic]));
    expect(parsed[0].plastic).toBe('');
    expect(parsed[0].weight).toBe('');
  });

  it('skips rows with no mold name', () => {
    const csv = 'Manufacturer,Mold,Plastic,Weight,Speed,Glide,Turn,Fade,Primary Use,Throw Style,Notes\nInnova,,,,,,,,,,\n';
    expect(parseCSV(csv)).toHaveLength(0);
  });
});

describe('discKey', () => {
  it('is case-insensitive and whitespace-trimmed', () => {
    expect(discKey({ mfr: ' Innova ', mold: 'Destroyer', plastic: 'Star', weight: '175g' })).toBe(
      discKey({ mfr: 'innova', mold: 'DESTROYER', plastic: 'star', weight: '175G'.toLowerCase() })
    );
  });
});

describe('previewImport (dedupe + cap)', () => {
  it('skips a disc that already exists in the bag', () => {
    const csv = buildCSV([ALPHA]);
    const result = previewImport(csv, [ALPHA]);
    expect(result.discs).toHaveLength(0);
    expect(result.duplicatesSkipped).toBe(1);
  });

  it('skips duplicates within the pasted file itself', () => {
    const csv = buildCSV([ALPHA, ALPHA]);
    const result = previewImport(csv, []);
    expect(result.discs).toHaveLength(1);
    expect(result.duplicatesSkipped).toBe(1);
  });

  it('imports a genuinely new disc normally', () => {
    const beta: Disc = { ...ALPHA, mold: 'Beta', plastic: '', weight: '' };
    const csv = buildCSV([beta]);
    const result = previewImport(csv, [ALPHA]);
    expect(result.discs).toHaveLength(1);
    expect(result.discs[0].mold).toBe('Beta');
  });

  it('caps at MAX_IMPORT rows', () => {
    const many: Disc[] = Array.from({ length: MAX_IMPORT + 20 }, (_, i) => ({
      ...ALPHA,
      mold: `Disc${i}`,
    }));
    const csv = buildCSV(many);
    const result = previewImport(csv, []);
    expect(result.discs).toHaveLength(MAX_IMPORT);
    expect(result.truncated).toBe(true);
  });
});
