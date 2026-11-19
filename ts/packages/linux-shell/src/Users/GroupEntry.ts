// Port of Users/GroupEntry.cs – users: one line of /etc/group.

export interface GroupEntry {
  name: string;
  password: string;
  gid: number;
  members: string[];
}
