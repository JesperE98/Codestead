// Port of Commands/Users/UsersCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/users.ts User management: useradd, usermod, userdel, groupadd, groupdel, gpasswd, passwd, chpasswd, chage, adduser/deluser/addgroup/delgroup (Debian), chgrp, who, w, last and getent. Everything reads and writes /etc/passwd, /etc/group and /etc/shadow via Users/ (UsersLib).
//
// Wave 2 ports this group: the root file (the C# UsersCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file UsersCmd.<Name>.cs becomes UsersCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Useradd, Usermod, Userdel, Groupadd, Groupdel, Gpasswd, Passwd, Chpasswd, Chage, Adduser, Deluser, Addgroup, Delgroup, Chgrp, Who, W, Last, Getent
 */
export function all(): CommandDef[] {
  return [];
}
