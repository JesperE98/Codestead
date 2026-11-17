import { CatalogException } from "./CatalogException.js";
import { CatalogTool } from "./CatalogTool.js";
import { JsonShapeError, readInteger, readList, readObject, readString, serializeIndented } from "./Json.js";

/**
 * The list of tools the hub can install, published as catalog.json (plus catalog.json.sig) in the
 * public releases repository. Written by the release workflow (packaging/catalog.py).
 */
export class Catalog {
  static readonly CurrentSchema = 1;

  schema = 0;
  /** When the catalog was written (UTC, ISO 8601). */
  generated = "";
  tools: CatalogTool[] = [];

  constructor(init?: { schema?: number; generated?: string; tools?: CatalogTool[] }) {
    if (!init) return;
    this.schema = init.schema ?? 0;
    this.generated = init.generated ?? "";
    this.tools = init.tools ?? [];
  }

  /** Parses a catalog. Throws {@link CatalogException} if it is not a valid catalog. */
  static parse(utf8: Uint8Array): Catalog {
    let c: Catalog | null;
    try {
      // fatal: invalid UTF-8 is a JSON error, as in System.Text.Json; a UTF-8 BOM is skipped.
      const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(utf8));
      c = raw === null ? null : Catalog.fromJson(raw);
    } catch (e) {
      if (e instanceof SyntaxError || e instanceof TypeError || e instanceof JsonShapeError) throw new CatalogException("The catalog is not valid JSON.", e);
      throw e;
    }
    if (c === null) throw new CatalogException("The catalog is empty.");
    if (c.schema !== Catalog.CurrentSchema) throw new CatalogException(`Unsupported catalog schema ${c.schema} (this hub understands ${Catalog.CurrentSchema}). Update the hub.`);
    for (const t of c.tools) t.validate();
    return c;
  }

  private static fromJson(v: unknown): Catalog {
    const o = readObject(v, "$");
    const c = new Catalog();
    c.schema = readInteger(o, "schema", "$");
    c.generated = readString(o, "generated", "$");
    // "tools": null would make the C# hub fail with a NullReferenceException; here it is a JSON error.
    c.tools = o.tools === undefined ? [] : readList(o.tools, "$.tools", CatalogTool.fromJson);
    return c;
  }

  find(id: string): CatalogTool | null {
    return this.tools.find((t) => t.id === id) ?? null;
  }

  /** The catalog as Catalog.Json writes it (JsonSerializer.SerializeToUtf8Bytes(catalog, Catalog.Json)). */
  static serialize(c: Catalog): Uint8Array {
    return new TextEncoder().encode(serializeIndented(c));
  }
}
