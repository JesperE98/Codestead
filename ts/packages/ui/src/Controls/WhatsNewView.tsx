import type { ChangelogEntry } from "../ChangelogEntry.js";
import { MarkdownView } from "./MarkdownView.js";
import type { WhatsNewTexts } from "./WhatsNewTexts.js";

export interface WhatsNewViewProps {
  texts: WhatsNewTexts;
  entries: Iterable<ChangelogEntry>;
  lang: string;
  onClose: () => void;
}

/**
 * The content of the "What's new" dialog: one section per version, newest first, each a bullet list. The list of
 * versions scrolls, while the heading and the close button stay in view; show it with
 * `overlay.showDialog(..., 560, false)` (see NewsDialog).
 */
export function WhatsNewView({ texts, entries, lang, onClose }: WhatsNewViewProps) {
  return (
    <div className="cs-dock">
      <div className="cs-text" style={{ fontSize: 21, fontWeight: 700, marginBottom: 4 }}>
        {texts.title}
      </div>
      <div className="cs-dock-fill cs-stack" style={{ gap: 10, paddingInlineEnd: 8 }}>
        {[...entries].map((entry) => (
          <div key={entry.version} className="cs-stack" style={{ gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, color: "var(--cs-accent)" }}>
              {texts.version.replaceAll("{version}", entry.version).replaceAll("{date}", entry.date)}
            </div>
            <MarkdownView
              baseFontSize={14}
              markdown={entry
                .changesFor(lang)
                .map((c) => "- " + c)
                .join("\n")}
            />
          </div>
        ))}
      </div>
      <button type="button" className="primary cs-dock-end" style={{ marginTop: 12 }} onClick={onClose}>
        {texts.close}
      </button>
    </div>
  );
}
