// Port of Network/ResolvedOk.cs – network model: a successful name lookup.

export interface ResolvedOk {
  readonly ok: true;
  ip: string;
  /** The name that was typed (or the IP address). */
  name: string;
  /** "literal", "hosts" or "dns". */
  source: string;
}
