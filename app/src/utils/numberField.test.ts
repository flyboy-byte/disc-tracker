import { coerceNumber, isIncompleteNumber } from './numberField';

describe('isIncompleteNumber', () => {
  it('treats bare minus / decimal prefixes as still-typing', () => {
    // The whole point of P0-1: these must not be coerced mid-entry or a leading "-"
    // gets swallowed and the field snaps back to "0".
    expect(isIncompleteNumber('')).toBe(true);
    expect(isIncompleteNumber('-')).toBe(true);
    expect(isIncompleteNumber('.')).toBe(true);
    expect(isIncompleteNumber('-.')).toBe(true);
  });

  it('treats complete numbers as ready to commit', () => {
    expect(isIncompleteNumber('-2')).toBe(false);
    expect(isIncompleteNumber('0')).toBe(false);
    expect(isIncompleteNumber('3.5')).toBe(false);
    expect(isIncompleteNumber('-0.5')).toBe(false);
  });
});

describe('coerceNumber', () => {
  it('parses valid numbers including negatives and decimals', () => {
    expect(coerceNumber('-2')).toBe(-2);
    expect(coerceNumber('3.5')).toBe(3.5);
    expect(coerceNumber('-0.5')).toBe(-0.5);
    expect(coerceNumber('0')).toBe(0);
  });

  it('falls back to 0 on empty or incomplete input', () => {
    expect(coerceNumber('')).toBe(0);
    expect(coerceNumber('-')).toBe(0);
    expect(coerceNumber('.')).toBe(0);
    expect(coerceNumber('abc')).toBe(0);
  });

  it('parses the leading numeric portion of trailing garbage', () => {
    expect(coerceNumber('2x')).toBe(2);
  });
});
