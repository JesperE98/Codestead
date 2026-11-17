// Port of Vfs/User.cs – virtual file system: a user as seen by permission checks (name, uid, groups, home).

export interface User {
  name: string;
  uid: number;
  groups: string[];
  home: string;
}
