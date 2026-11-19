import { describe, expect, it } from "vitest";
import { CatalogException } from "../src/core/CatalogException.js";
import { CatalogVerifier } from "../src/core/CatalogVerifier.js";
import { withFixture } from "./Fixture.js";

// HubCoreTests.cs: SignatureTests

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("SignatureTests", () => {
  it("en korrekt signerad katalog godtas", () =>
    withFixture((f) => {
      const data = utf8('{"schema":1}');
      f.verifier.verify(data, f.sign(data));
    }));

  it("en ändrad katalog, fel nyckel eller trasig signatur avvisas", () =>
    withFixture((f) =>
      withFixture((other) => {
        const data = utf8('{"schema":1}');
        const sig = f.sign(data);
        const tampered = utf8('{"schema":2}');
        expect(() => f.verifier.verify(tampered, sig)).toThrow(CatalogException);
        expect(() => other.verifier.verify(data, sig)).toThrow(CatalogException);
        expect(() => f.verifier.verify(data, "not base64!")).toThrow(CatalogException);
        expect(() => f.verifier.verify(data, Buffer.alloc(70).toString("base64"))).toThrow(CatalogException);
      }),
    ));

  it("utan inbyggd nyckel litar hubben inte på någon katalog", () => {
    const v = new CatalogVerifier(null);
    expect(v.hasKey).toBe(false);
    expect(() => v.verify(new Uint8Array([1]), "AA==")).toThrow(CatalogException);
  });
});
