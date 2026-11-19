import type { ChangelogEntry } from "../ChangelogEntry.js";
import type { Overlay } from "../Controls/Dialogs.js";
import { WhatsNewView } from "../Controls/WhatsNewView.js";
import type { WhatsNewTexts } from "../Controls/WhatsNewTexts.js";

/** The "What's new" dialog of every app (newest version first; only the list scrolls). */
export const NewsDialog = {
  show(overlay: Overlay, texts: WhatsNewTexts, entries: Iterable<ChangelogEntry>, lang: string, afterClose?: () => void): void {
    const close = () => {
      overlay.closeDialog();
      afterClose?.();
    };
    overlay.showDialog(<WhatsNewView texts={texts} entries={[...entries]} lang={lang} onClose={close} />, close, 560, false);
  },
};
