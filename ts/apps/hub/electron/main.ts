import { type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appSelfUpdate, detectNativeInstall, electronGet, launcherOf, type NativeInstall, runVelopackHooks, serveSelfUpdate } from "@codestead/ui/electron-main";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, shell } from "electron";
import iconData from "../../../../src/Hub/Codestead.Hub/Assets/icon.png?inline";
import { Catalog } from "../src/core/Catalog.js";
import { CatalogClient } from "../src/core/CatalogClient.js";
import { CatalogVerifier } from "../src/core/CatalogVerifier.js";
import { Autostart } from "../src/core/Autostart.js";
import { messageOf } from "../src/core/Errors.js";
import { fetchHttpClient } from "../src/core/Http.js";
import { Platform } from "../src/core/Platform.js";
import { isSafeId } from "../src/core/SafeId.js";
import { SingleInstance } from "../src/core/SingleInstance.js";
import { ToolStore } from "../src/core/ToolStore.js";
import { TraySupport } from "../src/core/TraySupport.js";
import type { CatalogLoad, HubStartInfo, Outcome, TrayMenu } from "../src/HubApi.js";
import { HubInfo } from "../src/HubInfo.js";
import { HubOptions } from "../src/HubOptions.js";
import { Ipc } from "../src/ipc.js";
import { FileStorage } from "./FileStorage.js";
import { HubTray } from "./HubTray.js";

// The hub's main process: Program.cs (--version, one hub per user, the options), App.axaml.cs (the window, starting in
// the background) and the parts of MainWindow that need the file system, the network or processes – the ToolStore,
// the CatalogClient, starting tools, the tray (MainWindow.Background.cs) and the smoke test's end.

// Velopack's install/update hooks first (C#: VelopackApp.Build().Run() first in Program.Main); it ends the process
// when Setup.exe or an update started the hub for one of them.
runVelopackHooks();

// The built-in public key for catalog.json (build/catalog-signing.pub.pem), when the repository has one (HubInfo.cs's
// CatalogPublicKey; only the main process has it).
const catalogKeys = import.meta.glob<string>("../../../../build/catalog-signing.pub.pem", { query: "?raw", import: "default", eager: true });
const catalogPublicKey: string | null = Object.values(catalogKeys)[0] ?? null;

const args = process.argv.slice(1);
/** CODESTEAD_HUB_E2E=1: the end-to-end tests give their own catalog (see HubOptions.parse). */
const options = HubOptions.parse(args, process.cwd(), process.env.CODESTEAD_HUB_E2E === "1");

const dataRoot = Platform.dataRoot();
const rid = Platform.rid();
const store = new ToolStore(dataRoot);
/** C#: new HttpClient { Timeout = 10 minutes }; Electron's net.fetch uses the system's proxy settings. */
const http = fetchHttpClient((url, init) => net.fetch(url, init), 10 * 60 * 1000);
const verifier = new CatalogVerifier(options.publicKeyFile !== null ? readFileSync(options.publicKeyFile, "utf8") : catalogPublicKey);
const catalogClient = new CatalogClient(http, verifier, join(dataRoot, "hub", "catalog"), options.catalog ?? CatalogClient.defaultUrl(HubInfo.releasesRepo));
const autostart = new Autostart(HubInfo.id);
const traySupported = !options.smokeTest && TraySupport.available();

/** The last catalog loaded: installs use its packages (C# installs from the catalog the window shows). */
let catalog: Catalog | null = null;
let window: BrowserWindow | null = null;
let tray: HubTray | null = null;
let quitting = false;
let closeToTray = false;
let instance: SingleInstance | null = null;
/** The tools started from the hub that still run. */
const running = new Map<number, ChildProcess>();
/** Installed as a .deb/.rpm/Arch package (asked of the package manager before the window asks about updates). */
let nativeInstall: NativeInstall | null = null;

const icon = nativeImage.createFromDataURL(iconData);

function send(channel: string, ...values: unknown[]): void {
  if (window && !window.isDestroyed()) window.webContents.send(channel, ...values);
}

