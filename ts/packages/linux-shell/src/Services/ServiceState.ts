// Port of Services/ServiceState.cs – systemd model: the saved state of all services, the journal and the boots.

import type { Obj } from "../Js.js";
import type { BootRecord } from "./BootRecord.js";
import type { JournalEntry } from "./JournalEntry.js";
import type { UnitRt } from "./UnitRt.js";

export interface ServiceState {
  units: Obj<UnitRt>;
  journal: JournalEntry[];
  /** All boots; the last one is the current one. */
  boots: BootRecord[];
  /** Running number for jobs (shown with journalctl -x). */
  job: number;
  machineId: string;
}
