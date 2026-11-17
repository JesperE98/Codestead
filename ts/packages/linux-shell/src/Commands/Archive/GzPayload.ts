// Port of Commands/Archive/GzPayload.cs – what gzip stores.

/** What gzip stores: the original name, a pretend size if any, and the data itself. */
export interface GzPayload {
  n?: string | null;
  s?: number | null;
  d: string;
}
