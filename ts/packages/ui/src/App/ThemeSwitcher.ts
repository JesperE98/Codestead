/** The theme setting of every app: null follows the system, "light" or "dark" (data-theme on the root element). */
export const ThemeSwitcher = {
  apply(theme: string | null, doc: Document | undefined = globalThis.document): void {
    if (!doc) return;
    const root = doc.documentElement;
    if (theme === "light" || theme === "dark") root.dataset.theme = theme;
    else delete root.dataset.theme;
  },
};
