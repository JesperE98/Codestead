import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Motion } from "../Motion.js";
import type { LevelModel, StreakModel } from "../Models.js";
import { Bar, LevelBadge, Parts } from "./Parts.js";

// The top-bar widget: streak, level and XP bar.

export interface GameBarHandle {
  /** A short "+15 XP" that rises above the widget and fades away. */
  showGain(text: string): void;
}

export interface GameBarProps {
  level: LevelModel;
  streak: StreakModel;
  /** Hides the level title on narrow windows (the badge and the bar stay). */
  compact?: boolean;
  /** Opens the achievements. */
  onClick?: () => void;
  ref?: Ref<GameBarHandle>;
}

/**
 * The top-bar widget: the day streak (🔥), the level badge with its title and a thin XP bar.
 * A click opens the achievements.
 */
export function GameBar({ level, streak, compact = false, onClick, ref }: GameBarProps) {
  const [gains, setGains] = useState<{ id: number; text: string }[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useImperativeHandle(
    ref,
    () => ({
      showGain(text: string) {
        if (!Motion.enabled) return;
        const id = nextId.current++;
        setGains((g) => [...g, { id, text }]);
        timers.current.push(setTimeout(() => setGains((g) => g.filter((x) => x.id !== id)), 1300 + Motion.fadeOutMs));
      },
    }),
    [],
  );

  return (
    <div className="cs-game-bar">
      <button type="button" className="flat cs-game-bar-button" onClick={onClick}>
        <span className="cs-row" style={{ gap: 10 }}>
          {streak.days > 0 && (
            <span className="cs-row" style={{ gap: 3 }} title={streak.tooltip}>
              {Parts.emoji("🔥", 15, { opacity: streak.today ? 1 : 0.45 })}
              {Parts.text(String(streak.days), 13.5, 700, streak.today ? "CsReward" : "CsTextMuted")}
            </span>
          )}
          <span className="cs-game-chip" style={{ paddingInlineEnd: compact ? 6 : 10 }} title={level.tooltip}>
            <LevelBadge level={level.level} size={22} />
            <span className="cs-stack" style={{ gap: 3, width: compact ? 46 : undefined, minWidth: 90 }}>
              {!compact && Parts.text(level.title, 12, 600, "CsText", { textAlign: "start" })}
              <Bar fraction={level.fraction} height={3} />
            </span>
          </span>
        </span>
      </button>
      {gains.map((g) => {
        const motion = Motion.fadeSlideIn(10);
        return (
          <span key={g.id} className={"cs-game-gain " + (motion.className ?? "")} style={motion.style}>
            {g.text}
          </span>
        );
      })}
    </div>
  );
}
