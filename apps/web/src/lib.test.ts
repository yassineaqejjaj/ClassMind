import { pct } from "./lib";

describe("pct", () => {
  it("formate un taux en pourcentage français", () => {
    expect(pct(0.625)).toBe("63 %");
    expect(pct(0)).toBe("0 %");
  });
});
