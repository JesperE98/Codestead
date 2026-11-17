import { SettingsSections } from "../App/SettingsSections.js";
import { UiParts } from "../App/UiParts.js";
import { useStore } from "../Store.js";
import type { LearningWindow } from "./LearningWindow.js";

// The settings dialog and resetting progress (C#'s LearningWindow.Settings.cs).

/** The settings dialog's content: language, theme, variant, the danger zone and the version line. */
export function SettingsPanel({ window: w }: { window: LearningWindow }) {
  useStore(w);
  const tool = w.tool;
  const variants = tool.allVariants ?? [];
  const close = () => w.overlay.closeDialog();
  return (
    <div className="cs-stack" style={{ gap: 10 }}>
      {SettingsSections.title(w.t("settings.title"))}

      {/* Language */}
      {SettingsSections.heading(w.t("settings.language"))}
      {SettingsSections.languages(w.lang, (code) => w.changeLanguage(code))}
      {w.lang !== "sv" && w.lang !== "en" && UiParts.text(w.t("settings.languageNote"), 12.5, undefined, "muted")}

      {/* Theme */}
      {SettingsSections.heading(w.t("settings.theme"))}
      {SettingsSections.theme(w.state.theme, w.t("theme.system"), w.t("theme.light"), w.t("theme.dark"), (v) => w.setTheme(v))}

      {/* Variant (Codestead Linux: the distribution) */}
      {variants.length > 0 && (
        <>
          {UiParts.text(w.t("settings.distro"), 15, 600)}
          <div className="cs-wrap">
            {variants.map((v) => (
              <button key={v.id} type="button" className={"chip" + (v.id === w.state.variant ? " active" : "")} style={{ margin: "0 8px 8px 0" }} onClick={() => w.changeVariant(v.id)}>
                {v.name}
              </button>
            ))}
          </div>
          {UiParts.text(w.t("settings.distroNote"), 12.5, undefined, "muted")}
        </>
      )}

      {/* Danger zone */}
      <div className="cs-danger-zone">
        {UiParts.text(w.t("settings.reset"), 15, 600)}
        {(tool.resets?.() ?? []).map((r, i) => (
          <ResetRow key={i} title={r.title} description={r.description} button={r.button} onClick={r.run} />
        ))}
        <ResetRow title={w.t("reset.progress.title")} description={w.t("reset.progress.desc")} button={w.t("reset.progress.button")} onClick={() => w.confirmResetProgress()} />
      </div>

      {SettingsSections.close(w.t("dialog.close"), close)}
      {tool.changelog.length > 0 ? SettingsSections.version(tool.product, w.t("settings.whatsNew"), () => w.showNews(tool.changelog.slice(0, 5))) : SettingsSections.version(tool.product)}
    </div>
  );
}

function ResetRow({ title, description, button, onClick }: { title: string; description: string; button: string; onClick: () => void }) {
  return (
    <div className="cs-reset-row">
      <div className="cs-stack" style={{ gap: 2, marginInlineEnd: 12 }}>
        {UiParts.text(title, 14, 600)}
        {UiParts.text(description, 12.5, undefined, "muted")}
      </div>
      <button type="button" className="danger-outline" onClick={onClick}>
        {button}
      </button>
    </div>
  );
}