function createWindow(): void {
  window = new BrowserWindow({
    title: HubInfo.name,
    width: 980,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    icon,
    show: false,
    backgroundColor: "#f6f7f9",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.on("page-title-updated", (e) => e.preventDefault());
  // Links open in the browser, never in the hub's window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (e, url) => {
    if (url !== window?.webContents.getURL()) {
      e.preventDefault();
      void openExternal(url);
    }
  });
  window.once("ready-to-show", () => {
    if (!options.background) window?.show();
    else if (!traySupported) {
      // Started at login without a tray: minimised.
      window?.showInactive();
      window?.minimize();
    }
    // Started at login with a tray: the window calls hideToBackground once it has its texts.
  });
  // The close button hides the hub in the tray when the setting says so.
  window.on("close", (e) => {
    if (quitting || options.smokeTest || !closeToTray) return;
    e.preventDefault();
    send(Ipc.hideRequested);
  });
  // The hub can live in the tray with its window hidden, so it ends when the window really closes.
  window.on("closed", () => {
    window = null;
    tray?.dispose();
    app.quit();
  });
  if (options.smokeTest) {
    window.webContents.on("render-process-gone", (_e, details) => smokeTestDone(false, `the window's process ended (${details.reason})`));
    window.webContents.on("preload-error", (_e, _path, error) => smokeTestDone(false, `preload: ${messageOf(error)}`));
    // Never hang an installation test.
    setTimeout(() => smokeTestDone(false, "the smoke test did not finish in 5 minutes"), 5 * 60 * 1000).unref();
  }

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) void window.loadURL(devServer);
  else void window.loadFile(join(__dirname, "..", "dist", "index.html"));
}

function hideToBackground(menu: TrayMenu): void {
  if (!window) return;
  if (tray === null) {
    window.minimize();
    return;
  }
  tray.setMenu(menu.show, menu.tools, menu.quit);
  tray.visible = true;
  window.hide();
}

/** Shows the window again (tray click, a second start of the hub, or the last tool closed). */
function showFromBackground(): void {
  if (!window) return;
  window.show();
  if (window.isMinimized()) window.restore();
  window.focus();
  if (tray !== null) tray.visible = false;
  send(Ipc.shown);
}

function quit(): void {
  quitting = true;
  tray?.dispose();
  window?.close();
}

async function openExternal(url: string): Promise<void> {
  let protocol = "";
  try {
    protocol = new URL(url).protocol;
  } catch {
    return;
  }
  if (protocol === "https:" || protocol === "http:") await shell.openExternal(url);
}

/**
 * The hub's own updates. A native package learns of a new hub from the signed catalog (as the window does when the hub
 * cannot update itself) and starts again as `relaunchArgs`.
 */
function selfUpdate(relaunchArgs: readonly string[], inheritOutput: boolean) {
  return appSelfUpdate({
    releasesRepo: HubInfo.releasesRepo,
    packageId: HubInfo.id,
    currentVersion: HubInfo.version,
    nativeInstall,
    exit: () => app.exit(0),
    get: electronGet(net),
    latestVersion: async () => (catalog ?? (await catalogClient.load()).catalog).find(HubInfo.id)?.version ?? null,
    relaunch: { executable: launcherOf(process.execPath), args: relaunchArgs, inheritOutput },
    log: (line) => console.log(`SELF-UPDATE ${line}`),
  });
}

/**
 * --smoke-test --self-update-test (packaging/native-update-test.sh): the update button of a hub installed as a native
 * package, without the window – the catalog (--catalog, --public-key, as the smoke test's) names a newer hub, which is
 * downloaded from its release, checked, installed and started with the same smoke test (its output goes to this one's).
 */
