import { describe, expect, it } from "vitest";
import { Catalog } from "../src/core/Catalog.js";
import { CatalogException } from "../src/core/CatalogException.js";
import { SemVer } from "../src/core/SemVer.js";

// HubCoreTests.cs: CatalogTests

const json = (tools: string) => new TextEncoder().encode(`{"schema":1,"generated":"2026-01-01T00:00:00Z","tools":[${tools}]}`);

const sha = "0000000000000000000000000000000000000000000000000000000000000000";

describe("CatalogTests", () => {
  it("katalogen läses och beskrivningen följer språket", () => {
    const c = Catalog.parse(
      json(
        `{"id":"codestead-linux","name":"Codestead Linux","version":"0.4.0","description":{"en":"Learn","sv":"Lär dig"},"assets":{"linux-x64":{"url":"https://example.org/a.tar.gz","sha256":"${sha}","size":10,"executable":"Codestead.Linux"}}}`,
      ),
    );
    expect(c.tools).toHaveLength(1);
    const t = c.tools[0]!;
    expect(t.descriptionFor("sv")).toBe("Lär dig");
    expect(t.descriptionFor("ja")).toBe("Learn");
    expect(t.assetFor("linux-x64")).not.toBeNull();
    expect(t.assetFor("win-x64")).toBeNull();
  });

  it("katalogen kan ha verktygets ändringslogg, och äldre kataloger utan den fungerar", () => {
    const tool = `{"id":"codestead-linux","name":"Codestead Linux","version":"0.5.5","description":{"en":"Learn"},"assets":{}`;
    const withChanges = Catalog.parse(json(tool + ',"changes":[{"version":"0.5.5","date":"2026-11-03","changes":{"en":["New"],"sv":["Nytt"]}}]}'));
    expect(withChanges.tools[0]!.changes).toHaveLength(1);
    const change = withChanges.tools[0]!.changes![0]!;
    expect(change.version).toBe("0.5.5");
    expect(change.changes.get("sv")).toEqual(["Nytt"]);
    expect(Catalog.parse(json(tool + "}")).tools[0]!.changes).toBeNull();
  });

  it.each([
    ["../evil", "0.1.0", "https://example.org/a.tar.gz", "tool"],
    ["ok", "latest", "https://example.org/a.tar.gz", "tool"],
    ["ok", "0.1.0", "http://example.org/a.tar.gz", "tool"],
    ["ok", "0.1.0", "https://example.org/a.tar.gz", "../../bin/sh"],
    ["ok", "0.1.0", "https://example.org/a.tar.gz", "/bin/sh"],
  ])("farliga eller trasiga kataloger avvisas (%s, %s, %s, %s)", (id, version, url, exe) => {
    const data = json(`{"id":"${id}","version":"${version}","assets":{"linux-x64":{"url":"${url}","sha256":"${sha}","size":10,"executable":"${exe}"}}}`);
    expect(() => Catalog.parse(data)).toThrow(CatalogException);
  });

  it("okänt katalogformat avvisas", () => {
    expect(() => Catalog.parse(new TextEncoder().encode('{"schema":99,"tools":[]}'))).toThrow(CatalogException);
  });

  it("versioner jämförs som siffror", () => {
    expect(SemVer.isNewer("0.10.0", "0.9.9")).toBe(true);
    expect(SemVer.isNewer("0.4.0", "0.4.0")).toBe(false);
    expect(SemVer.isNewer("1.0", "0.1.0")).toBe(false);
  });
});
