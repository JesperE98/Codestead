import { Motion } from "../Motion.js";
import type { CelebrationModel } from "../Models.js";
import { Bar, LevelBadge, Medal, Parts } from "./Parts.js";

export interface CelebrationViewProps {
  model: CelebrationModel;
  onClose: () => void;
  onNext?: (() => void) | null;
}

/** The dialog shown when a chapter, a whole part or an exam is done. Show it with `overlay.showDialog(..., 540, false)`. */
export function CelebrationView({ model: m, onClose, onNext }: CelebrationViewProps) {
  const withNext = onNext != null && m.nextText !== null;
  return (
    <div className="cs-dock">
      <div className="cs-dock-fill cs-stack" style={{ gap: 14 }}>
        {/* The medal and the heading. */}
        <Medal icon={m.icon} size={m.big ? 92 : 72} unlocked gold={m.big} style={{ alignSelf: "center" }} motion={Motion.pop(80)} />
        {Parts.text(m.title, m.big ? 26 : 22, 700, "CsText", { textAlign: "center" })}
        {m.subtitle !== null && Parts.text(m.subtitle, 14, undefined, "CsTextMuted", { textAlign: "center", marginTop: -8 })}

        {/* XP and level. */}
        <div className="cs-stack" style={{ gap: 6, borderRadius: 10, padding: "10px 14px", background: "var(--cs-reward-soft)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gridTemplateRows: "auto auto", alignItems: "center" }}>
            <LevelBadge level={m.level.level} size={30} style={{ gridRow: "1 / span 2" }} />
            {Parts.text(m.level.title, 14, 600, "CsText", { margin: "0 10px" })}
            {Parts.text(m.xpText, 15, 700, "CsReward")}
            <Bar
              fraction={m.level.fraction}
              from={m.levelBefore.level === m.level.level ? m.levelBefore.fraction : 0}
              delayMs={250}
              height={6}
              style={{ gridColumn: "2 / span 2", gridRow: 2, marginTop: 6, marginInlineStart: 10 }}
            />
          </div>
          {m.levelUpText !== null && Parts.text("⬆ " + m.levelUpText, 13.5, 700, "CsReward")}
        </div>

        {/* The commands practised. */}
        {m.commands.length > 0 && m.commandsHeading !== null && (
          <>
            {Parts.text(m.commandsHeading, 13, 600, "CsTextMuted")}
            <div className="cs-wrap" dir="ltr" style={{ marginTop: -8 }}>
              {m.commands.map((c, i) => (
                <span key={i} className="cs-command-chip">
                  {c}
                </span>
              ))}
            </div>
          </>
        )}
        {m.timeText !== null && Parts.text("⏱ " + m.timeText, 13, undefined, "CsTextMuted")}

        {/* New achievements. */}
        {m.achievements.length > 0 && m.achievementsHeading !== null && (
          <>
            {Parts.text(m.achievementsHeading, 13, 600, "CsTextMuted")}
            {m.achievements.map((a, i) => {
              const motion = Motion.fadeSlideIn(10, 400 + 90 * i);
              return (
                <div key={i} className={"cs-row " + (motion.className ?? "")} style={{ gap: 10, marginTop: -6, ...motion.style }}>
                  <Medal icon={a.icon} size={34} />
                  <div className="cs-stack">
                    {Parts.text(a.title, 14, 600, "CsText")}
                    {Parts.text(a.description, 12.5, undefined, "CsTextMuted")}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Buttons stay in view; the rest scrolls if needed. */}
      <div className="cs-row cs-dock-end" style={{ gap: 8, marginTop: 16 }}>
        <button type="button" className={withNext ? "secondary" : "primary"} onClick={onClose}>
          {m.closeText}
        </button>
        {withNext && (
          <button type="button" className="primary" onClick={() => onNext()}>
            {m.nextText}
          </button>
        )}
      </div>
    </div>
  );
}
