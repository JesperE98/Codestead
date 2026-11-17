// Port of Codestead.Linux/App.axaml(.cs): the shared Codestead theme with Codestead Linux's accent colour, and the
// learning window with the Linux tool (C#: desktop.MainWindow = new LearningWindow(new LinuxTool(), smokeTest)).

import "@codestead/ui/codestead.css";
import { Brand, LearningWindow, LearningWindowView, LinkOpener, type Storage } from "@codestead/ui";
import { createRoot, type Root } from "react-dom/client";
import type { CodesteadApi } from "../electron/api.js";
import { hostStorage } from "./Host.js";
import { LinuxTool } from "./LinuxTool.js";

/** The running app: its window, its tool and the errors React reported while rendering. */
export interface RunningApp {
  window: LearningWindow;
  tool: LinuxTool;
  root: Root;
  /** Errors thrown while rendering (the smoke test fails on them). */
  renderErrors: unknown[];
}

/** Starts Codestead Linux in `container`. */
export function startApp(container: HTMLElement, api: CodesteadApi, storage: Storage = hostStorage(api)): RunningApp {
  // The tool's own accent colour (the meaning colours come from the shared theme).
  Brand.Linux.applyTo(document);
  // Web links open in the browser (only http and https, checked again by the main process).
  LinkOpener.open = (url) => api.openExternal(url);
  // C# also installs DeadKeys here (~ with a dead key on Linux); Chromium composes dead keys itself.

  const tool = new LinuxTool();
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
