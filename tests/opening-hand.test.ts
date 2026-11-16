import { hypergeometricProbability } from "../src/simulation/hypergeometric";
import { simulateOpeningHands } from "../src/simulation/opening-hand";
import { createRng } from "../src/simulation/rng";

describe("hypergeometricProbability", () => {
  it("sums to 1 across all possible outcomes", () => {
    const total = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((k) => hypergeometricProbability(60, 24, 7, k))
      .reduce((a, b) => a + b, 0);

    expect(total).toBeCloseTo(1, 10);
  });

  it("matches the exact value: 3 lands in 7 cards from 24/60 = C(24,3)*C(36,4)/C(60,7)", () => {
    // 2024 * 58905 / 386206920 ≈ 0.30870
    expect(hypergeometricProbability(60, 24, 7, 3)).toBeCloseTo((2024 * 58905) / 386206920, 10);
  });
});

describe("simulateOpeningHands", () => {
  it("converges to the exact hypergeometric distribution", () => {
    const stats = simulateOpeningHands({
      deckSize: 60,
      landCount: 24,
      iterations: 100_000,
      rng: createRng(42),
    });

    for (let lands = 0; lands <= 7; lands++) {
      const exact = hypergeometricProbability(60, 24, 7, lands);
      expect(Math.abs(stats.landDistribution[lands] - exact)).toBeLessThan(0.01);
    }
    // Expected lands in 7 cards = 7 * 24 / 60 = 2.8
    expect(stats.averageLands).toBeCloseTo(2.8, 1);
  });

  it("is reproducible with the same seed", () => {
    const run = () =>
      simulateOpeningHands({ deckSize: 40, landCount: 17, iterations: 5_000, rng: createRng(7) });

    expect(run()).toEqual(run());
  });

  it("handles decks with no lands", () => {
    const stats = simulateOpeningHands({ deckSize: 60, landCount: 0, iterations: 1_000, rng: createRng(1) });

    expect(stats.landDistribution[0]).toBe(1);
    expect(stats.twoToFourLands).toBe(0);
  });

  it("validates its input", () => {
    expect(() =>
      simulateOpeningHands({ deckSize: 10, landCount: 11, iterations: 10, rng: createRng(1) }),
    ).toThrow(RangeError);
  });
});
