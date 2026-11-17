import type { ReactNode } from "react";
import { Store, useStore } from "../../../Store.js";
import { cx, Motion } from "../Motion.js";
import { SimpleNotice } from "./AchievementToast.js";

interface Notice {
  id: number;
  content: ReactNode;
  onClick?: () => void;
  leaving: boolean;
}

/** Notices that slide in at the top corner (achievements, level up). At most three at once. */
export class Notices extends Store {
  static readonly MaxVisible = 3;
  private nextId = 1;
  private hidden = 0;
  private readonly list: Notice[] = [];

  /** Called with the number of notices that did not fit ("+N more"). */
  moreText: ((hidden: number) => string) | null = null;
  moreClicked: (() => void) | null = null;

  /** The notices on screen, then the "+N more" notice if there is one. */
  get items(): readonly Readonly<Notice>[] {
    return this.list;
  }

  /** The "+N more" text, or null. */
  get more(): string | null {
    return this.hidden > 0 && this.moreText ? this.moreText(this.hidden) : null;
  }

  show(notice: ReactNode, seconds = 5, onClick?: () => void): void {
    if (this.list.length >= Notices.MaxVisible) {
      this.hidden++;
      this.changed();
      return;
    }
    const item: Notice = { id: this.nextId++, content: notice, onClick, leaving: false };
    this.list.push(item);
    this.changed();
    setTimeout(() => {
      item.leaving = true;
      this.changed();
      setTimeout(() => {
        const i = this.list.indexOf(item);
        if (i >= 0) this.list.splice(i, 1);
        if (this.list.length === 0) this.hidden = 0;
        this.changed();
      }, Motion.fadeOutMs);
    }, seconds * 1000);
  }
}

/** Shows {@link Notices} at the top corner of the window. */
export function NoticeLayer({ notices }: { notices: Notices }) {
  useStore(notices);
  const more = notices.more;
  const fade = Motion.fadeSlideIn(-14);
  return (
    <div className="cs-notices" aria-live="polite">
      {notices.items.map((n) => (
        <div
          key={n.id}
          className={cx("cs-notice", n.onClick && "clickable", n.leaving && "leaving", !n.leaving && fade.className)}
          style={n.leaving ? undefined : fade.style}
          onClick={n.onClick}
        >
          {n.content}
        </div>
      ))}
      {more !== null && (
        <div className={cx("cs-notice", notices.moreClicked && "clickable")} onClick={notices.moreClicked ?? undefined}>
          <SimpleNotice text={more} />
        </div>
      )}
    </div>
  );
}
