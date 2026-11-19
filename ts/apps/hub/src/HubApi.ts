import type { SelfUpdate, Storage } from "@codestead/ui";
import type { InstalledTool } from "./core/InstalledTool.js";

// What the window gets from the main process (electron/preload.ts puts it on window.codestead). The hub's logic that
// needs the file system, the network or processes (ToolStore, CatalogClient, launching, the tray, autostart) runs in
// the main process; the window keeps the C# MainWindow's state and texts. Tests give the window a fake.

/** How the hub was started, and what this computer offers. */
export interface HubStartInfo {
  /** --smoke-test (installation tests): render every language, optionally install and start a tool, then exit. */
  smokeTest: boolean;
  /** --background: started at login. */
  background: boolean;
  /** A catalog given on the command line (smoke and end-to-end tests); null: the releases repository's. */
  catalog: string | null;
  /** --install &lt;id&gt; with --smoke-test. */
  install: string | null;
  /** The catalog's runtime id for this computer ("linux-x64", "win-x64"), or null. */
  rid: string | null;
  /** Where the tools are installed (ToolStore.Root). */
  dataRoot: string;
  /** The desktop shows tray icons (TraySupport.Available). */
  traySupported: boolean;
  /** Starting at login is possible (Autostart.Supported). */
  autostartSupported: boolean;
}

/** The result of loading the catalog: the catalog as JSON (Catalog.serialize), or the CatalogException's message. */
export type CatalogLoad = { catalogJson: string; fromCache: boolean; problem: string | null } | { error: string };

/** A result that is a value or an error message. */
export type Outcome<T> = { value: T } | { error: string };

/** The tray menu while the window is hidden. */
export interface TrayMenu {
  show: string;
  tools: { id: string; label: string }[];
  quit: string;
}

export interface HubApi {
  info(): Promise<HubStartInfo>;

  /** Each tool's data folder (the hub's own is "codestead-hub"), as @codestead/ui's Storage. */
  storage(toolId: string): Storage;

  // ---------- The catalog and the tools (ToolStore, CatalogClient) ----------
  loadCatalog(): Promise<CatalogLoad>;
  /** store.All(). */
  installedTools(): Promise<InstalledTool[]>;
  /** Installs the catalog's current version of a tool for this computer; `progress` gets 0..1. */
  install(toolId: string, progress: (fraction: number) => void): Promise<Outcome<InstalledTool>>;
  rollBack(toolId: string): Promise<InstalledTool | null>;
  uninstall(toolId: string): Promise<Outcome<null>>;
  /** Starts an installed tool; `onExit` is called when it ends. */
  launch(toolId: string, onExit: () => void): Promise<Outcome<null>>;
  /** Starts a tool with --smoke-test and waits for it (at most 3 minutes): its exit code and standard output. */
  smokeLaunch(toolId: string): Promise<Outcome<{ exitCode: number | null; output: string }>>;

  // ---------- The hub in the background ----------
  /** Hides the window in the tray with this menu, or minimises it where there is no tray. */
  hideToBackground(menu: TrayMenu): Promise<void>;
  /** Shows the window again. */
  showFromBackground(): Promise<void>;
  /** Called when the window was shown again (tray, a second start, or showFromBackground). */
  onShown(listener: () => void): void;
  /** A tool chosen in the tray menu. */
  onOpenRequested(listener: (toolId: string) => void): void;
  /** The close button, when it should hide the hub in the tray. */
  onHideRequested(listener: () => void): void;
  /** Tells the main process what the close button does. */
  setCloseToTray(value: boolean): void;
  /** The tray icon's tooltip (e.g. "Codestead Linux was updated to 0.6.5"). */
  setTrayToolTip(text: string): void;
  startsWithComputer(): Promise<boolean>;
  setStartsWithComputer(value: boolean): Promise<void>;

  // ---------- The app ----------
  /**
   * The hub's own updates (Velopack in the main process, @codestead/ui/electron-main): installed with Setup.exe or as
   * an AppImage it updates itself; otherwise canUpdateItself is false and a newer hub in the catalog is offered as a
   * download.
   */
  readonly selfUpdate: SelfUpdate;
  /** Opens an http(s) address in the browser. */
  openExternal(url: string): Promise<void>;
  pickFile(): Promise<string | null>;
  pickFolder(): Promise<string | null>;
  /** The end of the smoke test: prints SMOKE OK / SMOKE FAILED and exits. */
  smokeTestDone(ok: boolean, text: string): void;
  quit(): void;
}
