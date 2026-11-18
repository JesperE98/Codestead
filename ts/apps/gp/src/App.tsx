// Port of Codestead.GP/App.axaml(.cs): the shared Codestead theme with Codestead GP's accent colour, and the learning
// window with the GP tool (C#: desktop.MainWindow = new LearningWindow(new GpTool(), Program.SmokeTest)).

import "@codestead/ui/codestead.css";
import "./gp.css";
import { Brand, LearningWindow, LearningWindowView, LinkOpener, type Storage } from "@codestead/ui";
import { createRoot, type Root } from "react-dom/client";
import type { CodesteadApi } from "../electron/api.js";
import { type GpHost, GpTool } from "./GpTool.js";
import { hostFileSystem, hostStorage } from "./Host.js";

/** Codestead GP's accent colour: the orange of the first triangle (1.0, 0.5, 0.2) – C#'s App.GpBrand. */
export const GpBrand = Brand.GP;

/** The running app: its window, its tool and the errors React reported while rendering. */
export interface RunningApp {
  window: LearningWindow;
  tool: GpTool;
  root: Root;
  /** Errors thrown while rendering (the smoke test fails on them). */
  renderErrors: unknown[];
}

/** The tool's host in Electron: the course worker, paths and pickers through the preload, the page's clipboard. */
export function electronHost(api: CodesteadApi): GpHost {
  return {
    course: api.course,
    fs: hostFileSystem(api),
    pickFile: (title, filters, startFolder) => api.pickFile(title, filters, startFolder),
    pickFolder: (title, startFolder) => api.pickFolder(title, startFolder),
    copyText: (text) => navigator.clipboard.writeText(text),
  };
}

/** Starts Codestead GP in `container`. */
export function startApp(container: HTMLElement, api: CodesteadApi, storage: Storage = hostStorage(api), host: GpHost = electronHost(api)): RunningApp {
  // The tool's own accent colour (the meaning colours come from the shared theme).
  GpBrand.applyTo(document);
  // Web links open in the browser (only http and https, checked again by the main process).
  LinkOpener.open = (url) => api.openExternal(url);
  // C# also installs DeadKeys here (~ with a dead key on Linux); Chromium composes dead keys itself.

  const tool = new GpTool(host);
  const window = new LearningWindow(tool, { storage, smokeTest: api.info.smokeTest });
  const renderErrors: unknown[] = [];
  const root = createRoot(container, {
    onUncaughtError: (e) => {
      renderErrors.push(e);
      console.error(e);
    },
    onCaughtError: (e) => {
      renderErrors.push(e);
      console.error(e);
    },
  });
  root.render(<LearningWindowView window={window} />);
  return { window, tool, root, renderErrors };
}
