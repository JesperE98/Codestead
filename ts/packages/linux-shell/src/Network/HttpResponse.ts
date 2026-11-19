// Port of Network/HttpResponse.cs – network model: an HTTP response.

export interface HttpResponse {
  status: number;
  reason: string;
  /** "HTTP/1.1", "HTTP/1.0" or "HTTP/2". */
  version: string;
  /** The headers in order (a list of (Key, Value) tuples in C#). */
  headers: { key: string; value: string }[];
  body: string;
}
