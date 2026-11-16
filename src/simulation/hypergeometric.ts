function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const m = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= m; i++) {
    result = (result * (n - m + i)) / i;
  }
  return result;
}

/**
 * Exact probability of drawing exactly `hits` successes when drawing `draws`
 * cards without replacement from a deck of `populationSize` with `successes` copies.
 * Used to validate the Monte Carlo simulation.
 */
export function hypergeometricProbability(
  populationSize: number,
  successes: number,
  draws: number,
  hits: number,
): number {
  return (
    (choose(successes, hits) * choose(populationSize - successes, draws - hits)) /
    choose(populationSize, draws)
  );
}
