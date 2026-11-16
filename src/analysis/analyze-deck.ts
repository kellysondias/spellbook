import { CardDataSource } from "../cards/card";
import { parseDecklist, ParseError } from "../decklist/parse-decklist";
import { HttpError } from "../errors";
import { createRng } from "../simulation/rng";
import { OpeningHandStats, simulateOpeningHands } from "../simulation/opening-hand";

export interface AnalyzeDeckOptions {
  cardSource: CardDataSource;
  iterations: number;
  seed?: number;
}

export interface DeckAnalysis {
  deckSize: number;
  landCount: number;
  nonLandCount: number;
  averageManaValue: number;
  /** Non-land cards by mana value; "7+" groups everything at 7 or above. */
  manaCurve: Record<string, number>;
  openingHand: OpeningHandStats;
  seed: number;
  warnings: {
    cardsNotFound: string[];
    unparsedLines: ParseError[];
  };
}

const CURVE_BUCKETS = ["0", "1", "2", "3", "4", "5", "6", "7+"];

export async function analyzeDeck(decklist: string, options: AnalyzeDeckOptions): Promise<DeckAnalysis> {
  const parsed = parseDecklist(decklist);
  if (parsed.mainboard.length === 0) {
    throw new HttpError(422, "No mainboard cards found in the decklist", { unparsedLines: parsed.errors });
  }

  const { cards, notFound } = await options.cardSource.getCardsByName(
    parsed.mainboard.map((entry) => entry.name),
  );

  let deckSize = 0;
  let landCount = 0;
  let manaValueSum = 0;
  const manaCurve = Object.fromEntries(CURVE_BUCKETS.map((bucket) => [bucket, 0]));

  for (const entry of parsed.mainboard) {
    deckSize += entry.quantity;
    const card = cards.get(entry.name.toLowerCase());
    // Unknown cards still take a slot in the library; we count them as non-lands
    // and report them, so the simulation stays honest about deck size.
    if (!card) continue;

    if (card.isLand) {
      landCount += entry.quantity;
      continue;
    }
    const bucket = card.manaValue >= 7 ? "7+" : String(Math.floor(card.manaValue));
    manaCurve[bucket] += entry.quantity;
    manaValueSum += card.manaValue * entry.quantity;
  }

  const knownNonLands = Object.values(manaCurve).reduce((sum, n) => sum + n, 0);
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);

  return {
    deckSize,
    landCount,
    nonLandCount: deckSize - landCount,
    averageManaValue: knownNonLands > 0 ? round(manaValueSum / knownNonLands) : 0,
    manaCurve,
    openingHand: simulateOpeningHands({
      deckSize,
      landCount,
      iterations: options.iterations,
      rng: createRng(seed),
    }),
    seed,
    warnings: {
      cardsNotFound: notFound,
      unparsedLines: parsed.errors,
    },
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
