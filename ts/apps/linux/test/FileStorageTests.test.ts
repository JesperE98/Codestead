// The Electron main process's Storage (C#'s Codestead.UI.Storage): <name>.json in the tool's data folder, the same
// folder as the C# app's, written atomically.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { storageDirectory } from "@codestead/ui";
import { afterEach, describe, expect, it } from "vitest";
import { FileStorage } from "../electron/FileStorage.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function temp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "codestead-storage-"));
  dirs.push(d);
  return d;
}

describe("FileStorageTests", () => {
  it("sparar, läser och tar bort <namn>.json; mappen skapas vid första sparningen", () => {
    const dir = path.join(temp(), "codestead-linux");
    const s = new FileStorage(dir);
    expect(s.loadText("state")).toBeNull();
    s.saveText("state", '{"lang":"sv"}');
    s.saveText("shell.ubuntu", "{}");
    expect(fs.readFileSync(path.join(dir, "state.json"), "utf8")).toBe('{"lang":"sv"}');
    expect(s.loadText("shell.ubuntu")).toBe("{}");
    // Atomic: no temp file is left behind.
    expect(fs.readdirSync(dir).sort()).toEqual(["shell.ubuntu.json", "state.json"]);
    s.remove("state");
    s.remove("state");
    expect(s.loadText("state")).toBeNull();
  });

  it("namn som kan lämna mappen ignoreras", () => {
    const root = temp();
    const s = new FileStorage(path.join(root, "app"));
    for (const bad of ["../x", "a/b", "..", "", ".hidden", "a\\b"]) {
      s.saveText(bad, "{}");
      expect(s.loadText(bad)).toBeNull();
    }
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it("sparning är bästa försök: en ogiltig mapp kastar inget", () => {
    const file = path.join(temp(), "fil");
    fs.writeFileSync(file, "");
    const s = new FileStorage(path.join(file, "under"));
    expect(() => s.saveText("state", "{}")).not.toThrow();
    expect(s.loadText("state")).toBeNull();
  });

  it("mappen är C#-appens: $XDG_CONFIG_HOME/Codestead/<id>, %APPDATA% på Windows, CODESTEAD_DATA_DIR först", () => {
    expect(storageDirectory("codestead-linux", { platform: "linux", env: {}, home: "/home/elev" })).toBe("/home/elev/.config/Codestead/codestead-linux");
    expect(storageDirectory("codestead-linux", { platform: "win32", env: { APPDATA: "C:\\Users\\e\\AppData\\Roaming" }, home: "C:\\Users\\e" })).toBe(
      "C:\\Users\\e\\AppData\\Roaming\\Codestead\\codestead-linux",
    );
    expect(storageDirectory("codestead-linux", { platform: "linux", env: { CODESTEAD_DATA_DIR: "/tmp/d" }, home: "/home/elev" })).toBe("/tmp/d/codestead-linux");
  });
});
