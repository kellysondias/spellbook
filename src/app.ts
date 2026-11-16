import express, { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { analyzeDeck } from "./analysis/analyze-deck";
import { CardDataSource } from "./cards/card";
import { HttpError } from "./errors";

const analyzeRequestSchema = z.object({
  decklist: z.string().trim().min(1, "decklist is required").max(20_000),
  iterations: z.number().int().min(1_000).max(200_000).default(20_000),
  seed: z.number().int().nonnegative().optional(),
});

export interface AppDependencies {
  cardSource: CardDataSource;
}

export function createApp({ cardSource }: AppDependencies) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/decks/analyze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = analyzeRequestSchema.safeParse(req.body);
      if (!body.success) {
        throw new HttpError(400, "Invalid request body", body.error.flatten().fieldErrors);
      }
      const { decklist, iterations, seed } = body.data;
      res.json(await analyzeDeck(decklist, { cardSource, iterations, seed }));
    } catch (error) {
      next(error);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, details: error.details });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
