// The Electron main process of Codestead Linux – C#'s Program.cs and AppHost: answers --version, starts the window
// (the size, minimum size and icon of the C# LearningWindow) and serves the preload's small API: the tool's files in
// the C# app's data folder, web links, file pickers, quitting and the --smoke-test result.

import * as os from "node:os";
import * as path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, shell, type IpcMainEvent } from "electron";
import { storageDirectory } from "@codestead/ui";
import {
  appSelfUpdate,
  detectNativeInstall,
  electronGet,
  latestFromVelopackFeed,
  launcherOf,
  type NativeInstall,
  runVelopackHooks,
  serveSelfUpdate,
  updateFeedUrl,
} from "@codestead/ui/electron-main";
import iconDataUrl from "../../../../src/Linux/Codestead.Linux/Assets/icon.png";
import { ProductInfo } from "../src/ProductInfo.js";
import { type AppInfo, Channels, type FileFilter } from "./api.js";
import { FileStorage } from "./FileStorage.js";

// Velopack's install/update hooks first (C#: VelopackApp.Build().Run() first in Program.Main); it ends the process
// when Setup.exe or an update started the app for one of them.
runVelopackHooks();

const args = process.argv.slice(1);

/**
 * --smoke-test: start the real window, load every chapter, solve a task in the simulator, print "SMOKE OK" and exit
 * with code 0. Used by the installation tests in the release pipeline.
 */
const smokeTest = args.includes("--smoke-test");

/** The smoke test may not hang an installation test: it fails after this long. */
const SmokeTimeoutMs = 5 * 60_000;

if (args.includes("--version")) {
  process.stdout.write(ProductInfo.version + "\n");
  app.exit(0);
} else {
  start();
}

/** Only http and https links leave the app (C#'s LinkOpener). */
function isWebLink(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function start(): void {
  app.setName(ProductInfo.name);
  const storage = new FileStorage(storageDirectory(ProductInfo.toolId, { platform: process.platform, env: process.env, home: os.homedir() }));
  let window: BrowserWindow | null = null;
  /** Installed as a .deb/.rpm/Arch package: asked of the package manager before the window asks about updates. */
  let nativeInstall: NativeInstall | null = null;
  const nativeDetected = detectNativeInstall(ProductInfo.toolId);

  const info: AppInfo = { name: ProductInfo.name, version: ProductInfo.version, smokeTest, storageDirectory: storage.directory };
  const fromOurWindow = (e: { sender: Electron.WebContents }) => window !== null && e.sender === window.webContents;

  ipcMain.on(Channels.info, (e) => void (e.returnValue = info));
  ipcMain.on(Channels.storageLoad, (e, name: unknown) => void (e.returnValue = fromOurWindow(e) && typeof name === "string" ? storage.loadText(name) : null));
  ipcMain.on(Channels.storageSave, (e: IpcMainEvent, name: unknown, json: unknown) => {
    if (fromOurWindow(e) && typeof name === "string" && typeof json === "string") storage.saveText(name, json);
    e.returnValue = null;
  });
  ipcMain.on(Channels.storageRemove, (e: IpcMainEvent, name: unknown) => {
    if (fromOurWindow(e) && typeof name === "string") storage.remove(name);
    e.returnValue = null;
  });
  ipcMain.on(Channels.openExternal, (_e, url: unknown) => {
    if (typeof url === "string" && isWebLink(url)) void shell.openExternal(url);
  });
  ipcMain.handle(Channels.pickFile, async (_e, title: unknown, filters: unknown) => {
    if (window === null) return null;
    const r = await dialog.showOpenDialog(window, {
      title: typeof title === "string" ? title : undefined,
      properties: ["openFile"],
      filters: Array.isArray(filters) ? (filters as FileFilter[]) : undefined,
    });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  });
  ipcMain.handle(Channels.pickFolder, async (_e, title: unknown) => {
    if (window === null) return null;
    const r = await dialog.showOpenDialog(window, { title: typeof title === "string" ? title : undefined, properties: ["openDirectory", "createDirectory"] });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  });
  // The app's own updates (C#: the learning window's SelfUpdate): installed with Setup.exe or as an AppImage (Velopack),
  // or as a .deb/.rpm/Arch package (the package manager, with the version of the AppImage's update feed).
  const get = electronGet(net);
  serveSelfUpdate(ipcMain, () =>
    appSelfUpdate({
      releasesRepo: ProductInfo.releasesRepo,
      packageId: ProductInfo.toolId,
      currentVersion: ProductInfo.version,
      nativeInstall,
      exit: () => app.exit(0),
      get,
      latestVersion: () => latestFromVelopackFeed(get, updateFeedUrl(ProductInfo.releasesRepo, ProductInfo.toolId), ProductInfo.toolId),
      relaunch: { executable: launcherOf(process.execPath) },
    }),
  );
  ipcMain.on(Channels.quit, (_e, code: unknown) => app.exit(typeof code === "number" ? code : 0));
  ipcMain.on(Channels.smokeResult, (_e, ok: unknown, text: unknown) => {
    if (!smokeTest) return;
    if (ok === true) process.stdout.write(`SMOKE OK ${ProductInfo.name} ${ProductInfo.version} (${String(text)})\n`);
    else process.stderr.write(`SMOKE FAILED: ${String(text)}\n`);
    app.exit(ok === true ? 0 : 1);
  });

  const failSmoke = (why: string) => {
    if (!smokeTest) return;
    process.stderr.write(`SMOKE FAILED: ${why}\n`);
    app.exit(1);
  };

  void Promise.all([app.whenReady(), nativeDetected]).then(([, native]) => {
    nativeInstall = native;
    // No menu bar (the window has its own top bar); macOS needs its app and edit menus for quitting and copy/paste.
    Menu.setApplicationMenu(
      process.platform === "darwin" ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]) : null,
    );
    window = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 560,
      title: ProductInfo.name,
      icon: nativeImage.createFromDataURL(iconDataUrl),
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: !app.isPackaged,
      },
    });
    const w = window;
    w.once("ready-to-show", () => w.show());
    // Web links open in the browser; the app never navigates away from its own page.
    w.webContents.setWindowOpenHandler(({ url }) => {
      if (isWebLink(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
    w.webContents.on("will-navigate", (e, url) => {
      if (!url.startsWith("file://") && url !== process.env["VITE_DEV_SERVER_URL"]) e.preventDefault();
    });
    w.webContents.on("render-process-gone", (_e, d) => failSmoke(`the renderer is gone (${d.reason})`));
    w.webContents.on("did-fail-load", (_e, _code, description) => failSmoke(`the page did not load (${description})`));
    w.on("closed", () => (window = null));
    if (smokeTest) setTimeout(() => failSmoke("no result in time"), SmokeTimeoutMs).unref();

    // During development the renderer can come from Vite's server: VITE_DEV_SERVER_URL=http://localhost:5173
    const devUrl = app.isPackaged ? undefined : process.env["VITE_DEV_SERVER_URL"];
    if (devUrl) void w.loadURL(devUrl);
    else void w.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  });

  app.on("window-all-closed", () => app.quit());
}
