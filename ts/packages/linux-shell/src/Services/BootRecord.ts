// Port of Services/BootRecord.cs – systemd model: one boot of the computer.

/** One boot ({ id, start }). */
export interface BootRecord {
  id: string;
  start: number;
}
