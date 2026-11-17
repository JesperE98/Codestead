/// <reference types="vite/client" />
// Vite's import.meta.glob, import.meta.env and ?raw / ?url / ?inline imports: the hub reads the repository's files
// (texts, icons, the changelog, Codestead.props) the way the C# hub embeds them, without copies.

interface ImportMetaEnv {
  /** The full version, given by the release build (the C# release passes -p:Version=x.y.z); local builds are x.y.0. */
  readonly VITE_CODESTEAD_HUB_VERSION?: string;
}
