import type { TextArgs } from "@codestead/common";
import { Changelog, ChangelogEntry, loadJson, NewsDialog, Overlay, saveJson, type SelfUpdate, type Storage, Store, ThemeSwitcher, ToolProfile } from "@codestead/ui";
import hubChangelog from "../../../../src/Hub/changelog.json?raw";
import { Catalog } from "./core/Catalog.js";
import type { CatalogAsset } from "./core/CatalogAsset.js";
import type { CatalogTool } from "./core/CatalogTool.js";
import type { InstalledTool } from "./core/InstalledTool.js";
import { SemVer } from "./core/SemVer.js";
import type { HubApi, HubStartInfo } from "./HubApi.js";
import { HubInfo } from "./HubInfo.js";
import { HubState } from "./HubState.js";
import { HubStrings } from "./HubStrings.js";
import { openSettings } from "./MainWindow.Settings.js";
import { runSmokeTest } from "./MainWindow.SmokeTest.js";

// MainWindow.cs, MainWindow.Tools.cs (checking the catalog and installing, opening, updating, rolling back and
// uninstalling tools) and MainWindow.Background.cs (the tray, hiding while a tool runs, the close button, starting at
// login, and installing tool updates by itself). The page is drawn by MainWindow.Layout.tsx from this state; C#'s
// Render() is `render()`, which tells the view to draw again.

/**
 * The hub: a list of Codestead tools with Install / Open / Update / Uninstall, like JetBrains Toolbox.
 * The tool list comes from the signed catalog; tools are installed per user (see ToolStore).
 */
export class MainWindow extends Store {
  /** How often the hub looks for new versions while it is open. */
  static readonly CheckIntervalMs = 6 * 60 * 60 * 1000;

  readonly storage: Storage;
  readonly state: HubState;
  readonly overlay = new Overlay();

  catalog: Catalog | null = null;
  catalogProblem: string | null = null;
  loading = false;
  checkedAt: Date | null = null;
  hubUpdate: string | null = null;
  /** The hub's own update: download progress 0..100, -1 while the system installs it, null when not running. */
  hubUpdateProgress: number | null = null;
  /** Why the hub's own update could not be installed: the banner then offers the download page instead. */
  hubUpdateFailed: string | null = null;
  /** Tool id → download progress 0..100 (or -1 while unpacking) for running installs. */
  readonly busy = new Map<string, number>();
  readonly errors = new Map<string, string>();

  /** store.All() as last read from the main process (C# reads the store on every Render). */
  installedTools: InstalledTool[] = [];
  /** Each installed tool's profile.json, read with the installed tools. */
  readonly profiles = new Map<string, ToolProfile | null>();

  /** True when the hub had saved settings at start (a missing "seen" version then means an update). */
  readonly existingUser: boolean;

  // MainWindow.Background.cs
  /** Hidden because a tool was opened: show again when the last one closes. */
  hiddenForTools = false;
  /** The tools started from the hub that still run. */
  readonly running = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  /** The last update installed by itself (the tray's tooltip in C#). */
  autoUpdated: string | null = null;

  constructor(
    readonly api: HubApi,
    readonly info: HubStartInfo,
    readonly selfUpdate: SelfUpdate,
  ) {
    super();
    this.storage = api.storage(HubInfo.id);
    const saved = HubState.fromJson(loadJson(this.storage, "state"));
    this.existingUser = saved !== null;
    this.state = saved ?? new HubState();
    if (!HubStrings.isLanguage(this.state.lang)) this.state.lang = "en";
  }

  get lang(): string {
    return this.state.lang ?? "en";
  }

  /** The window's writing direction (C#'s FlowDirection). */
  get dir(): "ltr" | "rtl" {
    return HubStrings.languages.find((l) => l.code === this.lang)?.rightToLeft ? "rtl" : "ltr";
  }

  t(key: string, args?: TextArgs): string {
    return HubStrings.t(this.lang, key, args);
  }

  /** Draws the page again. */
  render(): void {
    this.changed();
  }

  saveState(): void {
    saveJson(this.storage, "state", this.state);
  }

