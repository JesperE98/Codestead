// Port of Users/UserDb.cs – users: /etc/passwd, /etc/group and /etc/shadow loaded together.

import type { GroupEntry } from "./GroupEntry.js";
import type { PasswdEntry } from "./PasswdEntry.js";
import type { ShadowEntry } from "./ShadowEntry.js";

export interface UserDb {
  passwd: PasswdEntry[];
  group: GroupEntry[];
  shadow: ShadowEntry[];
}
