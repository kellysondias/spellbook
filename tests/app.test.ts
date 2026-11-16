import request from "supertest";
import { createApp } from "../src/app";
import { CardDataSource } from "../src/cards/card";
import { UpstreamError } from "../src/errors";
import { fakeCardSource } from "./fake-card-source";

const app = createApp({
  cardSource: fakeCardSource([
    { name: "Island", typeLine: "Basic Land - Island", manaValue: 0 },
    { name: "Opt", typeLine: "Instant", manaValue: 1 },
  ]),
});

describe("HTTP API", () => {
  it("GET /health responds ok", async () => {
    await request(app).get("/health").expect(200, { status: "ok" });
  });

  it("POST /decks/analyze returns the analysis", async () => {
    const response = await request(app)
      .post("/decks/analyze")
      .send({ decklist: "24 Island\n36 Opt", iterations: 1_000, seed: 9 })
      .expect(200);

    expect(response.body).toMatchObject({ deckSize: 60, landCount: 24, seed: 9 });
    expect(response.body.openingHand.twoToFourLands).toBeGreaterThan(0.5);
  });

  it("validates the request body", async () => {
    const response = await request(app).post("/decks/analyze").send({ iterations: 5 }).expect(400);

    expect(response.body.details).toHaveProperty("decklist");
    expect(response.body.details).toHaveProperty("iterations");
  });

  it("maps upstream failures to 502", async () => {
    const failing: CardDataSource = {
      getCardsByName: async () => {
        throw new UpstreamError("Scryfall is down");
      },
    };

    await request(createApp({ cardSource: failing }))
      .post("/decks/analyze")
      .send({ decklist: "4 Opt" })
      .expect(502, { error: "Scryfall is down" });
  });
});
