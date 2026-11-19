// Port of Commands/Util/OptSpec.cs – which options a command accepts (see UtilCmd.parseOpts).

export interface OptSpec {
  /** Flags without a value, e.g. "laR". */
  flags?: string | null;
  /** Flags that take a value, e.g. "n" for `head -n 5`. */
  values?: string | null;
  /** Long flags (--all) mapped to short ones (a). */
  long?: Record<string, string> | null;
}
