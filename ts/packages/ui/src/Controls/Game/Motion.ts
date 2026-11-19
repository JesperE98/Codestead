import type { CSSProperties } from "react";

/** Props that animate an element: a class and the CSS variables it reads. */
export interface MotionProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Short, calm animations (180–350 ms), as CSS animations in codestead.css. Things only move up and down, never
 * sideways, so right-to-left languages need nothing special. {@link Motion.enabled} = false shows the end state at
 * once (tests, screenshots); the system's "reduce motion" does the same.
 */
export const Motion = {
  enabled: true,

  /** Fades in while sliding `dy` pixels into place. */
  fadeSlideIn(dy = 12, delayMs = 0, durationMs = 260): MotionProps {
    if (!Motion.enabled) return {};
    return { className: "cs-motion-fade-slide-in", style: { "--dy": `${dy}px`, "--delay": `${delayMs}ms`, "--duration": `${durationMs}ms` } as CSSProperties };
  },

  /** Grows from small to full size with a slight overshoot – for a check mark or a medal. */
  pop(delayMs = 0): MotionProps {
    if (!Motion.enabled) return {};
    return { className: "cs-motion-pop", style: { "--delay": `${delayMs}ms` } as CSSProperties };
  },

  /** How long {@link fadeOut} takes (ms); 0 when motion is off. */
  get fadeOutMs(): number {
    return Motion.enabled ? 220 : 0;
  },
};

/** Joins class names, leaving out empty ones. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
