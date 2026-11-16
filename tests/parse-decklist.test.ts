import { parseDecklist } from "../src/decklist/parse-decklist";

describe("parseDecklist", () => {
  it("parses quantities, names, set codes, collector numbers and foil tags", () => {
    const result = parseDecklist(
      ["4 Lightning Bolt", "2x Counterspell (MH2) 267", "1 Sol Ring (CMM) 410 *F*"].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.mainboard).toEqual([
      { quantity: 4, name: "Lightning Bolt", foil: false },
      { quantity: 2, name: "Counterspell", setCode: "mh2", collectorNumber: "267", foil: false },
      { quantity: 1, name: "Sol Ring", setCode: "cmm", collectorNumber: "410", foil: true },
    ]);
  });

  it("supports the Moxfield SIDEBOARD header", () => {
    const result = parseDecklist("4 Island\n\nSIDEBOARD:\n2 Negate");

    expect(result.mainboard.map((e) => e.name)).toEqual(["Island"]);
    expect(result.sideboard.map((e) => e.name)).toEqual(["Negate"]);
  });

  it("treats a blank line after the mainboard as the start of the sideboard (Arena format)", () => {
    const result = parseDecklist("Deck\n20 Mountain\n40 Shock\n\n3 Abrade");

    expect(result.mainboard).toHaveLength(2);
    expect(result.sideboard.map((e) => e.name)).toEqual(["Abrade"]);
  });

  it("keeps names of double-faced and split cards intact", () => {
    const result = parseDecklist("1 Fire // Ice\n1 Delver of Secrets // Insectile Aberration");

    expect(result.mainboard.map((e) => e.name)).toEqual([
      "Fire // Ice",
      "Delver of Secrets // Insectile Aberration",
    ]);
  });

  it("ignores comments and maybeboard cards, and reports unparseable lines", () => {
    const result = parseDecklist("// my deck\n4 Opt\nnot a card line\nMaybeboard\n1 Brainstorm");

    expect(result.mainboard.map((e) => e.name)).toEqual(["Opt"]);
    expect(result.sideboard).toEqual([]);
    expect(result.errors).toEqual([{ line: 3, text: "not a card line" }]);
  });

  it("rejects zero quantities", () => {
    const result = parseDecklist("0 Island");

    expect(result.mainboard).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});
