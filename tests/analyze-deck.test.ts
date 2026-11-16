import { analyzeDeck } from "../src/analysis/analyze-deck";
import { HttpError } from "../src/errors";
import { fakeCardSource } from "./fake-card-source";

const source = fakeCardSource([
  { name: "Mountain", typeLine: "Basic Land - Mountain", manaValue: 0 },
  { name: "Lightning Bolt", typeLine: "Instant", manaValue: 1 },
  { name: "Goblin Guide", typeLine: "Creature - Goblin Scout", manaValue: 1 },
  { name: "Fireblast", typeLine: "Instant", manaValue: 6 },
  { name: "Emrakul, the Aeons Torn", typeLine: "Legendary Creature - Eldrazi", manaValue: 15 },
]);

describe("analyzeDeck", () => {
  it("computes deck size, land count, mana curve and opening-hand odds", async () => {
    const decklist = ["20 Mountain", "4 Lightning Bolt", "4 Goblin Guide", "2 Fireblast", "1 Emrakul, the Aeons Torn"].join(
      "\n",
    );

    const result = await analyzeDeck(decklist, { cardSource: source, iterations: 2_000, seed: 3 });

    expect(result.deckSize).toBe(31);
    expect(result.landCount).toBe(20);
    expect(result.nonLandCount).toBe(11);
    expect(result.manaCurve).toMatchObject({ "1": 8, "6": 2, "7+": 1 });
    expect(result.averageManaValue).toBeCloseTo((8 * 1 + 2 * 6 + 15) / 11, 2);
    expect(result.openingHand.iterations).toBe(2_000);
    expect(result.seed).toBe(3);
  });

  it("reports unknown cards and still counts them in the deck size", async () => {
    const result = await analyzeDeck("20 Mountain\n4 Totally Made Up Card", {
      cardSource: source,
      iterations: 1_000,
      seed: 1,
    });

    expect(result.deckSize).toBe(24);
    expect(result.nonLandCount).toBe(4);
    expect(result.warnings.cardsNotFound).toEqual(["Totally Made Up Card"]);
  });

  it("ignores the sideboard", async () => {
    const result = await analyzeDeck("20 Mountain\n\nSIDEBOARD:\n4 Lightning Bolt", {
      cardSource: source,
      iterations: 1_000,
      seed: 1,
    });

    expect(result.deckSize).toBe(20);
  });

  it("rejects decklists with no mainboard cards", async () => {
    await expect(
      analyzeDeck("just some text", { cardSource: source, iterations: 1_000 }),
    ).rejects.toMatchObject({ status: 422 } satisfies Partial<HttpError>);
  });
});
