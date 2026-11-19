// Port of Network/Resolved.cs – network model: the result of a name lookup (ResolvedOk or ResolvedFail).

import type { ResolvedFail } from "./ResolvedFail.js";
import type { ResolvedOk } from "./ResolvedOk.js";

/** Result of NetworkLib.resolveHost: ResolvedOk (ok: true) or ResolvedFail (ok: false). */
export type Resolved = ResolvedOk | ResolvedFail;
