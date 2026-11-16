export interface Card {
  name: string;
  manaValue: number;
  manaCost: string;
  typeLine: string;
  isLand: boolean;
}

export interface CardLookupResult {
  /** Cards keyed by the lower-cased name that was requested. */
  cards: Map<string, Card>;
  notFound: string[];
}

/** Anything that can resolve card names into card data (Scryfall, a cache, a test fake). */
export interface CardDataSource {
  getCardsByName(names: string[]): Promise<CardLookupResult>;
}

/**
 * For double-faced cards ("Front // Back"), only the front face decides whether
 * the card counts as a land in the opening hand.
 */
export function isLandTypeLine(typeLine: string): boolean {
  const frontFace = typeLine.split(" // ")[0];
  return /\bLand\b/.test(frontFace);
}