  applyTheme(): void {
    ThemeSwitcher.apply(this.state.theme);
  }

  /** store.Installed(id), from the last reading. */
  installed(id: string): InstalledTool | null {
    return this.installedTools.find((t) => t.id === id) ?? null;
  }

  /** Reads the installed tools and their profiles again (C#: every Render reads the store and the profiles). */
  async reloadInstalled(): Promise<void> {
    this.installedTools = await this.api.installedTools();
    this.profiles.clear();
    for (const t of this.installedTools) this.profiles.set(t.id, ToolProfile.load(this.api.storage(t.id)));
    this.render();
  }

  /** The window has opened (C#: the constructor's end and Opened). */
  async start(): Promise<void> {
    this.applyTheme();
    this.api.setCloseToTray(this.state.closeToTray);
    this.api.onShown(() => {
      this.hiddenForTools = false;
      void this.reloadInstalled();
    });
    this.api.onOpenRequested((id) => this.open(id, this.catalog?.find(id)?.name ?? id));
    this.api.onHideRequested(() => void this.hideToBackground());
    // Back from a tool: its level and achievements may have changed.
    globalThis.addEventListener?.("focus", () => {
      if (!this.overlay.dialogOpen) void this.reloadInstalled();
    });
    await this.reloadInstalled();
    // Started at login: only the tray icon.
    if (this.info.background && this.info.traySupported && !this.info.smokeTest) await this.hideToBackground();

    if (this.info.smokeTest) {
      // After the window has finished opening.
      setTimeout(() => void runSmokeTest(this), 0);
      return;
    }
    // After the hub updated itself: what changed.
    const news = Changelog.newsAtStart(this.storage, Changelog.parse(hubChangelog), HubInfo.version, this.existingUser);
    if (news.length > 0) this.showNews(HubInfo.name, news);
    await this.refresh();
    this.timer = setInterval(() => {
      if (this.state.autoCheckUpdates) void this.refresh();
    }, MainWindow.CheckIntervalMs);
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  // ---------- Actions (MainWindow.Tools.cs) ----------

  async refresh(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.render();
    const result = await this.api.loadCatalog();
    if ("error" in result) {
      this.catalogProblem = this.t("catalog.error", { error: result.error });
    } else {
      this.catalog = Catalog.parse(new TextEncoder().encode(result.catalogJson));
      this.catalogProblem = result.fromCache && result.problem !== null ? this.t("catalog.offline", { error: result.problem }) : null;
      if (!result.fromCache) this.checkedAt = new Date();
    }
    try {
      if (!this.info.smokeTest) {
        const v = await this.selfUpdate.check();
        if (v !== null) this.hubUpdate = v;
      }
      // Installed as a native package: the catalog says whether there is a newer hub.
      const hub = this.catalog?.find(HubInfo.id);
      if (!this.selfUpdate.canUpdateItself && hub && SemVer.isNewer(hub.version, HubInfo.version)) this.hubUpdate = hub.version;
    } catch {
      // The hub's own update check is best effort.
    }
    this.loading = false;
    await this.reloadInstalled();
    await this.installUpdatesByItself();
  }

  static entries(tool: CatalogTool): ChangelogEntry[] {
    return (tool.changes ?? []).map((c) => new ChangelogEntry({ version: c.version, date: c.date, changes: Object.fromEntries(c.changes) }));
  }

  /** The "What's new" dialog for a tool (or the hub itself). */
  showNews(name: string, entries: Iterable<ChangelogEntry>): void {
    NewsDialog.show(this.overlay, { title: this.t("whatsnew.title", { name }), version: this.t("whatsnew.version"), close: this.t("whatsnew.close") }, entries, this.lang);
  }

  async install(tool: CatalogTool, _asset: CatalogAsset): Promise<InstalledTool | null> {
    const before = this.installed(tool.id)?.version ?? null;
    this.busy.set(tool.id, 0);
    this.errors.delete(tool.id);
    this.render();
    const progress = (p: number) => {
      const pct = p >= 1 ? -1 : Math.trunc(p * 100);
      if (this.busy.get(tool.id) === pct) return;
      this.busy.set(tool.id, pct);
      this.render();
    };
    try {
      // The main process installs the same catalog's asset for this computer (Platform.Rid).
      const result = await this.api.install(tool.id, progress);
      if ("error" in result) {
        this.errors.set(tool.id, result.error);
        return null;
      }
      const installed = result.value;
      this.overlay.toast(this.t("tool.installed", { version: installed.version }) + " – " + tool.name);
      // An update: show what changed here, and tell the tool so that it doesn't show the same news again
      // when it starts (the tools keep the version they have shown in their own storage).
      const news = before === null ? [] : Changelog.between(MainWindow.entries(tool), before, installed.version);
      Changelog.markSeen(this.api.storage(tool.id), installed.version);
      if (news.length > 0) this.showNews(tool.name, news);
      return installed;
    } finally {
      this.busy.delete(tool.id);
      await this.reloadInstalled();
    }
  }

  async open(id: string, name: string): Promise<void> {
    const result = await this.api.launch(id, () => this.exited(id));
    if ("error" in result) this.overlay.toast(this.t("tool.startFailed", { name, error: result.error }));
    else await this.started(id);
  }

  async rollBack(id: string): Promise<void> {
    await this.api.rollBack(id);
    await this.reloadInstalled();
  }

  confirmUninstall(id: string, name: string): void {
    this.overlay.confirm(this.t("uninstall.title", { name }), this.t("uninstall.text"), this.t("uninstall.button"), this.t("dialog.cancel"), true, () => {
      void (async () => {
        const result = await this.api.uninstall(id);
        if ("error" in result) this.errors.set(id, result.error);
        else this.errors.delete(id);
        await this.reloadInstalled();
      })();
    });
  }

  openUrl(url: string): void {
    let ok = false;
    try {
      ok = new URL(url).protocol === "https:";
    } catch {
      ok = false;
    }
    if (ok) void this.api.openExternal(url);
  }

  openSettings(): void {
    openSettings(this);
  }

  // ---------- In the background (MainWindow.Background.cs) ----------

  /** Hides the window in the tray, or minimises it where there is no tray (so it can always be found). */
  async hideToBackground(): Promise<void> {
    await this.api.hideToBackground({
      show: this.t("tray.show"),
      tools: this.installedTools.map((t) => ({ id: t.id, label: this.t("tray.open", { name: this.catalog?.find(t.id)?.name ?? t.id }) })),
      quit: this.t("tray.quit"),
    });
  }

  /** Shows the window again (tray click, a second start of the hub, or the last tool closed). */
  async showFromBackground(): Promise<void> {
    this.hiddenForTools = false;
    await this.api.showFromBackground();
  }

  /** A tool was started: hide while it runs (if the setting says so) and come back when it closes. */
  private async started(id: string): Promise<void> {
    this.running.add(id);
    if (this.state.hideOnToolOpen && !this.info.smokeTest) {
      this.hiddenForTools = true;
      await this.hideToBackground();
    }
  }

  private exited(id: string): void {
    this.running.delete(id);
    if (this.hiddenForTools && this.running.size === 0) void this.showFromBackground();
    else this.render();
  }

  /** Installs the tool updates the catalog has, except for tools that are running or busy. */
  async installUpdatesByItself(): Promise<void> {
    const rid = this.info.rid;
    if (!this.state.autoInstallUpdates || this.info.smokeTest || this.catalog === null || rid === null) return;
    for (const installed of [...this.installedTools]) {
      if (this.running.has(installed.id) || this.busy.has(installed.id)) continue;
      const tool = this.catalog.find(installed.id);
      const asset = tool?.assetFor(rid);
      if (!tool || !asset || !SemVer.isNewer(tool.version, installed.version)) continue;
      const done = await this.install(tool, asset);
      // The tray's tooltip says so.
      if (done !== null) {
        this.autoUpdated = this.t("tool.autoUpdated", { name: tool.name, version: done.version });
        this.api.setTrayToolTip(this.autoUpdated);
      }
    }
  }
}
