/**
 * Unbiased cryptographic random integer in [0, maxExclusive).
 * Uses rejection sampling over crypto.getRandomValues to avoid modulo bias.
 */
export function cryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % maxExclusive;
}

export function cryptoPickOne<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[cryptoRandomInt(items.length)];
}

export function cryptoShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Generates a sequence of numbers for the 2.5s slot-machine roll that
 * always ends cleanly on `target` with no back-to-back duplicates when possible.
 */
export function buildRollSequence(pool: number[], target: number, steps = 26): number[] {
  if (pool.length <= 1) return [target];
  const sequence: number[] = [];
  let prev = -1;
  for (let i = 0; i < steps - 1; i++) {
    let pick = pool[cryptoRandomInt(pool.length)];
    if (pick === prev && pool.length > 1) {
      pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    }
    sequence.push(pick);
    prev = pick;
  }
  if (sequence[sequence.length - 1] === target && pool.length > 1) {
    const alt = pool.find((n) => n !== target) ?? target;
    sequence[sequence.length - 1] = alt;
  }
  sequence.push(target);
  return sequence;
}
