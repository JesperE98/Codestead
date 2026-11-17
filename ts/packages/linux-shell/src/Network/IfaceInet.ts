// Port of Network/IfaceInet.cs – network model: the IPv4 address of an interface.

export interface IfaceInet {
  addr: string;
  prefix: number;
  brd?: string | null;
  scope: string;
  extra: string;
  lft: string;
}
