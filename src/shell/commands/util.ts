import type { CmdCtx } from '../types';
import { FsError, type FsNode } from '../vfs';

export const COLOR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[1;31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[1;34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  execGreen: '\x1b[1;32m',
};

export interface Opts {
  flags: Set<string>;
  values: Record<string, string>;
  operands: string[];
  error?: string;
}

export interface OptSpec {
  /** Flaggor utan värde, t.ex. "laR". */
  flags?: string;
  /** Flaggor som tar ett värde, t.ex. "n" för `head -n 5`. */
  values?: string;
  /** Långa flaggor (--all) mappade till korta (a). */
  long?: Record<string, string>;
}

/** Enkel getopt: hanterar -la, -n 5, -n5, --all, --lines=5 och --. */
export function parseOpts(args: string[], spec: OptSpec): Opts {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const operands: string[] = [];
  const takesValue = (c: string) => spec.values?.includes(c) ?? false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      operands.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      const key = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      const mapped = spec.long?.[key];
      if (mapped === undefined) return { flags, values, operands, error: `unrecognized option '${a}'` };
      if (takesValue(mapped)) {
        const v = eq >= 0 ? a.slice(eq + 1) : args[++i];
        if (v === undefined) return { flags, values, operands, error: `option '${a}' requires an argument` };
        values[mapped] = v;
      } else {
        flags.add(mapped);
      }
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const c = a[j];
        if (takesValue(c)) {
          const rest = a.slice(j + 1);
          const v = rest || args[++i];
          if (v === undefined) return { flags, values, operands, error: `option requires an argument -- '${c}'` };
          values[c] = v;
          break;
        }
        if (spec.flags?.includes(c)) flags.add(c);
        else return { flags, values, operands, error: `invalid option -- '${c}'` };
      }
      continue;
    }
    operands.push(a);
  }
  return { flags, values, operands };
}

export function badOption(ctx: CmdCtx, error: string, code = 1): number {
  ctx.err(`${ctx.name}: ${error}\nTry '${ctx.name} --help' for more information.\n`);
  return code;
}

export function fsMessage(e: unknown): string {
  if (e instanceof FsError) return e.message;
  throw e;
}

export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function joinLines(lines: string[]): string {
  return lines.map((l) => l + '\n').join('');
}

export interface Input {
  label: string;
  content: string;
}

/**
 * Läser filerna i `operands` (eller stdin om inga anges / "-").
 * Fel skrivs ut direkt; `failed` blir sant om något gick fel.
 */
export function readInputs(
  ctx: CmdCtx,
  operands: string[],
  errFormat: (label: string, msg: string) => string = (l, m) => `${ctx.name}: ${l}: ${m}`,
): { inputs: Input[]; failed: boolean } {
  const inputs: Input[] = [];
  let failed = false;
  const list = operands.length ? operands : ['-'];
  for (const op of list) {
    if (op === '-') {
      inputs.push({ label: '(standard input)', content: ctx.stdin ?? '' });
      continue;
    }
    try {
      inputs.push({ label: op, content: ctx.sh.vfs.readFile(ctx.sh.resolve(op), ctx.sh.currentUser()) });
    } catch (e) {
      ctx.err(errFormat(op, fsMessage(e)) + '\n');
      failed = true;
    }
  }
  return { inputs, failed };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function lsDate(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${hh}:${mm}`;
}

export function longDate(d = new Date()): string {
  const t = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  let tz = 'UTC';
  try {
    tz = d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() ?? 'UTC';
  } catch {
    /* ignoreras */
  }
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${t} ${tz} ${d.getFullYear()}`;
}

export function modeString(n: FsNode): string {
  const m = n.mode;
  const tri = (shift: number, special: number, ch: string) => {
    const bits = (m >> shift) & 7;
    const r = bits & 4 ? 'r' : '-';
    const w = bits & 2 ? 'w' : '-';
    let x = bits & 1 ? 'x' : '-';
    if (m & special) x = bits & 1 ? ch : ch.toUpperCase();
    return r + w + x;
  };
  return (n.type === 'dir' ? 'd' : '-') + tri(6, 0o4000, 's') + tri(3, 0o2000, 's') + tri(0, 0o1000, 't');
}

export function colorName(name: string, node: FsNode, tty: boolean): string {
  if (!tty) return name;
  if (node.type === 'dir') {
    if ((node.mode & 0o1002) === 0o1002) return `\x1b[30;42m${name}${COLOR.reset}`;
    return `${COLOR.blue}${name}${COLOR.reset}`;
  }
  if (node.mode & 0o4000) return `\x1b[37;41m${name}${COLOR.reset}`;
  if (node.mode & 0o111) return `${COLOR.execGreen}${name}${COLOR.reset}`;
  return name;
}

export function humanSize(n: number): string {
  if (n < 1024) return String(n);
  const units = ['K', 'M', 'G'];
  let v = n;
  let u = -1;
  do {
    v /= 1024;
    u++;
  } while (v >= 1024 && u < units.length - 1);
  return (v < 10 ? (Math.ceil(v * 10) / 10).toFixed(1) : String(Math.ceil(v))) + units[u];
}

export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Formaterar en förenklad manualsida. */
export function formatMan(name: string, body: string): string {
  const title = `${name.toUpperCase()}(1)`;
  // Svenska manualsidor börjar med NAMN, engelska med NAME.
  const mid = /^\s*NAMN\b/.test(body) ? 'Simulerad manual' : 'Simulated manual';
  const pad = Math.max(1, Math.floor((72 - title.length * 2 - mid.length) / 2));
  return `${title}${' '.repeat(pad)}${mid}${' '.repeat(pad)}${title}\n\n${body.trim()}\n\n`;
}
