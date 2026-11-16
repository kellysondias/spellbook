import { Card, CardDataSource, CardLookupResult, isLandTypeLine } from "./card";
import { UpstreamError } from "../errors";

/** Scryfall accepts at most 75 identifiers per POST /cards/collection. */
export const SCRYFALL_BATCH_SIZE = 75;
/** /cards/collection is hard-limited to 2 requests per second. */
export const SCRYFALL_COLLECTION_INTERVAL_MS = 500;

interface ScryfallCard {
  name: string;
  cmc?: number;
  mana_cost?: string;
  type_line?: string;
  card_faces?: Array<{ name: string; mana_cost?: string; type_line?: string }>;
}

interface ScryfallCollectionResponse {
  data: ScryfallCard[];
  not_found: Array<{ name?: string }>;
}

export interface ScryfallClientOptions {
  userAgent: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minIntervalMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class ScryfallClient implements CardDataSource {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly minIntervalMs: number;
  private lastRequestAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly options: ScryfallClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://api.scryfall.com";
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.minIntervalMs = options.minIntervalMs ?? SCRYFALL_COLLECTION_INTERVAL_MS;
  }

  async getCardsByName(names: string[]): Promise<CardLookupResult> {
    const uniqueNames = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];
    const cards = new Map<string, Card>();
    const notFound: string[] = [];

    for (let i = 0; i < uniqueNames.length; i += SCRYFALL_BATCH_SIZE) {
      const batch = uniqueNames.slice(i, i + SCRYFALL_BATCH_SIZE);
      const response = await this.postCollection(batch);

      // Scryfall warns that missing cards shift positions, so we match by name, not index.
      const byName = new Map<string, Card>();
      for (const raw of response.data) {
        const card = toCard(raw);
        byName.set(raw.name.toLowerCase(), card);
        raw.card_faces?.forEach((face) => byName.set(face.name.toLowerCase(), card));
      }

      for (const requested of batch) {
        const card = byName.get(requested.toLowerCase());
        if (card) cards.set(requested.toLowerCase(), card);
        else notFound.push(requested);
      }
    }

    return { cards, notFound };
  }

  private async postCollection(names: string[]): Promise<ScryfallCollectionResponse> {
    const waitMs = this.lastRequestAt + this.minIntervalMs - this.now();
    if (waitMs > 0) await this.sleep(waitMs);
    this.lastRequestAt = this.now();

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/cards/collection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": this.options.userAgent,
        },
        body: JSON.stringify({ identifiers: names.map((name) => ({ name })) }),
      });
    } catch (error) {
      throw new UpstreamError("Could not reach Scryfall", { cause: String(error) });
    }

    if (response.status === 429) {
      throw new UpstreamError("Scryfall rate limit reached, try again in a few seconds");
    }
    if (!response.ok) {
      throw new UpstreamError(`Scryfall responded with HTTP ${response.status}`);
    }

    return (await response.json()) as ScryfallCollectionResponse;
  }
}

function toCard(raw: ScryfallCard): Card {
  const typeLine = raw.type_line ?? raw.card_faces?.map((f) => f.type_line ?? "").join(" // ") ?? "";
  return {
    name: raw.name,
    manaValue: raw.cmc ?? 0,
    manaCost: raw.mana_cost ?? raw.card_faces?.[0]?.mana_cost ?? "",
    typeLine,
    isLand: isLandTypeLine(typeLine),
  };
}
