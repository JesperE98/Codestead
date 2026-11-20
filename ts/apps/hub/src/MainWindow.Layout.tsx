import { FontWeight, Icons, OverlayHost, ProfileRow, UiParts, useStore } from "@codestead/ui";
import type { ReactNode } from "react";
import iconUrl from "../../../../src/Hub/Codestead.Hub/Assets/icon.png?url";
import type { CatalogTool } from "./core/CatalogTool.js";
import type { InstalledTool } from "./core/InstalledTool.js";
import { SemVer } from "./core/SemVer.js";
import { HubInfo } from "./HubInfo.js";
import { MainWindow } from "./MainWindow.js";
import { openAchievements, profileModelFor, profilesShown, TotalRow } from "./MainWindow.Profiles.js";

// MainWindow.Layout.cs: the layout and rendering of the page – the update banner and the tool cards.

// The tools' own icons (Assets/tools/<id>.png, from build/icons/<id>.svg).
const toolIcons = import.meta.glob<string>("../../../../src/Hub/Codestead.Hub/Assets/tools/*.png", { query: "?url", import: "default", eager: true });

function toolIcon(id: string): string | null {
  return Object.entries(toolIcons).find(([path]) => path.endsWith(`/${id}.png`))?.[1] ?? null;
}

/** The whole window: the bar with the logo and the settings button, and the page under it. */
export function MainWindowView({ w }: { w: MainWindow }) {
  useStore(w);
  return (
    <div className="cs-root hub" dir={w.dir} lang={w.lang}>
      <OverlayHost overlay={w.overlay} closeLabel={w.t("dialog.close")}>
        <div className="hub-dock">
          <div className="hub-top">
            {/* The Codestead logo (build/icons/codestead-hub.svg): a house with a prompt inside. */}
            <div className="hub-brand">
              <img src={iconUrl} width={34} height={34} alt="" />
              <span className="hub-brand-name">{HubInfo.name}</span>
            </div>
            <button type="button" className="flat hub-settings" title={w.t("settings.title")} aria-label={w.t("settings.title")} onClick={() => w.openSettings()}>
              {Icons.gear(19)}
            </button>
          </div>
          <div className="hub-scroll">
            <Page w={w} />
          </div>
        </div>
      </OverlayHost>
    </div>
  );
}

function Action({ label, cls, onClick, enabled = true }: { label: string; cls: string; onClick: () => void; enabled?: boolean }) {
  return (
    <button type="button" className={cls} disabled={!enabled} onClick={onClick}>
      {label}
    </button>
  );
}

function Page({ w }: { w: MainWindow }) {
  const profiles = profilesShown(w);
  // Tools from the catalog (the hub itself is not listed), plus installed tools no longer in the catalog.
  const shown = new Set<string>();
  const cards: ReactNode[] = [];
  for (const tool of w.catalog?.tools.filter((t) => t.id !== HubInfo.id) ?? []) {
    shown.add(tool.id);
    cards.push(<ToolCard key={tool.id} w={w} id={tool.id} name={tool.name} tool={tool} installed={w.installed(tool.id)} />);
  }
  for (const installed of w.installedTools.filter((t) => !shown.has(t.id))) cards.push(<ToolCard key={installed.id} w={w} id={installed.id} name={installed.id} tool={null} installed={installed} />);

  let footer = `${HubInfo.name} ${HubInfo.version}`;
  if (w.checkedAt !== null) footer += " · " + w.t("catalog.checked", { time: w.checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });

  return (
    <div className="hub-page">
      {UiParts.text(w.t("hub.tagline"), 15, undefined, "muted")}
      {w.hubUpdate !== null && <HubUpdateBanner w={w} version={w.hubUpdate} />}
      {w.offersSandbox && <SandboxBanner w={w} />}

      <div className="hub-header">
        {UiParts.text(w.t("tools.title"), 22, FontWeight.Bold)}
        <Action label={w.loading ? w.t("catalog.loading") : "↻  " + w.t("catalog.check")} cls="secondary" onClick={() => void w.refresh()} enabled={!w.loading} />
      </div>

      {profiles.length > 0 && <TotalRow w={w} profiles={profiles} />}

      {w.catalogProblem !== null && <div className="hub-problem">{UiParts.text(w.catalogProblem, 13.5)}</div>}

      {cards}
      {w.catalog === null && w.installedTools.length === 0 && w.loading && UiParts.text(w.t("catalog.loading"), 14, undefined, "muted")}

      <div className="cs-stack hub-planned">
        {UiParts.text(w.t("planned.title"), 16, FontWeight.SemiBold)}
        {UiParts.text(w.t("planned.text", { names: w.t("planned.names") }), 14, undefined, "muted")}
      </div>

      {UiParts.text(footer, 12, undefined, "muted")}
    </div>
  );
}

