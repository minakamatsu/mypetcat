/** Deterministic RNG so each cat desyncs from the others. */
export class CatRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x1_0000_0000;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  randBetween(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  weightedPick<T extends string>(
    entries: { value: T; weight: number }[],
  ): T {
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.next() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.value;
      }
    }
    return entries[entries.length - 1]!.value;
  }
}

export function seedForCat(index: number, salt = 0): number {
  const t = Date.now() & 0xffff;
  return ((index + 1) * 2654435761 + salt * 97 + t) >>> 0;
}
