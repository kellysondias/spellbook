import { ScryfallClient } from "../src/cards/scryfall-client";
import { UpstreamError } from "../src/errors";

type FetchArgs = Parameters<typeof fetch>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function scryfallCard(name: string, typeLine = "Instant", cmc = 1) {
  return { name, type_line: typeLine, cmc, mana_cost: "{R}" };
}

describe("ScryfallClient", () => {
  it("sends the headers Scryfall requires and maps cards by name", async () => {
    const fetchFn = jest.fn(async (..._args: FetchArgs) =>
      jsonResponse({
        data: [scryfallCard("Lightning Bolt"), scryfallCard("Mountain", "Basic Land - Mountain", 0)],
        not_found: [{ name: "Not A Real Card" }],
      }),
    );
    const client = new ScryfallClient({ userAgent: "SpellbookTest/1.0", fetchFn });

    const result = await client.getCardsByName(["Lightning Bolt", "Not A Real Card", "mountain"]);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api.scryfall.com/cards/collection");
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "SpellbookTest/1.0",
    });
    expect(result.cards.get("lightning bolt")?.isLand).toBe(false);
    expect(result.cards.get("mountain")?.isLand).toBe(true);
    expect(result.notFound).toEqual(["Not A Real Card"]);
  });

  it("splits requests into batches of 75 and waits 500ms between them", async () => {
    const names = Array.from({ length: 80 }, (_, i) => `Card ${i}`);
    const fetchFn = jest.fn(async (_url: FetchArgs[0], init?: FetchArgs[1]) => {
      const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: Array<{ name: string }> };
      return jsonResponse({ data: identifiers.map(({ name }) => scryfallCard(name)), not_found: [] });
    });
    const sleep = jest.fn(async () => undefined);
    const client = new ScryfallClient({ userAgent: "t", fetchFn, sleep, now: () => 1_000 });

    const result = await client.getCardsByName(names);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const batchSizes = fetchFn.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).identifiers.length);
    expect(batchSizes).toEqual([75, 5]);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(result.cards.size).toBe(80);
  });

  it("matches double-faced cards requested by their front face name", async () => {
    const fetchFn = jest.fn(async () =>
      jsonResponse({
        data: [
          {
            name: "Delver of Secrets // Insectile Aberration",
            cmc: 1,
            card_faces: [
              { name: "Delver of Secrets", type_line: "Creature - Human Wizard", mana_cost: "{U}" },
              { name: "Insectile Aberration", type_line: "Creature - Human Insect" },
            ],
          },
        ],
        not_found: [],
      }),
    );
    const client = new ScryfallClient({ userAgent: "t", fetchFn });

    const result = await client.getCardsByName(["Delver of Secrets"]);

    expect(result.cards.get("delver of secrets")).toMatchObject({ manaValue: 1, isLand: false, manaCost: "{U}" });
  });

  it("does not count modal double-faced spell/land cards as lands", async () => {
    const fetchFn = jest.fn(async () =>
      jsonResponse({
        data: [{ name: "Spikefield Hazard // Spikefield Cave", cmc: 1, type_line: "Instant // Land" }],
        not_found: [],
      }),
    );
    const client = new ScryfallClient({ userAgent: "t", fetchFn });

    const result = await client.getCardsByName(["Spikefield Hazard // Spikefield Cave"]);

    expect(result.cards.get("spikefield hazard // spikefield cave")?.isLand).toBe(false);
  });

  it("turns rate limiting and network failures into upstream errors", async () => {
    const rateLimited = new ScryfallClient({ userAgent: "t", fetchFn: async () => jsonResponse({}, 429) });
    const offline = new ScryfallClient({
      userAgent: "t",
      fetchFn: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(rateLimited.getCardsByName(["Opt"])).rejects.toBeInstanceOf(UpstreamError);
    await expect(offline.getCardsByName(["Opt"])).rejects.toBeInstanceOf(UpstreamError);
  });
});