async function selfUpdateTest(): Promise<void> {
  const updater = selfUpdate(
    args.filter((a) => a !== "--self-update-test"),
    true,
  );
  console.log(
    `SELF-UPDATE ${HubInfo.version}: installed as ${nativeInstall?.kind ?? "no native package"}, ` +
      `canUpdateItself=${updater.canUpdateItself}, asksForPassword=${updater.asksForPassword === true}`,
  );
  catalog = (await catalogClient.load()).catalog;
  const version = await updater.check();
  if (version === null) throw new Error("no newer hub in the catalog");
  console.log(`SELF-UPDATE available: ${version}`);
  let shown: number | null = null;
  await updater.downloadAndRestart((percent) => {
    const step = percent < 0 ? -1 : Math.floor(percent / 50);
    if (step === shown) return;
    shown = step;
    console.log(percent < 0 ? "SELF-UPDATE installing" : `SELF-UPDATE downloading ${percent} %`);
  });
}

let smokeFinished = false;
function smokeTestDone(ok: boolean, text: string): void {
  if (smokeFinished) return;
  smokeFinished = true;
  if (ok) console.log(`SMOKE OK ${HubInfo.name} ${HubInfo.version} (${text})`);
  else console.error("SMOKE FAILED: " + text);
  app.exit(ok ? 0 : 1);
}

function outcome<T>(action: () => Promise<T>): Promise<Outcome<T>> {
  return action().then(
    (value) => ({ value }),
    (e: unknown) => ({ error: messageOf(e) }),
  );
}

