/**
 * Parses comma/space-separated numbers and ranges (e.g. "12, 18, 45-60")
 * bounded to [min, max].
 */
export function parseExcludedNumbers(
  input: string,
  min: number,
  max: number
): { numbers: number[]; invalidTokens: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { numbers: [], invalidTokens: [] };

  const tokens = trimmed
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const result = new Set<number>();
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const rangeMatch = /^(\d+)-(\d+)$/.exec(token);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > end || end - start > 5000) {
        invalidTokens.push(token);
        continue;
      }
      for (let n = start; n <= end; n++) {
        if (n >= min && n <= max) result.add(n);
      }
      continue;
    }

    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n >= min && n <= max) {
        result.add(n);
      } else {
        invalidTokens.push(token);
      }
      continue;
    }

    invalidTokens.push(token);
  }

  return {
    numbers: Array.from(result).sort((a, b) => a - b),
    invalidTokens,
  };
}

/**
 * Formats a sorted list of excluded numbers concisely with ranges (e.g. "5, 12, 45-60").
 */
export function formatExcludedNumbers(numbers: number[]): string {
  if (numbers.length === 0) return '';
  const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = curr;
      prev = curr;
    }
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(', ');
}
