// Port of Commands/Git/GitCmd.Args.cs – argument parsing shared by the subcommands.

import { GitExit } from "./GitCmd.js";

export class Parsed {
  opts = new Map<string, string[]>();
  operands: string[] = [];
  /** What came after "--" (null if there was no "--"). */
  paths: string[] | null = null;

  has(name: string): boolean {
    return this.opts.has(name);
  }

  get(name: string): string | null {
    const v = this.opts.get(name);
    return v !== undefined && v.length > 0 ? v.at(-1)! : null;
  }

  getAll(name: string): string[] | null {
    return this.opts.get(name) ?? null;
  }
}

const negNumRe = /^-[0-9]+$/;

/**
 * Parses flags according to a list like ["a|all", "m|message=", "amend"]:
 * short|long name, "=" means the flag takes a value. Flags can be repeated.
 */
export function parseArgs(args: readonly string[], spec: readonly string[], cmd: string): Parsed {
  const shortDefs = new Map<string, { name: string; value: boolean }>();
  const longDefs = new Map<string, { name: string; value: boolean }>();
  for (const s of spec) {
    const value = s.endsWith("=");
    const names = (value ? s.slice(0, -1) : s).split("|");
    const name = names.find((n) => n.length > 1) ?? names[0]!;
    for (const n of names) {
      if (n.length === 1) shortDefs.set(n, { name, value });
      else longDefs.set(n, { name, value });
    }
  }
  const o = new Parsed();
  const add = (name: string, v: string): void => {
    let list = o.opts.get(name);
    if (list === undefined) o.opts.set(name, (list = []));
    list.push(v);
  };
  const bad = (what: string): GitExit => new GitExit(`error: unknown ${what}\nusage: git ${cmd} [<options>]\n`, 129);
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--") {
      o.paths = args.slice(i + 1);
      break;
    }
    if (a.startsWith("--") && a.length > 2) {
      const eq = a.indexOf("=");
      let key = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      let def = longDefs.get(key) ?? null;
      let negated = false;
      if (def === null && key.startsWith("no-") && longDefs.has(key.slice(3))) {
        def = longDefs.get(key.slice(3))!;
        key = key.slice(3);
        negated = true;
      }
      if (def === null) {
        // Abbreviations such as --stag for --staged.
        const hits = [...longDefs.keys()].filter((k) => k.startsWith(key));
        if (hits.length === 1) def = longDefs.get(hits[0]!)!;
      }
      if (def === null) throw bad(`option '${a.slice(2)}'`);
      if (negated) {
        o.opts.delete(def.name);
        add("no-" + def.name, "");
      } else if (def.value) {
        const v = eq >= 0 ? a.slice(eq + 1) : ++i < args.length ? args[i]! : null;
        if (v === null) throw new GitExit(`error: option \`${key}' requires a value\n`, 129);
        add(def.name, v);
      } else add(def.name, "");
      continue;
    }
    if (a.startsWith("-") && a.length > 1 && !negNumRe.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const c = a[j]!;
        const def = shortDefs.get(c);
        if (def === undefined) throw bad(`switch \`${c}'`);
        if (def.value) {
          const rest = a.slice(j + 1);
          const v = rest !== "" ? rest : ++i < args.length ? args[i]! : null;
          if (v === null) throw new GitExit(`error: switch \`${c}' requires a value\n`, 129);
          add(def.name, v);
          break;
        }
        add(def.name, "");
      }
      continue;
    }
    o.operands.push(a);
  }
  return o;
}
