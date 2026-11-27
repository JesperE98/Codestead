import { describe, expect, it } from "vitest";
import { MemoryBackend, MemoryFolder, type RemoteFile, type SyncBackend, SyncEngine, type ToolFolders } from "../src/index.js";

const GP = "codestead-gp";

/** A computer with its own tool folder, bases and backups, all stamped by a shared clock. */
function computer(clock: { t: number }): ToolFolders & { files: MemoryFolder; bases: MemoryFolder; backups: MemoryFolder } {
  const now = () => clock.t;
  return { tool: GP, files: new MemoryFolder(now), bases: new MemoryFolder(now), backups: new MemoryFolder(now) };
}

const state = (progress: string[]) => JSON.stringify({ lang: "sv", progress: Object.fromEntries(progress.map((k) => [k, true])) });
const progressOf = (text: string | undefined) => Object.keys(JSON.parse(text ?? "{}").progress ?? {}).sort();

describe("SyncEngineTests", () => {
  it("två datorer får samma framsteg, och filer som hör till datorn synkas inte", async () => {
    const clock = { t: 1000 };
    const backend = new MemoryBackend(() => clock.t);
    const engine = new SyncEngine(backend, { now: () => clock.t });
    const a = computer(clock);
    const b = computer(clock);
    a.files.write("state", state(["a1"]));
    a.files.write("folders", JSON.stringify({ folders: { x: "C:\\Projects" } }));
    a.files.write("profile", JSON.stringify({ xp: 10 }));
    b.files.write("state", state(["b1"]));

    const first = await engine.syncTool(a);
    expect(first).toEqual([{ name: "state", pulled: false, pushed: true, backup: null, error: null }]);
    expect([...backend.rows.keys()]).toEqual(["codestead-gp/state"]);

    clock.t = 2000;
    await engine.syncTool(b);
    expect(progressOf(b.files.read("state")?.text)).toEqual(["a1", "b1"]);

    clock.t = 3000;
    await engine.syncTool(a);
    expect(progressOf(a.files.read("state")?.text)).toEqual(["a1", "b1"]);
    expect(progressOf(backend.rows.get("codestead-gp/state")?.text)).toEqual(["a1", "b1"]);
  });

  it("en synk utan ändringar hämtar, laddar upp och skriver ingenting", async () => {
    const backend = new MemoryBackend();
    const engine = new SyncEngine(backend);
    const a = computer({ t: 1 });
    a.files.write("state", state(["a1"]));
    await engine.syncTool(a);

    let gets = 0;
    const counting: SyncBackend = {
      list: (tool) => backend.list(tool),
      get: (tool, name) => {
        gets++;
        return backend.get(tool, name);
      },
      put: (tool, name, text, expected) => backend.put(tool, name, text, expected),
    };
    const before = a.files.read("state");
    const report = await new SyncEngine(counting).syncTool(a);

    expect(report).toEqual([{ name: "state", pulled: false, pushed: false, backup: null, error: null }]);
    expect(gets).toBe(0);
    expect(a.files.read("state")).toBe(before);
  });

  it("skriver en annan dator under synken slås det ihop igen i stället för att skrivas över", async () => {
    const backend = new MemoryBackend();
    const engine = new SyncEngine(backend);
    const a = computer({ t: 1 });
    a.files.write("state", state(["a1"]));
    await engine.syncTool(a);

    a.files.write("state", state(["a1", "a2"]));
    backend.beforePut = () => backend.set(GP, "state", state(["a1", "b1"]));
    await engine.syncTool(a);

    expect(progressOf(backend.rows.get("codestead-gp/state")?.text)).toEqual(["a1", "a2", "b1"]);
    expect(progressOf(a.files.read("state")?.text)).toEqual(["a1", "a2", "b1"]);
    expect(backend.rows.get("codestead-gp/state")?.revision).toBe(3);
  });

  it("'Radera alla framsteg' på en dator når den andra", async () => {
    const clock = { t: 1 };
    const backend = new MemoryBackend(() => clock.t);
    const engine = new SyncEngine(backend);
    const a = computer(clock);
    const b = computer(clock);
    a.files.write("state", state(["a1", "a2"]));
    await engine.syncTool(a);
    await engine.syncTool(b);
    expect(progressOf(b.files.read("state")?.text)).toEqual(["a1", "a2"]);

    clock.t = 5;
    a.files.write("state", state([]));
    await engine.syncTool(a);
    await engine.syncTool(b);

    expect(progressOf(b.files.read("state")?.text)).toEqual([]);
  });

  it("koden i editorn: vid krock vinner den senast sparade och den andra sparas som säkerhetskopia", async () => {
    const clock = { t: Date.UTC(2026, 10, 27, 12, 0, 0) };
    const backend = new MemoryBackend(() => clock.t);
    const engine = new SyncEngine(backend, { now: () => clock.t });
    const a = computer(clock);
    const name = "project.opengl.hello-window";
    a.files.write(name, JSON.stringify({ "main.cpp": "base" }));
    await engine.syncTool(a);

    clock.t += 1000;
    backend.set(GP, name, JSON.stringify({ "main.cpp": "from the other computer" }));
    clock.t += 1000;
    a.files.write(name, JSON.stringify({ "main.cpp": "local, saved last" }));
    const [report] = await engine.syncTool(a);

    expect(report?.pushed).toBe(true);
    expect(JSON.parse(backend.rows.get(`${GP}/${name}`)!.text)["main.cpp"]).toBe("local, saved last");
    expect(report?.backup).toMatch(/^project\.opengl\.hello-window\.remote-\d{14}$/);
    expect(JSON.parse(a.backups.read(report!.backup!)!.text)["main.cpp"]).toBe("from the other computer");
  });

  it("en fil som inte går att synka stoppar inte de andra", async () => {
    const backend = new MemoryBackend();
    const failing: SyncBackend = {
      list: (tool) => backend.list(tool),
      get: (tool, name) => backend.get(tool, name),
      put: (tool, name, text, expected) =>
        name === "state" ? Promise.reject(new Error("offline")) : backend.put(tool, name, text, expected),
    };
    const a = computer({ t: 1 });
    a.files.write("state", state(["a1"]));
    a.files.write("project.opengl.textures", JSON.stringify({ "main.cpp": "x" }));

    const report = await new SyncEngine(failing).syncTool(a);

    expect(report.map((r) => [r.name, r.pushed, r.error])).toEqual([
      ["project.opengl.textures", true, null],
      ["state", false, "offline"],
    ]);
    expect(a.bases.read("state")).toBeNull();
  });

  it("ger upp efter några försök om en annan dator hela tiden hinner före", async () => {
    const backend = new MemoryBackend();
    const busy: SyncBackend = {
      list: (tool) => backend.list(tool),
      get: (tool, name) => backend.get(tool, name),
      put: async (tool, name, text, expected) => {
        const row: RemoteFile = backend.set(tool, name, state(["other"]));
        return expected === row.revision ? backend.put(tool, name, text, expected) : { ok: false, current: row };
      },
    };
    const a = computer({ t: 1 });
    a.files.write("state", state(["a1"]));

    const [report] = await new SyncEngine(busy, { attempts: 3 }).syncTool(a);

    expect(report?.error).toBe("another computer kept writing the file");
    expect(a.bases.read("state")).toBeNull();
  });
});
