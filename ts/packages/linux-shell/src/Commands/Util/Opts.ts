// Port of Commands/Util/Opts.cs – parsed command line options (see UtilCmd.parseOpts).

export interface Opts {
  flags: Set<string>;
  values: Map<string, string>;
  operands: string[];
  error: string | null;
}
