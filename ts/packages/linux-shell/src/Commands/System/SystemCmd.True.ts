// Port of Commands/System/SystemCmd.True.cs – the true command: does nothing, always succeeds.

import { simple } from "./SystemCmd.js";

export const trueCmd = simple("true", "Gör ingenting, lyckas alltid", () => 0);
