// Git in the terminal: a branch is a label that points at a commit. After the purple commit on the new-design branch
// and git switch main, HEAD -> main points at the commit before it (so the working tree has no purple line); git merge
// moves main forward to the same commit as the branch (a fast-forward). The commit ids are the chapter's examples, the
// branch name the learner's world's. No words, only names: the languages with the English names fall back to en/.
import { C, FS, MONO, PAD, W, arrowPath, box, esc, perLanguage, svg, textWidth, world } from "./style.mjs";
import { cmd } from "./_distro.mjs";

export const variants = perLanguage("git-branches");

const STAGE = 176, GAP = 14;
export const height = PAD + 2 * STAGE + GAP + PAD;
const IDS = ["3f2a9c1", "8d41b7e", "c19e2f4"];
const CX = [PAD + 60, PAD + 270, PAD + 480]; // the commits' circles

/** A branch label (a tag with a mono name) centred at (x, y); `ghost` for where it was. */
function branchTag(x, y, name, color, o = {}) {
  const w = textWidth(name, FS, true) + 22;
  return `<rect x="${x - w / 2}" y="${y - 15}" width="${w}" height="30" rx="6" fill="${o.ghost ? "none" : "#ffffff"}" stroke="${color}" stroke-width="${o.ghost ? 1.5 : 2}"${o.ghost ? ` stroke-dasharray="4 3"` : ""}/>` +
    `<text x="${x}" y="${y}" font-size="${FS}" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}" opacity="${o.ghost ? 0.55 : 1}">${esc(name)}</text>`;
}

export function draw(v) {
  const branch = world(v.lang).names.newDesign;
  let s = "";
  const stage = (i, command, mainAt, ghostAt) => {
    const y = PAD + i * (STAGE + GAP);
    s += box(PAD, y, W - 2 * PAD, STAGE, { fill: "#ffffff" });
    s += cmd(PAD + 14, y + 28, command).svg;
    const laneA = y + 74, laneB = y + 108, cy = y + 146;
    // The commits, joined in order; the purple one is the branch's.
    const idW = textWidth("3f2a9c1", FS, true);
    for (let k = 0; k < 2; k++) s += `<line x1="${CX[k] + 18 + idW + 8}" y1="${cy}" x2="${CX[k + 1] - 14}" y2="${cy}" stroke="${C.line}" stroke-width="2.5"/>`;
    IDS.forEach((id, k) => {
      const purple = k === 2;
      s += `<circle cx="${CX[k]}" cy="${cy}" r="11" fill="${purple ? "#efe3f6" : "#ffffff"}" stroke="${purple ? "#8e44ad" : C.muted}" stroke-width="3"/>`;
      s += `<text x="${CX[k] + 18}" y="${cy + 1}" font-size="${FS}" font-weight="650" fill="${C.ink}" dominant-baseline="central" font-family="${MONO}">${esc(id)}</text>`;
    });
    // The labels: new-design at the purple commit, HEAD -> main where main is.
    const branchX = CX[2] + 20, mainLabel = "HEAD -> main";
    s += branchTag(branchX, laneB, branch, C.accent2) + `<line x1="${branchX - 20}" y1="${laneB + 15}" x2="${CX[2]}" y2="${cy - 12}" stroke="${C.accent2}" stroke-width="1.5"/>`;
    const mx = CX[mainAt] + 20;
    const my = mainAt === 2 ? laneA : laneB;
    s += branchTag(mx, my, mainLabel, C.accent) + `<line x1="${mx - 20}" y1="${my + 15}" x2="${CX[mainAt]}" y2="${mainAt === 2 ? laneB - 15 : cy - 12}" stroke="${C.accent}" stroke-width="1.5"/>`;
    if (ghostAt !== undefined) {
      // Where main was, and the move: a fast-forward.
      const gx = CX[ghostAt] + 20;
      s += branchTag(gx, laneB, "main", C.accent, { ghost: true });
      const gw = textWidth("main", FS, true) + 22;
      const from = gx + gw / 2 + 4, to = mx - (textWidth(mainLabel, FS, true) + 22) / 2 - 4;
      s += arrowPath(`M${from},${laneB} C${from + 60},${laneB} ${to - 60},${laneA} ${to},${laneA}`, to, laneA, 1, 0, { color: C.accent, width: 2, dash: "5 4" });
      s += `<text x="${CX[ghostAt] + 10}" y="${laneA - 6}" font-size="${FS}" font-weight="600" fill="${C.accent}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}">Fast-forward</text>`;
    }
  };
  stage(0, "git switch main", 1);
  stage(1, `git merge ${branch}`, 2, 1);
  return svg(height, s);
}
