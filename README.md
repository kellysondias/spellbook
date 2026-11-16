# Spellbook

> **Status: early development (v0.1).** The deck analysis API works end to end; the collection app and the full deck simulator are on the roadmap below.

Spellbook is a backend for Magic: The Gathering players who want to understand how their decks actually play. The long-term goal is a web app where you manage your card collection and test decks built from it. This first version is the analysis engine: paste a decklist exported from Moxfield or MTG Arena and get the mana curve and opening-hand probabilities.

## What it does today

- **Parses plain-text decklists** in Moxfield and Arena formats (quantities, set codes, collector numbers, foil tags, sideboard sections, double-faced cards).
- **Fetches card data from the [Scryfall API](https://scryfall.com/docs/api)** in batches, respecting its documented limits (75 cards per request, max 2 requests/second on `/cards/collection`, descriptive `User-Agent` and `Accept` headers).
- **Simulates opening hands with Monte Carlo**: land distribution in your opening 7, average lands, and how often you get a 2 to 4 land hand. Simulations are seeded, so results are reproducible and shareable.
- **Builds the mana curve** of non-land cards and the average mana value.

## Example

`POST /decks/analyze`

```json
{
  "decklist": "20 Mountain\n4 Monastery Swiftspear\n4 Goblin Guide\n4 Lightning Bolt\n4 Chain Lightning\n4 Lava Spike\n4 Rift Bolt\n4 Skewer the Critics\n4 Light Up the Stage\n4 Searing Blaze\n4 Fireblast\n\nSIDEBOARD:\n3 Smash to Smithereens",
  "iterations": 20000,
  "seed": 42
}
```

Response (abridged):

```json
{
  "deckSize": 60,
  "landCount": 20,
  "nonLandCount": 40,
  "averageManaValue": 2.2,
  "manaCurve": { "0": 0, "1": 20, "2": 4, "3": 12, "4": 0, "5": 0, "6": 4, "7+": 0 },
  "openingHand": {
    "iterations": 20000,
    "handSize": 7,
    "averageLands": 2.3282,
    "landDistribution": { "0": 0.047, "1": 0.2011, "2": 0.3268, "3": 0.2661, "4": 0.1244, "5": 0.0305, "6": 0.0041, "7": 0.0001 },
    "twoToFourLands": 0.7173
  },
  "seed": 42,
  "warnings": { "cardsNotFound": [], "unparsedLines": [] }
}
```

Request body:

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `decklist` | string | required | Moxfield or Arena text export, up to 20,000 characters |
| `iterations` | integer | 20,000 | 1,000 to 200,000 simulated hands |
| `seed` | integer | random | Pass the returned seed to reproduce a run |

## Architecture

```
src/
├── app.ts                    # Express app, request validation (zod), error handling
├── server.ts                 # Composition root: wires the real Scryfall client
├── decklist/parse-decklist.ts
├── cards/
│   ├── card.ts               # Card model + CardDataSource interface
│   └── scryfall-client.ts    # Batching, rate limiting, name matching
├── simulation/
│   ├── rng.ts                # Seedable PRNG (mulberry32)
│   ├── opening-hand.ts       # Monte Carlo opening-hand simulation
│   └── hypergeometric.ts     # Exact probabilities, used to validate the simulation
└── analysis/analyze-deck.ts  # Orchestrates parsing, card lookup and simulation
```

Request flow: `POST /decks/analyze` → validate body → parse decklist → resolve card names through a `CardDataSource` → compute curve and simulate hands → JSON response.

### Design decisions

- **`CardDataSource` interface.** The analysis depends on an interface, not on Scryfall. Tests use an in-memory fake, and a cached or database-backed source can replace the HTTP client later without touching the analysis code.
- **Match cards by name, not by position.** Scryfall's collection endpoint warns that missing cards shift the order of results, so the client indexes results by card name and by each face of double-faced cards.
- **Front face decides "land".** Modal double-faced cards like `Spikefield Hazard // Spikefield Cave` count as spells in the opening hand, which matches how most players evaluate them.
- **Monte Carlo validated against the exact math.** The opening-hand simulation is checked in tests against the hypergeometric distribution. Monte Carlo is overkill for "how many lands in 7 cards", but it is the foundation for questions without a closed formula (mulligans, curving out by turn N).
- **Unknown cards still count.** If Scryfall cannot find a card, it still takes a slot in the library and is reported in `warnings`, so deck size and odds stay honest.

## Running locally

Requirements: Node.js 20+

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit and API tests
npm run test:coverage
```

Quick check:

```bash
curl -X POST http://localhost:3000/decks/analyze \
  -H "Content-Type: application/json" \
  -d '{"decklist":"24 Island\n4 Opt\n4 Counterspell"}'
```

Environment variables:

| Variable | Default |
| --- | --- |
| `PORT` | `3000` |
| `SCRYFALL_USER_AGENT` | `Spellbook/0.1 (+https://github.com/kellysondias/spellbook)` |

### Docker

```bash
docker build -t spellbook .
docker run -p 3000:3000 spellbook
```

## Roadmap

- [x] Decklist parsing (Moxfield / Arena)
- [x] Scryfall integration with batching and rate limiting
- [x] Opening-hand simulation and mana curve
- [ ] London mulligan simulation
- [ ] "Goldfish" simulation: odds of casting your curve on turns 1 to 4
- [ ] Card cache (Scryfall bulk data) to avoid repeated API calls
- [ ] Collection tracking (PostgreSQL), with decks built from cards you own
- [ ] Simulation engine rewritten as a Go service
- [ ] AI-assisted deck insights (strengths, weaknesses, suggested swaps)
- [ ] Web frontend

## Acknowledgements

Card data is provided by [Scryfall](https://scryfall.com/). Spellbook is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Not approved or endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

## License

MIT
