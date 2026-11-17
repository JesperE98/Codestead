import type { ProfileModel } from "../Models.js";
import { Bar, LevelBadge, Parts } from "./Parts.js";

// A tool's progress in one row (the hub's tool cards).

/** A tool's progress in one row (the hub's tool cards): level, XP bar, streak and achievements. */
export function ProfileRow({ model: m, onOpen }: { model: ProfileModel; onOpen: () => void }) {
  return (
    <div style={{ borderRadius: 10, padding: "8px 12px", marginTop: 6, background: "var(--cs-reward-soft)", display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto auto auto", alignItems: "center" }}>
      <LevelBadge level={m.level.level} size={30} />
      <div className="cs-stack" style={{ gap: 3, margin: "0 16px 0 10px" }}>
        {Parts.text(`${m.level.title} · ${m.level.tooltip}`, 13, 600, "CsText")}
        <Bar fraction={m.level.fraction} height={4} />
      </div>
      {m.streak.days > 0 ? (
        <span title={m.streak.tooltip} style={{ marginInlineEnd: 14 }}>
          {Parts.text(`🔥 ${m.streak.days}`, 13.5, 700, m.streak.today ? "CsReward" : "CsTextMuted")}
        </span>
      ) : (
        <span />
      )}
      <span style={{ marginInlineEnd: 12 }}>{Parts.text(`🏆 ${m.achievementsText}`, 13.5, 700, "CsText")}</span>
      <button type="button" className="secondary" onClick={onOpen}>
        {m.openText}
      </button>
    </div>
  );
}
