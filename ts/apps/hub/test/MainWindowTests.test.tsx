import { MemoryStorage, type SelfUpdate, type Storage } from "@codestead/ui";
import { afterEach, describe, expect, it } from "vitest";
import { Catalog } from "../src/core/Catalog.js";
import { CatalogAsset } from "../src/core/CatalogAsset.js";
import { CatalogChange } from "../src/core/CatalogChange.js";
import { CatalogTool } from "../src/core/CatalogTool.js";
import { type InstalledTool, installedTool } from "../src/core/InstalledTool.js";
import type { HubApi, HubStartInfo, Outcome, TrayMenu } from "../src/HubApi.js";
import { MainWindow } from "../src/MainWindow.js";
import { MainWindowView } from "../src/MainWindow.Layout.js";
import { noSelfUpdate } from "../src/SelfUpdate.js";
import { setUpDocument } from "./jsdomRepoEnvironment.js";

// jsdom, set up here (see jsdomRepoEnvironment.ts), then the testing library. The file's worker ends with it.
await setUpDocument();
const { act, cleanup, fireEvent, render, screen, within } = await import("@testing-library/react");

// Not a port of a C# test (the C# window has none): the window's logic against a fake main process.

afterEach(cleanup);

const asset = new CatalogAsset({ url: "https://example.org/a.tar.gz", sha256: "0".repeat(64), size: 10, executable: "tool" });
const tool = (id: string, name: string, version: string, versions: string[] = []) =>
  new CatalogTool({
    id,
    name,
    version,
    description: { en: `${name} in English`, sv: `${name} på svenska` },
    changes: versions.map((v) => new CatalogChange({ version: v, date: "2026-11-01", changes: { en: [`${name} ${v} news`] } })),
    assets: { "linux-x64": asset },
  });

class FakeApi implements HubApi {
  readonly selfUpdate = noSelfUpdate;
  readonly storages = new Map<string, MemoryStorage>();
  installedList: InstalledTool[] = [installedTool("codestead-linux", "0.6.3", "Codestead.Linux", null, "/x")];
  catalog = new Catalog({ schema: 1, generated: "2026", tools: [tool("codestead-gp", "Codestead GP", "0.2.5", ["0.2.5"]), tool("codestead-hub", "Codestead", "9.9.9"), tool("codestead-linux", "Codestead Linux", "0.6.5", ["0.6.5", "0.6.4", "0.6.3"])] });
  launched: string[] = [];
  hidden: TrayMenu[] = [];
  closeToTray: boolean | null = null;
  info = (): Promise<HubStartInfo> => Promise.resolve(startInfo);
  storage = (id: string): Storage => {
    if (!this.storages.has(id)) this.storages.set(id, new MemoryStorage());
    return this.storages.get(id)!;
  };
  loadCatalog = () => Promise.resolve({ catalogJson: new TextDecoder().decode(Catalog.serialize(this.catalog)), fromCache: false, problem: null });
  installedTools = () => Promise.resolve([...this.installedList]);
  install = async (id: string, progress: (f: number) => void): Promise<Outcome<InstalledTool>> => {
    progress(0.5);
    progress(1);
    const t = this.catalog.find(id)!;
    const before = this.installedList.find((x) => x.id === id);
    const done = installedTool(id, t.version, "tool", before?.version ?? null, "/x");
    this.installedList = [...this.installedList.filter((x) => x.id !== id), done];
    return { value: done };
  };
  rollBack = () => Promise.resolve(null);
  uninstall = async (id: string): Promise<Outcome<null>> => {
    this.installedList = this.installedList.filter((x) => x.id !== id);
    return { value: null };
  };
  launch = async (id: string): Promise<Outcome<null>> => {
    this.launched.push(id);
    return { value: null };
  };
  smokeLaunch = () => Promise.resolve({ error: "not here" });
  hideToBackground = async (menu: TrayMenu) => void this.hidden.push(menu);
  showFromBackground = () => Promise.resolve();
  onShown = () => {};
  onOpenRequested = () => {};
  onHideRequested = () => {};
  setCloseToTray = (v: boolean) => void (this.closeToTray = v);
  setTrayToolTip = () => {};
  startsWithComputer = () => Promise.resolve(false);
  setStartsWithComputer = () => Promise.resolve();
  openExternal = () => Promise.resolve();
  pickFile = () => Promise.resolve(null);
  pickFolder = () => Promise.resolve(null);
  smokeTestDone = () => {};
  quit = () => {};
}

const startInfo: HubStartInfo = { smokeTest: false, background: false, catalog: null, install: null, rid: "linux-x64", dataRoot: "/data/codestead", traySupported: true, autostartSupported: true };

