// Version numbers major.minor.patch.

/** A parsed version (System.Version with three parts). */
export type Version = readonly [major: number, minor: number, build: number];

const int32Max = 2147483647;

/** Versions "major.minor.patch" (as in build/Codestead.props). */
export const SemVer = {
  /**
   * The version, or null when `s` is not exactly digits.digits.digits (C#: the regex \A\d+\.\d+\.\d+\z and
   * Version.TryParse, which also needs every part to fit in an int).
   */
  parse(s: string | null | undefined): Version | null {
    if (s == null || !/^\d+\.\d+\.\d+$/.test(s)) return null;
    const parts = s.split(".").map(Number);
    if (parts.some((p) => p > int32Max)) return null;
    return [parts[0]!, parts[1]!, parts[2]!];
  },

  /** Compares like System.Version: negative, 0 or positive. */
  compare(a: Version, b: Version): number {
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  },

  /** Is `candidate` newer than `installed`? */
  isNewer(candidate: string, installed: string): boolean {
    const c = SemVer.parse(candidate);
    const i = SemVer.parse(installed);
    return c !== null && i !== null && SemVer.compare(c, i) > 0;
  },
};
