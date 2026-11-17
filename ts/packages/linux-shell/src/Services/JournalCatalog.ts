// Port of Services/JournalCatalog.cs – systemd model: the explanation shown with `journalctl -x`.

/** Explanation shown with `journalctl -x` (the `x` field of a journal entry). */
export interface JournalCatalog {
  subject: string;
  body: string[];
}