function HubUpdateBanner({ w, version }: { w: MainWindow; version: string }) {
  const install = async () => {
    w.hubUpdateProgress = 0;
    w.hubUpdateFailed = null;
    w.render();
    try {
      await w.selfUpdate.downloadAndRestart((pct) => {
        w.hubUpdateProgress = pct;
        w.render();
      });
    } catch (e) {
      // Not installed (the password dialog closed, no polkit agent, the package manager failed, …): the download page.
      w.hubUpdateProgress = null;
      w.hubUpdateFailed = e instanceof Error ? e.message : String(e);
      w.render();
    }
  };
  const download = <Action label={w.t("self.download")} cls="primary" onClick={() => w.openUrl(`https://github.com/${HubInfo.releasesRepo}/releases/tag/${HubInfo.id}-latest`)} />;
  return (
    <div className="hub-banner cs-stack">
      {UiParts.text(w.t("self.available", { name: HubInfo.name, version }), 14.5, FontWeight.SemiBold)}
      {w.hubUpdateProgress !== null ? (
        UiParts.text(w.hubUpdateProgress < 0 ? w.t("self.installing") : w.t("self.downloading", { percent: w.hubUpdateProgress }), 13)
      ) : w.hubUpdateFailed !== null ? (
        <>
          {UiParts.text(w.t("self.failed", { error: w.hubUpdateFailed }), 13)}
          {download}
        </>
      ) : w.selfUpdate.canUpdateItself ? (
        <>
          <Action label={w.t("self.install")} cls="primary" onClick={() => void install()} />
          {w.selfUpdate.asksForPassword === true && UiParts.text(w.t("self.password"), 12.5, undefined, "muted")}
        </>
      ) : (
        download
      )}
    </div>
  );
}

/** The offer to turn on Chromium's sandbox for the tools (Linux, where AppArmor restricts user namespaces). */
function SandboxBanner({ w }: { w: MainWindow }) {
  return (
    <div className="hub-banner cs-stack" data-banner="sandbox">
      {UiParts.text(w.t("sandbox.title"), 14.5, FontWeight.SemiBold)}
      {UiParts.text(w.t("sandbox.text"), 13)}
      {w.sandboxBusy ? (
        UiParts.text(w.t("sandbox.working"), 13)
      ) : (
        <div className="hub-actions">
          <Action label={w.t("sandbox.enable")} cls="primary" onClick={() => void w.enableSandbox()} />
          <Action label={w.t("sandbox.later")} cls="flat" onClick={() => w.dismissSandboxOffer()} />
        </div>
      )}
      {w.sandboxError !== null && <div className="cs-text hub-error">{w.t("sandbox.failed", { error: w.sandboxError })}</div>}
    </div>
  );
}

function ToolCard({ w, id, name, tool, installed }: { w: MainWindow; id: string; name: string; tool: CatalogTool | null; installed: InstalledTool | null }) {
  const rid = w.info.rid;
  const asset = rid === null ? null : (tool?.assetFor(rid) ?? null);
  const updateAvailable = installed !== null && tool !== null && asset !== null && SemVer.isNewer(tool.version, installed.version);

  const status =
    installed === null
      ? tool !== null
        ? w.t("tool.available", { version: tool.version })
        : ""
      : w.t("tool.installed", { version: installed.version }) + (updateAvailable ? " · " + w.t("tool.available", { version: tool!.version }) : " · " + w.t("tool.upToDate"));
  const profile = installed !== null ? (w.profiles.get(id) ?? null) : null;
  const pct = w.busy.get(id);
  const error = w.errors.get(id);
  const icon = toolIcon(id);

  return (
    <div className="card hub-card" data-tool={id}>
      {icon !== null ? (
        <img className="hub-tool-icon" src={icon} width={52} height={52} alt="" />
      ) : (
        <div className="hub-tool-icon hub-tool-prompt">{">_"}</div>
      )}
      <div className="cs-stack hub-info">
        {UiParts.text(name, 18, FontWeight.Bold)}
        {tool !== null && UiParts.text(tool.descriptionFor(w.lang), 14)}
        <div className="cs-text muted hub-status" style={{ fontSize: 12.5 }}>
          {status}
        </div>
        {tool !== null && asset === null && UiParts.text(w.t("tool.notForPlatform"), 12.5, undefined, "muted")}
        {profile !== null && <ProfileRow model={profileModelFor(w, profile)} onOpen={() => openAchievements(w, name, profile)} />}

        <div className="hub-actions">
          {pct !== undefined ? (
            <div className="cs-stack hub-progress">
              {UiParts.text(pct < 0 ? w.t("tool.installing") : w.t("tool.downloading", { percent: pct }), 13)}
              <div className={"cs-bar" + (pct < 0 ? " indeterminate" : "")} style={{ height: 6 }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct < 0 ? undefined : pct}>
                <span style={{ width: pct < 0 ? "30%" : `${pct}%` }} />
              </div>
            </div>
          ) : (
            <>
              {installed !== null && <Action label={"▶  " + w.t("tool.open")} cls={updateAvailable ? "secondary" : "primary"} onClick={() => void w.open(id, name)} />}
              {updateAvailable && <Action label={"⬇  " + w.t("tool.update", { version: tool!.version })} cls="primary" onClick={() => void w.install(tool!, asset!)} />}
              {installed === null && tool !== null && asset !== null && <Action label={"⬇  " + w.t("tool.install")} cls="primary" onClick={() => void w.install(tool, asset)} />}
              {tool !== null && (tool.changes?.length ?? 0) > 0 && <Action label={w.t("tool.whatsNew")} cls="flat" onClick={() => w.showNews(tool.name, MainWindow.entries(tool).slice(0, 5))} />}
              {installed?.previous != null && <Action label={"↶  " + w.t("tool.rollback", { version: installed.previous })} cls="flat" onClick={() => void w.rollBack(id)} />}
              {installed !== null && <Action label={w.t("tool.uninstall")} cls="danger-outline" onClick={() => w.confirmUninstall(id, name)} />}
            </>
          )}
        </div>
        {error !== undefined && <div className="cs-text hub-error">{w.t("tool.failed", { error })}</div>}
      </div>
    </div>
  );
}
