// Port of Services/LinkChange.cs – systemd model: the symlinks created and removed by enable/disable.

export interface LinkChange {
  created: string[];
  removed: string[];
}
