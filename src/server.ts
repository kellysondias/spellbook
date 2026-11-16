import { createApp } from "./app";
import { ScryfallClient } from "./cards/scryfall-client";

const port = Number(process.env.PORT ?? 3000);
const userAgent =
  process.env.SCRYFALL_USER_AGENT ?? "Spellbook/0.1 (+https://github.com/kellysondias/spellbook)";

const app = createApp({ cardSource: new ScryfallClient({ userAgent }) });

app.listen(port, () => {
  console.log(`Spellbook API listening on http://localhost:${port}`);
});
