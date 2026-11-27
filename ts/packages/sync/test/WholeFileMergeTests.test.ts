import { describe, expect, it } from "vitest";
import { mergeWholeFile } from "../src/index.js";

const code = (s: string) => JSON.stringify({ "main.cpp": s });

describe("WholeFileMergeTests", () => {
  it("den sida som ändrats sedan basen vinner", () => {
    const base = code("int main() {}");
    expect(mergeWholeFile(base, code("// local"), base, "remote")).toEqual({ text: code("// local"), lost: null });
    expect(mergeWholeFile(base, base, code("// remote"), "local")).toEqual({ text: code("// remote"), lost: null });
  });

  it("när båda ändrats vinner den som sparades sist, och den andra lämnas tillbaka", () => {
    const base = code("int main() {}");
    expect(mergeWholeFile(base, code("// local"), code("// remote"), "local")).toEqual({
      text: code("// local"),
      lost: { side: "remote", text: code("// remote") },
    });
    expect(mergeWholeFile(null, code("// local"), code("// remote"), "remote")).toEqual({
      text: code("// remote"),
      lost: { side: "local", text: code("// local") },
    });
  });

  it("samma innehåll med annan formatering räknas inte som en krock", () => {
    const compact = code("x");
    const pretty = JSON.stringify(JSON.parse(compact), null, 2);
    expect(mergeWholeFile(null, compact, pretty, "remote")).toEqual({ text: compact, lost: null });
  });
});
