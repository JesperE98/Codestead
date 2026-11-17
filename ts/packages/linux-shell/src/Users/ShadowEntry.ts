// Port of Users/ShadowEntry.cs – users: one line of /etc/shadow.

export interface ShadowEntry {
  name: string;
  /** Password hash. A leading "!" or "*" means locked/no password. */
  hash: string;
  /** Last password change, in days since 1970-01-01 (empty = never). */
  lastChange: string;
  min: string;
  max: string;
  warn: string;
  inactive: string;
  expire: string;
  reserved: string;
}
