import { brush, LevelBadge, Medal, Parts } from "./Parts.js";

// The notice for a new achievement or level.

export interface AchievementToastProps {
  eyebrow: string;
  /** The emoji, or the level number for a new level. */
  icon: string;
  title: string;
  description: string;
  /** A new level: the level badge instead of a medal. */
  level?: boolean;
}

/** The notice for a new achievement (or a new level): medal, eyebrow, title and description. */
export function AchievementToast({ eyebrow, icon, title, description, level = false }: AchievementToastProps) {
  const n = Number.parseInt(icon, 10);
  const medalStyle = { margin: "12px 10px 12px 12px", alignSelf: "center" } as const;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto auto minmax(0, 1fr)" }}>
      <div style={{ width: 4, borderRadius: "10px 0 0 10px", background: brush("CsRewardStrong") }} />
      {level ? <LevelBadge level={Number.isNaN(n) ? 1 : n} size={44} style={medalStyle} /> : <Medal icon={icon} size={44} style={medalStyle} />}
      <div className="cs-stack" style={{ gap: 2, margin: "10px 14px 10px 0", alignSelf: "center" }}>
        {Parts.text(eyebrow.toUpperCase(), 10.5, 700, "CsReward", { letterSpacing: 0.7 })}
        {Parts.text(title, 15, 700, "CsText")}
        {Parts.text(description, 12.5, undefined, "CsTextMuted")}
      </div>
    </div>
  );
}

/** A one-line notice (e.g. "+2 more achievements", "5 days in a row"); C#'s AchievementToast.Simple. */
export function SimpleNotice({ text }: { text: string }) {
  return <div style={{ padding: "9px 14px" }}>{Parts.text(text, 13, 600, "CsText")}</div>;
}
