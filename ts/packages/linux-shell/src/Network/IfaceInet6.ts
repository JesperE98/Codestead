// Port of Network/IfaceInet6.cs – network model: an IPv6 address of an interface.

export interface IfaceInet6 {
  addr: string;
  prefix: number;
  scope: string;
  extra: string;
}
