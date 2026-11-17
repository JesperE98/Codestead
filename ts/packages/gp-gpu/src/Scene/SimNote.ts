import { NoteLevel } from "./NoteLevel.js";

/**
 * Something the simulated run wants to tell the learner ("the window closed right away: there is no render loop").
 * `key` is a text in the tool's language files ("sim.&lt;key&gt;") with {placeholders} from `args`.
 */
export class SimNote {
  constructor(readonly key: string, readonly level: NoteLevel, readonly args: ReadonlyMap<string, string>) {}

  static info(key: string, ...args: [string, string][]): SimNote {
    return new SimNote(key, NoteLevel.Info, toMap(args));
  }

  static warning(key: string, ...args: [string, string][]): SimNote {
    return new SimNote(key, NoteLevel.Warning, toMap(args));
  }

  static error(key: string, ...args: [string, string][]): SimNote {
    return new SimNote(key, NoteLevel.Error, toMap(args));
  }
}

// ToDictionary throws on a duplicate key, as the C# code does.
function toMap(args: [string, string][]): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of args) {
    if (map.has(k)) throw new Error(`An item with the same key has already been added. Key: ${k}`);
    map.set(k, v);
  }
  return map;
}
