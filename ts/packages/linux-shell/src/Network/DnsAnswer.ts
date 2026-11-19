// Port of Network/DnsAnswer.cs – network model: the answer to a DNS query.

/** DNS answer. status is "NOERROR", "NXDOMAIN" or "SERVFAIL". */
export interface DnsAnswer {
  status: string;
  a: string[];
  aaaa: string[];
}
