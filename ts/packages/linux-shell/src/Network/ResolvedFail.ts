// Port of Network/ResolvedFail.cs – network model: a failed name lookup.

export interface ResolvedFail {
  readonly ok: false;
  /** "notfound" or "tempfail". */
  error: string;
}