function registerIpc(): void {
  const info: HubStartInfo = {
    smokeTest: options.smokeTest,
    background: options.background,
    catalog: options.catalog?.href ?? null,
    install: options.install,
    rid,
    dataRoot: store.root,
    traySupported,
    autostartSupported: Autostart.supported(),
  };
  ipcMain.handle(Ipc.info, () => info);

  // Storage: the hub's own and each tool's data folder (ids and names are checked: they become paths).
  const storageFor = (toolId: unknown, name: unknown) => {
    if (typeof toolId !== "string" || !isSafeId(toolId) || typeof name !== "string" || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(name)) return null;
    return new FileStorage(toolId);
  };
  ipcMain.on(Ipc.storageLoad, (e, toolId: unknown, name: string) => {
    e.returnValue = storageFor(toolId, name)?.loadText(name) ?? null;
  });
  ipcMain.on(Ipc.storageSave, (e, toolId: unknown, name: string, json: unknown) => {
    if (typeof json === "string") storageFor(toolId, name)?.saveText(name, json);
    e.returnValue = null;
  });
  ipcMain.on(Ipc.storageRemove, (e, toolId: unknown, name: string) => {
    storageFor(toolId, name)?.remove(name);
    e.returnValue = null;
  });

  ipcMain.handle(Ipc.loadCatalog, async (): Promise<CatalogLoad> => {
    try {
      const r = await catalogClient.load();
      catalog = r.catalog;
      return { catalogJson: new TextDecoder().decode(Catalog.serialize(r.catalog)), fromCache: r.fromCache, problem: r.problem };
    } catch (e) {
      return { error: messageOf(e) };
    }
  });
  ipcMain.handle(Ipc.installedTools, () => store.all());
  ipcMain.handle(Ipc.install, (e, call: number, toolId: string) =>
    outcome(async () => {
      const tool = catalog?.find(toolId) ?? null;
      if (tool === null) throw new Error(`${toolId} is not in the catalog.`);
      const asset = rid === null ? null : tool.assetFor(rid);
      if (asset === null) throw new Error(`${toolId} has no package for ${rid}.`);
      return await store.install(tool, asset, http, (fraction) => {
        if (!e.sender.isDestroyed()) e.sender.send(Ipc.progress, call, fraction);
      });
    }),
  );
  ipcMain.handle(Ipc.rollBack, (_e, toolId: string) => store.rollBack(toolId));
  ipcMain.handle(Ipc.uninstall, (_e, toolId: string) => outcome(async () => (await store.uninstall(toolId), null)));
  ipcMain.handle(Ipc.launch, (e, call: number, toolId: string) =>
    outcome(async () => {
      const child = await store.launch(toolId, []);
      running.set(call, child);
      child.once("exit", () => {
        running.delete(call);
        if (!e.sender.isDestroyed()) e.sender.send(Ipc.exited, call);
      });
      return null;
    }),
  );
  ipcMain.handle(Ipc.smokeLaunch, (_e, toolId: string) =>
    outcome(async () => {
      const child = await store.launch(toolId, ["--smoke-test"], true);
      let output = "";
      child.stdout?.setEncoding("utf8").on("data", (d: string) => (output += d));
      const exitCode = await new Promise<number | null>((resolve) => {
        const timer = setTimeout(() => {
          child.kill();
          resolve(null);
        }, 3 * 60 * 1000);
        child.once("close", (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });
      console.log(output.trim());
      return { exitCode, output };
    }),
  );

  ipcMain.handle(Ipc.hideToBackground, (_e, menu: TrayMenu) => hideToBackground(menu));
  ipcMain.handle(Ipc.showFromBackground, () => showFromBackground());
  ipcMain.on(Ipc.setCloseToTray, (_e, value: boolean) => {
    closeToTray = value === true;
  });
  ipcMain.on(Ipc.setTrayToolTip, (_e, text: string) => {
    if (tray !== null) tray.toolTip = String(text);
  });
  ipcMain.handle(Ipc.startsWithComputer, () => autostart.isEnabled);
  ipcMain.handle(Ipc.setStartsWithComputer, (_e, value: boolean) => {
    if (value) {
      // An AppImage is started by its own file; an unpacked build needs its app folder; a packaged hub on Linux by its
      // launcher script next to Electron (<exe> for <exe>.bin, packaging/ts/launcher.sh), which decides about the sandbox.
      const executable = process.env.APPIMAGE ?? launcherOf(process.execPath);
      autostart.enable(HubInfo.name, executable, app.isPackaged || process.env.APPIMAGE ? "--background" : `"${app.getAppPath()}" --background`);
    } else autostart.disable();
  });

  ipcMain.handle(Ipc.openExternal, (_e, url: string) => openExternal(url));
  ipcMain.handle(Ipc.pickFile, async () => {
    const r = window ? await dialog.showOpenDialog(window, { properties: ["openFile"] }) : null;
    return r && !r.canceled ? (r.filePaths[0] ?? null) : null;
  });
  ipcMain.handle(Ipc.pickFolder, async () => {
    const r = window ? await dialog.showOpenDialog(window, { properties: ["openDirectory"] }) : null;
    return r && !r.canceled ? (r.filePaths[0] ?? null) : null;
  });
  // The hub's own updates (C#: MainWindow's SelfUpdate): installed with Setup.exe or as an AppImage (Velopack), or as a
  // native package (the package manager); it starts again without arguments.
  serveSelfUpdate(ipcMain, () => selfUpdate([], false));
  ipcMain.on(Ipc.smokeTestDone, (_e, ok: boolean, text: string) => smokeTestDone(ok === true, String(text)));
  ipcMain.on(Ipc.quit, () => quit());
}

async function main(): Promise<void> {
  if (args.includes("--version")) {
    console.log(HubInfo.version);
    app.exit(0);
    return;
  }
  const native = detectNativeInstall(HubInfo.id);
  if (options.selfUpdateTest) {
    await app.whenReady();
    nativeInstall = await native;
    await selfUpdateTest().catch((e: unknown) => {
      console.error(`SELF-UPDATE FAILED: ${messageOf(e)}`);
      app.exit(1);
    });
    return;
  }
  // One hub per user: a second start shows the first one (not in the installation tests).
  if (!options.smokeTest) {
    instance = new SingleInstance(HubInfo.id);
    if (await instance.notifyRunning()) {
      app.exit(0);
      return;
    }
  }
  await app.whenReady();
  Menu.setApplicationMenu(null);
  if (traySupported) {
    tray = new HubTray(icon, HubInfo.name);
    tray.onShowRequested = showFromBackground;
    tray.onQuitRequested = quit;
    tray.onOpenRequested = (id) => send(Ipc.openRequested, id);
  }
  nativeInstall = await native;
  registerIpc();
  createWindow();
  // A later start of the hub shows this one.
  await instance?.listen(() => showFromBackground());
}

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => instance?.dispose());

main().catch((e: unknown) => {
  console.error(e);
  app.exit(1);
});
