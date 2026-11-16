import { Card, CardDataSource, isLandTypeLine } from "../src/cards/card";

export function fakeCardSource(cards: Array<Pick<Card, "name" | "typeLine" | "manaValue">>): CardDataSource {
  const byName = new Map(
    cards.map((c) => [c.name.toLowerCase(), { ...c, manaCost: "", isLand: isLandTypeLine(c.typeLine) }]),
  );
  return {
    async getCardsByName(names) {
      const found = new Map<string, Card>();
      const notFound: string[] = [];
      for (const name of names) {
        const card = byName.get(name.toLowerCase());
        if (card) found.set(name.toLowerCase(), card);
        else notFound.push(name);
      }
      return { cards: found, notFound };
    },
  };
}
