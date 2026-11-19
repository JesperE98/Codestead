// Port of Commands/System/SystemCmd.Date.cs – the date command: shows the date and time.

import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

export const date = simple(
  "date",
  "Visar datum och tid",
  (ctx) => {
    ctx.out(UtilCmd.longDate() + "\n");
    return 0;
  },
  `NAMN
       date - visa datum och tid`,
);
