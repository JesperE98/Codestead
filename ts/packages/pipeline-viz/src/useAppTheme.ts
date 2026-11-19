import { useEffect, useState } from "react";
import type { VizTheme } from "./EngineApi.js";

/**
 * The theme the window shows: the root element's data-theme ("light"/"dark", Codestead's ThemeSwitcher), else the
 * system's. Follows changes of both.
 */
export function currentTheme(doc: Document | undefined = globalThis.document): VizTheme {
  const chosen = doc?.documentElement.dataset["theme"];
  if (chosen === "light" || chosen === "dark") return chosen;
  try {
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useAppTheme(): VizTheme {
  const [theme, setTheme] = useState<VizTheme>(() => currentTheme());
  useEffect(() => {
    const update = () => setTheme(currentTheme());
    const mo = typeof MutationObserver === "function" ? new MutationObserver(update) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);
    return () => {
      mo?.disconnect();
      media?.removeEventListener?.("change", update);
    };
  }, []);
  return theme;
}
