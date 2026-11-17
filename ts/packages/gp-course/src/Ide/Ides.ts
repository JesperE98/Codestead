import { IdeInfo } from "./IdeInfo.js";

const VisualStudio = "vs";
const CLion = "clion";
const Rider = "rider";
const VSCode = "vscode";

const all: readonly IdeInfo[] = [new IdeInfo(VisualStudio, "Visual Studio", false), new IdeInfo(CLion, "CLion", true), new IdeInfo(Rider, "Rider", false), new IdeInfo(VSCode, "VS Code", true)];

/** OperatingSystem.IsWindows(): Node's / Electron's process.platform, else the browser's user agent. */
export function isWindows(): boolean {
  const platform = (globalThis as { process?: { platform?: string } }).process?.platform;
  if (platform !== undefined) return platform === "win32";
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent?.includes("Windows") ?? false;
}

/**
 * The IDEs the course's texts have steps for. Visual Studio and Rider follow the Visual Studio solution route
 * (.sln/.vcxproj), CLion and VS Code (with CMake Tools) the CMake route. The choice only changes which ":::ide"
 * blocks of the texts are shown and where the panel says the program will appear; detection does not depend on it.
 */
export const Ides = {
  VisualStudio,
  CLion,
  Rider,
  VSCode,

  all,

  /** Visual Studio on Windows, CLion elsewhere. */
  get default(): string {
    return isWindows() ? VisualStudio : CLion;
  },

  isKnown(id: string | null | undefined): boolean {
    return all.some((i) => i.id === id);
  },

  get(id: string | null | undefined): IdeInfo {
    return all.find((i) => i.id === id) ?? all.find((i) => i.id === Ides.default)!;
  },
};
