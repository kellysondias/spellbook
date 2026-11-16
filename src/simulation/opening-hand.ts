import { Rng } from "./rng";

export interface OpeningHandInput {
  deckSize: number;
  landCount: number;
  iterations: number;
  rng: Rng;
  handSize?: number;
}

export interface OpeningHandStats {
  iterations: number;
  handSize: number;
  averageLands: number;
  /** Probability of each land count in the opening hand, keyed by number of lands. */
  landDistribution: Record<number, number>;
  /** Share of hands with 2 to 4 lands, a common rule of thumb for a keepable 7. */
  twoToFourLands: number;
}

/**
 * Monte Carlo simulation of opening hands: shuffles the deck `iterations` times
 * and counts lands in the first `handSize` cards (partial Fisher-Yates shuffle).
 */
export function simulateOpeningHands(input: OpeningHandInput): OpeningHandStats {
  const { deckSize, landCount, iterations, rng } = input;
  const handSize = Math.min(input.handSize ?? 7, deckSize);

  if (landCount > deckSize) throw new RangeError("landCount cannot exceed deckSize");
  if (iterations <= 0) throw new RangeError("iterations must be positive");

  const deck = Array.from({ length: deckSize }, (_, i) => i < landCount);
  const counts = new Array<number>(handSize + 1).fill(0);
  let totalLands = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    let lands = 0;
    for (let i = 0; i < handSize; i++) {
      const j = i + Math.floor(rng() * (deckSize - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
      if (deck[i]) lands++;
    }
    counts[lands]++;
    totalLands += lands;
  }

  const landDistribution: Record<number, number> = {};
  counts.forEach((count, lands) => {
    landDistribution[lands] = round4(count / iterations);
  });

  const twoToFourHands = counts.slice(2, 5).reduce((sum, count) => sum + count, 0);

  return {
    iterations,
    handSize,
    averageLands: round4(totalLands / iterations),
    landDistribution,
    twoToFourLands: round4(twoToFourHands / iterations),
  };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
