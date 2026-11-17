import type { AchievementCard, AchievementSection, GalleryTexts, LevelModel } from "../Models.js";
import { Bar, LevelBadge, Medal, Parts } from "./Parts.js";

// The gallery of all achievements.

export interface AchievementGalleryViewProps {
  texts: GalleryTexts;
  level: LevelModel;
  sections: readonly AchievementSection[];
  onClose: () => void;
}

/**
 * All achievements: unlocked ones with their date, locked ones dimmed with progress, hidden ones as "???".
 * Show it with `overlay.showDialog(..., 780, false)`.
 */
export function AchievementGalleryView({ texts, level, sections, onClose }: AchievementGalleryViewProps) {
  return (
    <div className="cs-dock">
      {/* Header: level, XP bar, counts. */}
      <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", marginBottom: 12 }}>
        <LevelBadge level={level.level} size={52} />
        <div className="cs-stack" style={{ gap: 4, marginInlineStart: 14, alignSelf: "center" }}>
          {Parts.text(texts.title, 21, 700, "CsText")}
          {Parts.text(`${level.title} · ${level.tooltip}`, 13, 600, "CsReward")}
          <Bar fraction={level.fraction} height={6} />
          {Parts.text(`${texts.countText}   ·   ${texts.streakText}`, 12.5, undefined, "CsTextMuted", { whiteSpace: "pre-wrap" })}
        </div>
      </div>
      <div className="cs-dock-fill cs-stack" style={{ gap: 8, paddingInlineEnd: 10 }}>
        {sections.map((section, i) => (
          <div key={i} className="cs-stack" style={{ gap: 8 }}>
            {Parts.text(section.title, 15, 700, "CsText", { marginTop: 8 })}
            <div className="cs-wrap">
              {section.cards.map((card, j) => (
                <Tile key={j} c={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="primary cs-dock-end" style={{ marginTop: 12 }} onClick={onClose}>
        {texts.close}
      </button>
    </div>
  );
}

function Tile({ c }: { c: AchievementCard }) {
  return (
    <div className={"cs-tile" + (c.unlocked ? " unlocked" : "")}>
      <Medal icon={c.unlocked || !c.hidden ? c.icon : "❔"} size={40} unlocked={c.unlocked} style={{ alignSelf: "start" }} />
      <div className="cs-stack" style={{ gap: 2, marginInlineStart: 10 }}>
        {Parts.text(c.title, 13.5, 600, c.unlocked ? "CsText" : "CsTextMuted")}
        {Parts.text(c.description, 12, undefined, "CsTextMuted")}
        {c.unlocked && c.unlockedText !== null ? (
          Parts.text("✓ " + c.unlockedText, 11.5, 600, "CsSuccess")
        ) : !c.unlocked && c.target > 0 ? (
          <>
            <Bar fraction={Math.min(1, Math.max(0, c.current / c.target))} height={4} color="CsAccent" style={{ marginTop: 4 }} />
            {c.progressText !== null && Parts.text(c.progressText, 11, undefined, "CsTextMuted")}
          </>
        ) : null}
      </div>
    </div>
  );
}