async function open(api = new FakeApi(), selfUpdate: SelfUpdate = noSelfUpdate) {
  const w = new MainWindow(api, startInfo, selfUpdate);
  render(<MainWindowView w={w} />);
  await act(() => w.start());
  w.dispose();
  return { w, api };
}

const card = (id: string) => within(document.querySelector<HTMLElement>(`[data-tool="${id}"]`)!);

describe("MainWindowTests", () => {
  it("lists the catalog's tools with their state, without the hub, and offers the hub's update", async () => {
    await open();
    expect(card("codestead-linux").getByText("Installed: 0.6.3 · Latest version: 0.6.5")).toBeTruthy();
    expect(card("codestead-gp").getByText("Latest version: 0.2.5")).toBeTruthy();
    expect(document.querySelector('[data-tool="codestead-hub"]')).toBeNull();
    expect(screen.getByText("A new version of Codestead is available: 9.9.9")).toBeTruthy();
    expect(screen.getByText("Download the new version")).toBeTruthy();
  });

  it("installed as a native package: the update button, the password note, and the download page when it fails", async () => {
    const seen: number[] = [];
    let fail = true;
    const native: SelfUpdate = {
      canUpdateItself: true,
      asksForPassword: true,
      check: () => Promise.resolve("9.9.9"),
      downloadAndRestart: async (progress) => {
        for (const p of [0, 100, -1]) progress(p), seen.push(p);
        if (fail) throw new Error("The password dialog was closed, so the update was not installed.");
      },
    };
    const { w } = await open(new FakeApi(), native);
    expect(screen.getByText("A new version of Codestead is available: 9.9.9")).toBeTruthy();
    expect(screen.getByText("Your system will ask for your password to install the update.")).toBeTruthy();
    expect(screen.queryByText("Download the new version")).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Update and restart" })));
    expect(seen).toEqual([0, 100, -1]);
    expect(screen.getByText(/^The update was not installed: The password dialog was closed/)).toBeTruthy();
    expect(screen.getByText("Download the new version")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Update and restart" })).toBeNull();
    // While the system installs it.
    fail = false;
    w.hubUpdateFailed = null;
    w.hubUpdateProgress = -1;
    act(() => w.render());
    expect(screen.getByText("Installing the update – your system asks for your password …")).toBeTruthy();
  });

  it("installs, shows the news of an update and tells the tool they were seen", async () => {
    const { api } = await open();
    await act(async () => fireEvent.click(card("codestead-linux").getByRole("button", { name: /Update to 0.6.5/ })));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("What's new in Codestead Linux")).toBeTruthy();
    expect(within(dialog).queryByText("Codestead Linux 0.6.4 news")).toBeTruthy();
    expect(within(dialog).queryByText("Codestead Linux 0.6.3 news")).toBeNull();
    expect(api.storages.get("codestead-linux")!.loadText("whatsnew")).toBe('{"seen":"0.6.5"}');
    act(() => fireEvent.keyDown(window, { key: "Escape" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(card("codestead-linux").getByText("Installed: 0.6.5 · up to date")).toBeTruthy();
  });

  it("opens a tool and hides in the tray while it runs", async () => {
    const { api } = await open();
    await act(async () => fireEvent.click(card("codestead-linux").getByRole("button", { name: /Open/ })));
    expect(api.launched).toEqual(["codestead-linux"]);
    expect(api.hidden[0]).toEqual({ show: "Show Codestead", tools: [{ id: "codestead-linux", label: "Open Codestead Linux" }], quit: "Quit" });
  });

  it("uninstalls after asking", async () => {
    const { api } = await open();
    act(() => fireEvent.click(card("codestead-linux").getByText("Uninstall")));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Uninstall Codestead Linux?")).toBeTruthy();
    await act(async () => fireEvent.click(within(dialog).getAllByText("Uninstall").at(-1)!));
    expect(api.installedList).toEqual([]);
    expect(card("codestead-linux").getByText("Latest version: 0.6.5")).toBeTruthy();
  });

  it("saves the settings in the C# hub's state.json", async () => {
    const { api } = await open();
    act(() => fireEvent.click(screen.getByLabelText("Settings")));
    act(() => fireEvent.click(screen.getByRole("switch", { name: "The close button hides the hub in the system tray" })));
    expect(api.closeToTray).toBe(true);
    act(() => fireEvent.click(screen.getByText("Svenska")));
    expect(screen.getByText("Dina verktyg")).toBeTruthy();
    expect(JSON.parse(api.storages.get("codestead-hub")!.loadText("state")!)).toEqual({
      lang: "sv",
      hideOnToolOpen: true,
      closeToTray: true,
      autoCheckUpdates: true,
      autoInstallUpdates: false,
    });
  });
});
