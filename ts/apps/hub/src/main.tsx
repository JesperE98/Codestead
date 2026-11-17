import "@codestead/ui/codestead.css";
import "./hub.css";
import { Brand } from "@codestead/ui";
import { createRoot } from "react-dom/client";
import type { HubApi } from "./HubApi.js";
import { HubInfo } from "./HubInfo.js";
import { MainWindow } from "./MainWindow.js";
import { MainWindowView } from "./MainWindow.Layout.js";
import { noSelfUpdate } from "./SelfUpdate.js";

// The window's start (C#: App.axaml.cs): the hub's accent colour, the window, and its first Render.

declare global {
  interface Window {
    /** electron/preload.ts */
    codestead: HubApi;
  }
}

async function start(): Promise<void> {
  // The tool's own accent colour (the meaning colours come from the shared theme).
  Brand.Hub.applyTo(document);
  const api = window.codestead;
  const w = new MainWindow(api, await api.info(), noSelfUpdate);
  document.title = HubInfo.name;
  createRoot(document.getElementById("root")!).render(<MainWindowView w={w} />);
  await w.start();
}

void start();
