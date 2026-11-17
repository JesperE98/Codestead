// The React part of Codestead.Linux/LinuxTool.Terminal.cs: the terminal with its title bar (three dots,
// user@host — distribution, "Reset"). The terminal's behaviour (load, save, reset, switching distribution) is in
// LinuxTool.tsx.

import { Store, useStore } from "@codestead/ui";
import type { LinuxTool } from "./LinuxTool.js";
import { Terminal } from "./Terminal/TerminalView.js";

/** What the title bar shows (C#'s terminalTitle text block and terminalReset button). */
export class TerminalFrameState extends Store {
  title = "";
  resetLabel = "";
  resetTooltip = "";

  setTitle(title: string): void {
    if (title === this.title) return;
    this.title = title;
    this.changed();
  }

  setReset(label: string, tooltip: string): void {
    this.resetLabel = label;
    this.resetTooltip = tooltip;
    this.changed();
  }
}

/** The terminal with its title bar. */
export function TerminalFrame({ tool }: { tool: LinuxTool }) {
  const frame = tool.frame;
  useStore(frame);
  return (
    <div className="cs-terminal-frame" dir="ltr" style={{ borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ background: "#1b2129", padding: "0 12px", height: 34, flex: "0 0 auto", display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 11, height: 11, borderRadius: 6, background: "#3d444d", display: "inline-block" }} />
          ))}
        </div>
        <span className="cs-terminal-title" style={{ color: "#9aa3b0", fontSize: 12.5, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {frame.title}
        </span>
        <button type="button" className="flat" style={{ color: "#c9d1d9", fontSize: 12.5, padding: "2px 8px" }} title={frame.resetTooltip} onClick={() => tool.confirmResetTerminal()}>
          {frame.resetLabel}
        </button>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <Terminal view={tool.terminal} />
      </div>
    </div>
  );
}
