// Port of Network/Iface.cs – network model: a network interface (lo, enp0s3).

import type { IfaceInet } from "./IfaceInet.js";
import type { IfaceInet6 } from "./IfaceInet6.js";

export interface Iface {
  index: number;
  name: string;
  flags: string;
  mtu: number;
  qdisc: string;
  /** "UP", "DOWN" or "UNKNOWN". */
  state: string;
  linkType: string;
  mac: string;
  brd: string;
  inet: IfaceInet[];
  inet6: IfaceInet6[];
}
