import { matchPic, msLookupKey } from './msMatch';

const HTTPS = 'https://s3.amazonaws.com/x/buzzz.webp';

describe('msLookupKey', () => {
  it('normalizes to trimmed lowercase mfr|mold', () => {
    expect(msLookupKey('  Discraft ', 'Buzzz')).toBe('discraft|buzzz');
    expect(msLookupKey('', 'Zone')).toBe('|zone');
  });
});

describe('matchPic', () => {
  const buzzz = { brand: 'Discraft', name: 'Buzzz', pic: HTTPS };
  const buzzzOS = { brand: 'Discraft', name: 'Buzzz OS', pic: 'https://s3/os.webp' };

  it('requires an exact (case-insensitive) name match, not a prefix', () => {
    // The API returns Buzzz, Buzzz OS, GT, SS for ?name=Buzzz — must pick the exact one.
    expect(matchPic([buzzzOS, buzzz], 'Discraft', 'buzzz')).toBe(HTTPS);
  });

  it('returns null when no name matches exactly', () => {
    expect(matchPic([buzzzOS], 'Discraft', 'Buzzz')).toBeNull();
  });

  it('matches brand as a substring in either direction', () => {
    expect(matchPic([{ brand: 'Innova Champion Discs', name: 'Destroyer', pic: HTTPS }], 'Innova', 'Destroyer')).toBe(HTTPS);
    expect(matchPic([{ brand: 'MVP', name: 'Volt', pic: HTTPS }], 'MVP Disc Sports', 'Volt')).toBe(HTTPS);
  });

  it('rejects a brand mismatch', () => {
    expect(matchPic([{ brand: 'Innova', name: 'Buzzz', pic: HTTPS }], 'Discraft', 'Buzzz')).toBeNull();
  });

  it('ignores brand when the disc has no manufacturer', () => {
    expect(matchPic([{ brand: 'Discraft', name: 'Buzzz', pic: HTTPS }], '', 'Buzzz')).toBe(HTTPS);
  });

  it('refuses a non-https pic (no http/file/other-scheme loads)', () => {
    expect(matchPic([{ brand: 'Discraft', name: 'Buzzz', pic: 'http://insecure/x.webp' }], 'Discraft', 'Buzzz')).toBeNull();
    expect(matchPic([{ brand: 'Discraft', name: 'Buzzz', pic: 'file:///etc/passwd' }], 'Discraft', 'Buzzz')).toBeNull();
  });

  it('returns null for an empty mold or empty results', () => {
    expect(matchPic([buzzz], 'Discraft', '')).toBeNull();
    expect(matchPic([], 'Discraft', 'Buzzz')).toBeNull();
  });
});
