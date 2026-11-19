import { Menu, type NativeImage, Tray } from "electron";

/**
 * The hub's icon in the system tray, shown while the window is hidden: click to show, or use its menu (HubTray.cs).
 * Electron's Tray cannot be hidden, so a visible tray is created and an invisible one destroyed.
 */
export class HubTray {
  private tray: Tray | null = null;
  private menu: Menu | null = null;
  private tooltip: string;

  onShowRequested: () => void = () => {};
  onQuitRequested: () => void = () => {};
  /** A tool chosen in the menu (its id). */
  onOpenRequested: (id: string) => void = () => {};

  constructor(
    private readonly icon: NativeImage,
    tooltip: string,
  ) {
    this.tooltip = tooltip;
  }

  get visible(): boolean {
    return this.tray !== null;
  }

  set visible(value: boolean) {
    if (value && this.tray === null) {
      this.tray = new Tray(this.icon);
      this.tray.setToolTip(this.tooltip);
      this.tray.on("click", () => this.onShowRequested());
      if (this.menu !== null) this.tray.setContextMenu(this.menu);
    } else if (!value && this.tray !== null) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  set toolTip(value: string) {
    this.tooltip = value;
    this.tray?.setToolTip(value);
  }

  /** "Show", one entry per installed tool, and "Quit". */
  setMenu(show: string, tools: readonly { id: string; label: string }[], quit: string): void {
    this.menu = Menu.buildFromTemplate([
      { label: show, click: () => this.onShowRequested() },
      ...(tools.length > 0 ? [{ type: "separator" as const }] : []),
      ...tools.map((t) => ({ label: t.label, click: () => this.onOpenRequested(t.id) })),
      { type: "separator" },
      { label: quit, click: () => this.onQuitRequested() },
    ]);
    this.tray?.setContextMenu(this.menu);
  }

  dispose(): void {
    this.visible = false;
  }
}
