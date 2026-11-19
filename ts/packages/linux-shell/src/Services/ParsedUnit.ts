// Port of Services/ParsedUnit.cs – systemd model: the settings read from a unit file.

export interface ParsedUnit {
  description: string;
  docs: string[];
  /** "simple", "exec", "notify", "forking", "oneshot" or "dbus". */
  type: string;
  exec: string;
  reload: string | null;
  user: string | null;
  remainAfterExit: boolean;
  wantedBy: string[];
  alias: string[];
}
