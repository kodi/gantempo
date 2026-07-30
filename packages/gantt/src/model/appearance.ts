export const MAX_APPEARANCE_VARIANT_CODE_POINTS = 64;

const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

export function isCanonicalAppearanceVariant(value: unknown): value is string {
  const codePointLength = typeof value === 'string' ? Array.from(value).length : 0;
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    codePointLength >= 1 &&
    codePointLength <= MAX_APPEARANCE_VARIANT_CODE_POINTS &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

export function normalizeAppearanceVariant(value: string): string {
  return value.trim();
}
