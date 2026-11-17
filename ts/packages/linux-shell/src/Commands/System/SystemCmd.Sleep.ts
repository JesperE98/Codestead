// Port of Commands/System/SystemCmd.Sleep.cs – the sleep command: waits for a while.

import { simple } from "./SystemCmd.js";

export const sleep = simple("sleep", "Väntar en stund", () => 0, `NAMN
       sleep - vänta ett antal sekunder

BESKRIVNING
       I simulatorn returnerar sleep direkt.`);
