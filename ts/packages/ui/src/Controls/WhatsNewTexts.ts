// The texts of the "What's new" dialog.

/** Texts of the "What's new" dialog, in the app's language. */
export interface WhatsNewTexts {
  /** The heading, e.g. "What's new in Codestead Linux". */
  title: string;
  /** The heading of each version, with {version} and {date}, e.g. "Version {version} · {date}". */
  version: string;
  /** The button that closes the dialog. */
  close: string;
}
