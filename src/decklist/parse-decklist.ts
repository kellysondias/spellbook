export interface DeckEntry {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  foil: boolean;
}

export interface ParseError {
  line: number;
  text: string;
}

export interface ParsedDecklist {
  mainboard: DeckEntry[];
  sideboard: DeckEntry[];
  errors: ParseError[];
}

type Section = "mainboard" | "sideboard" | "ignored";

const SECTION_HEADERS: Record<string, Section> = {
  deck: "mainboard",
  mainboard: "mainboard",
  main: "mainboard",
  commander: "mainboard",
  companion: "sideboard",
  sideboard: "sideboard",
  side: "sideboard",
  maybeboard: "ignored",
  considering: "ignored",
};

// "4 Lightning Bolt", "4x Lightning Bolt (2X2) 117", "1 Sol Ring (CMM) 410 *F*"
const ENTRY_PATTERN =
  /^(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([A-Za-z0-9-★]+))?)?(\s+\*[A-Z]+\*)?$/;

/**
 * Parses a plain-text decklist in the formats exported by Moxfield and MTG Arena.
 *
 * - Section headers ("Deck", "Sideboard", "SIDEBOARD:", "Commander"...) switch sections.
 * - A blank line after mainboard entries starts the sideboard (Arena convention).
 * - Lines starting with "//" or "#" are comments.
 * - Lines that cannot be parsed are reported in `errors` instead of throwing.
 */
export function parseDecklist(text: string): ParsedDecklist {
  const result: ParsedDecklist = { mainboard: [], sideboard: [], errors: [] };
  let section: Section = "mainboard";

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (line === "") {
      if (section === "mainboard" && result.mainboard.length > 0) {
        section = "sideboard";
      }
      return;
    }

    if (line.startsWith("//") || line.startsWith("#")) return;

    const header = line.replace(/:$/, "").toLowerCase();
    if (header in SECTION_HEADERS) {
      section = SECTION_HEADERS[header];
      return;
    }

    const match = ENTRY_PATTERN.exec(line);
    const quantity = match ? Number(match[1]) : 0;
    if (!match || quantity <= 0) {
      result.errors.push({ line: index + 1, text: line });
      return;
    }

    if (section === "ignored") return;

    const [, , name, setCode, collectorNumber, foilTag] = match;
    result[section].push({
      quantity,
      name: name.trim(),
      ...(setCode ? { setCode: setCode.toLowerCase() } : {}),
      ...(collectorNumber ? { collectorNumber } : {}),
      foil: Boolean(foilTag),
    });
  });

  return result;
}
