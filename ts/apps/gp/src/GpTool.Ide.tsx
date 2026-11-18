// The React part of GpTool.Ide.cs: the IDE picker in the top bar, next to the API (the choice itself – ide.json – is
// in GpTool.tsx).

import { Ides } from "@codestead/gp-course";
import type { GpTool } from "./GpTool.js";

/** The IDE picker: the chapters' ":::ide" blocks follow it. */
export function IdePicker({ tool }: { tool: GpTool }) {
  const w = tool.window;
  if (w === undefined) return null;
  return (
    <select className="cs-gp-ide" style={{ minWidth: 150 }} title={w.t("ide.label")} aria-label={w.t("ide.label")} value={tool.ide} onChange={(e) => tool.chooseIde(e.target.value)}>
      <optgroup label={w.t("ide.group")}>
        {Ides.all.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
