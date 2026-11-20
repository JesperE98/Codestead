import { SettingsSections, UiParts, useStore } from "@codestead/ui";
import { useEffect, useState } from "react";
import { HubInfo } from "./HubInfo.js";
import type { MainWindow } from "./MainWindow.js";

// MainWindow.Settings.cs: the theme and the settings dialog.

export function openSettings(w: MainWindow): void {
  w.overlay.showDialog(<SettingsPanel w={w} />, () => w.overlay.closeDialog(), 600);
}

/** The settings dialog. It follows the window's state, so a change shows at once (C# opens the dialog again). */
function SettingsPanel({ w }: { w: MainWindow }) {
  useStore(w);
  const state = w.state;
  const [startsWithComputer, setStartsWithComputer] = useState<boolean | null>(null);
  useEffect(() => {
    if (w.info.autostartSupported) void w.api.startsWithComputer().then(setStartsWithComputer);
  }, [w]);

  /** A change is saved at once. */
  const set = (change: () => void) => {
    change();
    w.saveState();
    w.render();
  };

  return (
    <div className="cs-stack" style={{ gap: 10 }}>
      {SettingsSections.title(w.t("settings.title"))}
      {SettingsSections.heading(w.t("settings.language"))}
      {SettingsSections.languages(w.lang, (code) => set(() => (state.lang = code)), 110)}

      {SettingsSections.heading(w.t("settings.theme"))}
      {SettingsSections.theme(state.theme, w.t("theme.system"), w.t("theme.light"), w.t("theme.dark"), (v) =>
        set(() => {
          state.theme = v;
          w.applyTheme();
        }),
      )}

      {/* General: the tray, starting at login, updates */}
      {SettingsSections.heading(w.t("settings.general"))}
      <Toggle label={w.t("settings.hideOnToolOpen")} value={state.hideOnToolOpen} onChange={(v) => set(() => (state.hideOnToolOpen = v))} />
      <Toggle
        label={w.t("settings.closeToTray")}
        value={state.closeToTray}
        onChange={(v) =>
          set(() => {
            state.closeToTray = v;
            w.api.setCloseToTray(v);
          })
        }
      />
      {!w.info.traySupported && UiParts.text(w.t("settings.noTray"), 12.5, undefined, "muted")}
      {w.info.autostartSupported && (
        <Toggle
          label={w.t("settings.startWithComputer")}
          value={startsWithComputer ?? false}
          onChange={(v) => {
            setStartsWithComputer(v);
            void w.api.setStartsWithComputer(v).then(() => w.api.startsWithComputer().then(setStartsWithComputer));
          }}
        />
      )}
      <Toggle label={w.t("settings.autoCheck")} value={state.autoCheckUpdates} onChange={(v) => set(() => (state.autoCheckUpdates = v))} />
      <Toggle
        label={w.t("settings.autoInstall")}
        value={state.autoInstallUpdates}
        onChange={(v) => {
          set(() => (state.autoInstallUpdates = v));
          if (v) void w.installUpdatesByItself();
        }}
      />

      {(w.sandbox === "off" || w.sandbox === "on") && (
        <>
          {SettingsSections.heading(w.t("settings.sandbox"))}
          {UiParts.text(w.t(w.sandbox === "on" ? "settings.sandboxOn" : "settings.sandboxOff"), 13)}
          {w.sandbox === "off" && (
            <button type="button" className="secondary" style={{ alignSelf: "flex-start" }} disabled={w.sandboxBusy} onClick={() => void w.enableSandbox()}>
              {w.sandboxBusy ? w.t("sandbox.working") : w.t("settings.sandboxEnable")}
            </button>
          )}
          {w.sandboxError !== null && <div className="cs-text hub-error">{w.t("sandbox.failed", { error: w.sandboxError })}</div>}
        </>
      )}

      {SettingsSections.heading(w.t("settings.folder"))}
      <div className="hub-folder" dir="ltr">
        {w.info.dataRoot}
      </div>

      {SettingsSections.close(w.t("dialog.close"), () => w.overlay.closeDialog())}
      {SettingsSections.version(HubInfo.meta)}
    </div>
  );
}

/** A setting that is on or off: its text and a switch (Avalonia's ToggleSwitch). */
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="hub-toggle">
      <span className="cs-text">{label}</span>
      <input type="checkbox" role="switch" aria-label={label} checked={value} onChange={(e) => onChange(e.currentTarget.checked)} />
    </label>
  );
}
