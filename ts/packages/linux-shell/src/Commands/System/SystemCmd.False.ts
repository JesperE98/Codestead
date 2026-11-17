// Port of Commands/System/SystemCmd.False.cs – the false command: does nothing, always fails.

import { simple } from "./SystemCmd.js";

export const falseCmd = simple("false", "Gör ingenting, misslyckas alltid", () => 1);
