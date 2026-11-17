import { type ReactNode, useEffect, useRef } from "react";
import { Store, useStore } from "../Store.js";

/** The open dialog. */
interface OpenDialog {
  id: number;
  panel: ReactNode;
  onClose: () => void;
  width: number;
  scroll: boolean;
}

interface Toast {
  id: number;
  text: string;
}

/**
 * The overlay layer that shows modal panels (dialogs) and short notices (toasts) on top of the window content
 * (C#'s OverlayHost). This is the part the app talks to; {@link OverlayHost} shows it.
 */
export class Overlay extends Store {
  private nextId = 1;
  private open: OpenDialog | null = null;
  private readonly waiting: (() => void)[] = [];
  private readonly toastList: Toast[] = [];

  /** The open dialog, for {@link OverlayHost}. */
  get dialog(): Readonly<OpenDialog> | null {
    return this.open;
  }

  /** The toasts on screen, oldest first. */
  get toasts(): readonly Readonly<Toast>[] {
    return this.toastList;
  }

  get dialogOpen(): boolean {
    return this.open !== null;
  }

  /**
   * Shows a panel centred on a dimmed background. Escape, the ✕ in the corner or a click outside closes it (calls
   * `onClose`, which must close the dialog: {@link closeDialog} or something that calls it).
   * @param scroll True: the whole panel scrolls when it is taller than the dialog. False: the panel scrolls by itself
   * (it gets the dialog's height), so that it can keep e.g. its buttons in view.
   */
  showDialog(panel: ReactNode, onClose: () => void, width = 480, scroll = true): void {
    this.open = { id: this.nextId++, panel, onClose, width, scroll };
    this.changed();
  }

  closeDialog(): void {
    this.open = null;
    this.changed();
    if (this.waiting.length > 0) setTimeout(() => this.showNextWaiting(), 0);
  }

  /** Closes the open dialog the way its ✕ does (Escape). */
  requestClose(): void {
    this.open?.onClose();
  }

  /**
   * Shows a dialog now if none is open, otherwise when the open one (and those queued before it) have been
   * closed – so a celebration, "What's new" and the update offer never replace each other.
   */
  showWhenFree(show: () => void): void {
    if (!this.dialogOpen && this.waiting.length === 0) show();
    else this.waiting.push(show);
  }

  private showNextWaiting(): void {
    // An action may show something that is not a dialog (a notice): then go on to the next one.
    while (!this.dialogOpen && this.waiting.length > 0) this.waiting.shift()!();
  }

  /** A confirmation dialog with a title, a message and two buttons. */
  confirm(title: string, message: string, confirmLabel: string, cancelLabel: string, danger: boolean, onConfirm: () => void): void {
    const close = () => this.closeDialog();
    this.showDialog(
      <div className="cs-stack" style={{ gap: 12 }}>
        <div className="cs-text" style={{ fontSize: 19, fontWeight: 700 }}>
          {title}
        </div>
        <div className="cs-text" style={{ lineHeight: "22px" }}>
          {message}
        </div>
        <div className="cs-row" style={{ gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="secondary" onClick={close}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "danger" : "primary"}
            onClick={() => {
              this.closeDialog();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>,
      close,
      440,
    );
  }

  /** A short notice at the bottom of the window that disappears by itself. */
  toast(text: string, seconds = 3.5): void {
    const t = { id: this.nextId++, text };
    this.toastList.push(t);
    this.changed();
    setTimeout(() => {
      const i = this.toastList.indexOf(t);
      if (i >= 0) this.toastList.splice(i, 1);
      this.changed();
    }, seconds * 1000);
  }
}

export interface OverlayHostProps {
  overlay: Overlay;
  /** The window content under the dialogs. */
  children?: ReactNode;
  /** More layers over the content (e.g. the notices). */
  layers?: ReactNode;
  /** The ✕ button's name for screen readers. */
  closeLabel?: string;
}

/** Shows an {@link Overlay}: the content, the open dialog over a dimmed background, and the toasts. */
export function OverlayHost({ overlay, children, layers, closeLabel = "Close" }: OverlayHostProps) {
  useStore(overlay);
  const dialog = overlay.dialog;
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Escape closes the open dialog wherever the focus is: the window's key presses are watched.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !overlay.dialogOpen) return;
      e.preventDefault();
      e.stopPropagation();
      overlay.requestClose();
    };
    globalThis.addEventListener("keydown", onKeyDown, true);
    return () => globalThis.removeEventListener("keydown", onKeyDown, true);
  }, [overlay]);

  // Focus the first button of the dialog (else its ✕) so Tab and Enter work at once.
  const dialogId = dialog?.id;
  useEffect(() => {
    if (dialogId === undefined) return;
    const first = panel.current?.querySelector<HTMLElement>("button:not(:disabled)") ?? closeButton.current;
    first?.focus();
  }, [dialogId]);

  return (
    <div className="cs-overlay">
      <div className="cs-overlay-content">{children}</div>
      {layers}
      {dialog && (
        <div className="cs-dialog-layer">
          <div className="cs-dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && dialog.onClose()} />
          <div className="cs-dialog" role="dialog" aria-modal="true" style={{ width: dialog.width }}>
            {/* Every dialog can be closed, whatever its own buttons are. */}
            <button ref={closeButton} type="button" className="flat dialog-close" aria-label={closeLabel} onClick={() => dialog.onClose()}>
              ✕
            </button>
            <div ref={panel} key={dialog.id} className={"cs-dialog-body" + (dialog.scroll ? " scroll" : "")}>
              {dialog.panel}
            </div>
          </div>
        </div>
      )}
      <div className="cs-toasts" aria-live="polite">
        {overlay.toasts.map((t) => (
          <div key={t.id} className="cs-toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
