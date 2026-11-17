// Port of Users/PasswdEntry.cs – users: one line of /etc/passwd.

export interface PasswdEntry {
  name: string;
  password: string;
  uid: number;
  gid: number;
  gecos: string;
  home: string;
  shell: string;
}
