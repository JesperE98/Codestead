import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { cx, Motion, type MotionProps } from "../Motion.js";

// Small building blocks shared by the gamification views.

/** A theme colour by its C# name: "CsTextMuted" → var(--cs-text-muted). */
export function brush(resource: string): string {
  return `var(--${resource.replace(/^Cs/, "cs").replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase()})`;
}

export const Parts = {
  emoji(icon: string, size: number, style?: CSSProperties): ReactNode {
    return (
      <span className="cs-emoji" style={{ fontSize: size, ...style }}>
        {icon}
      </span>
    );
  },

  text(text: ReactNode, size: number, weight?: number, color?: string, style?: CSSProperties, motion?: MotionProps): ReactNode {
    return (
      <div className={cx("cs-text", motion?.className)} style={{ fontSize: size, fontWeight: weight, color: color ? brush(color) : undefined, ...style, ...motion?.style }}>
        {text}
      </div>
    );
  },
};

/** An icon (emoji) on a round, tinted medal. */
export function Medal({ icon, size, unlocked = true, gold = true, motion, style }: { icon: string; size: number; unlocked?: boolean; gold?: boolean; motion?: MotionProps; style?: CSSProperties }) {
  return (
    <div
      className={cx("cs-medal", unlocked ? (gold ? null : "success") : "locked", motion?.className)}
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 18), ...style, ...motion?.style }}
    >
      {Parts.emoji(icon, size * 0.46)}
    </div>
  );
}

/**
 * A thin progress bar (0–1). With `from`, it moves from there to `fraction` after `delayMs` (C#'s Motion.AnimateValue).
 */
export function Bar({ fraction, height, color = "CsReward", from, delayMs = 150, style }: { fraction: number; height: number; color?: string; from?: number; delayMs?: number; style?: CSSProperties }) {
  const animate = from !== undefined && Motion.enabled;
  const [value, setValue] = useState(animate ? from : fraction);
  useEffect(() => {
    if (!animate) {
      setValue(fraction);
      return;
    }
    const timer = setTimeout(() => setValue(fraction), delayMs);
    return () => clearTimeout(timer);
  }, [animate, fraction, delayMs]);
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div className="cs-bar" role="progressbar" aria-valuemin={0} aria-valuemax={1} aria-valuenow={fraction} style={{ height, minHeight: height, ...style }}>
      <span style={{ width: `${clamped * 100}%`, ["--fill" as string]: brush(color) }} />
    </div>
  );
}

/** The round level badge with the level number. */
export function LevelBadge({ level, size, style }: { level: number; size: number; style?: CSSProperties }) {
  return (
    <div className="cs-level-badge" style={{ width: size, height: size, fontSize: size * 0.5, ...style }}>
      {level}
    </div>
  );
}
