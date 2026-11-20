import { isObject } from "@codestead/learning";

/** Settings saved between runs (state.json in the hub's storage, the same file as the C# hub's). */
export class HubState {
  lang: string | null = null;
  /** null = follow the system, "light" or "dark". */
  theme: string | null = null;
  /** Hide in the tray (or minimise) when a tool is opened, and come back when it closes. */
  hideOnToolOpen = true;
  /** The close button hides the hub in the tray instead of quitting. */
  closeToTray = false;
  /** Look for new versions while the hub is open (every few hours). */
  autoCheckUpdates = true;
  /** Install tool updates by itself (never while the tool runs). */
  autoInstallUpdates = false;
  /** "Not now" on the offer to turn on Chromium's sandbox for the tools (Linux): it is not shown again. */
  sandboxOfferDismissed = false;

  /** The saved state, or null when there is none (Storage.Load&lt;HubState&gt;). Missing values keep their defaults. */
  static fromJson(v: unknown): HubState | null {
    if (!isObject(v)) return null;
    const s = new HubState();
    const str = (x: unknown) => (typeof x === "string" ? x : null);
    const bool = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
    s.lang = str(v.lang);
    s.theme = str(v.theme);
    s.hideOnToolOpen = bool(v.hideOnToolOpen, s.hideOnToolOpen);
    s.closeToTray = bool(v.closeToTray, s.closeToTray);
    s.autoCheckUpdates = bool(v.autoCheckUpdates, s.autoCheckUpdates);
    s.autoInstallUpdates = bool(v.autoInstallUpdates, s.autoInstallUpdates);
    s.sandboxOfferDismissed = bool(v.sandboxOfferDismissed, s.sandboxOfferDismissed);
    return s;
  }
}
