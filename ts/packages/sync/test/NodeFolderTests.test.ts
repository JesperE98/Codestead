import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeFolder } from "../src/NodeFolder.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function tempDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "codestead-sync-"));
  dirs.push(d);
  return d;
}

describe("NodeFolderTests", () => {
  it("skriver, läser och listar filer, och skapar mappen vid behov", () => {
    const folder = new NodeFolder(path.join(tempDir(), "codestead-gp"));
    expect(folder.names()).toEqual([]);
    folder.write("state", '{"lang":"sv"}');
    folder.write("project.opengl.introduction", "{}");

    expect(folder.names().sort()).toEqual(["project.opengl.introduction", "state"]);
    expect(folder.read("state")?.text).toBe('{"lang":"sv"}');
    expect(folder.read("state")?.modifiedAt).toBeGreaterThan(0);
    expect(folder.read("missing")).toBeNull();
  });

  it("listar inte halvskrivna filer eller annat än .json, och vägrar namn utanför mappen", () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, "state.json.tmp"), "{");
    fs.writeFileSync(path.join(dir, "notes.txt"), "x");
    const folder = new NodeFolder(dir);

    expect(folder.names()).toEqual([]);
    expect(() => folder.write("../escape", "{}")).toThrow();
    expect(folder.read("../escape")).toBeNull();
  });
});
