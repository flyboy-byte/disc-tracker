// Pure helpers behind NumberInput (components/NumberInput.tsx). Extracted into a plain
// .ts module so the negative-entry coercion (punch-list P0-1) gets node-env unit coverage
// without needing a React Native test renderer.

// Valid *prefixes* of a number the user may still be mid-typing. We must NOT coerce these
// to a number yet: parseFloat("-") is NaN, and `NaN || 0` snaps a controlled field back to
// "0", making it impossible to type a leading minus (e.g. a negative turn).
const INCOMPLETE = new Set(['', '-', '.', '-.']);

export function isIncompleteNumber(text: string): boolean {
  return INCOMPLETE.has(text);
}

// Final committed value (on blur): parse, falling back to 0 on empty/garbage.
export function coerceNumber(text: string): number {
  const n = parseFloat(text);
  return Number.isNaN(n) ? 0 : n;
}
