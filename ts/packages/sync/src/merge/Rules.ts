import { isRecord, type Json, jsonEqual, type JsonRecord } from "../Json.js";

// Three-way merge rules over parsed JSON. Every rule gets the base (the version both sides last agreed on), the local
// and the remote value – undefined where a side has none – and returns the merged value (undefined = left out).

export type Side = "local" | "remote";

export interface MergeContext {
  /** The side that was saved last; it wins where nothing else decides. */
  readonly newer: Side;
}

export type Rule = (base: Json | undefined, local: Json | undefined, remote: Json | undefined, ctx: MergeContext) => Json | undefined;

/** Picks between two different values that both changed since the base (neither is undefined). */
export type Resolver = (local: Json, remote: Json, ctx: MergeContext) => Json;

/**
 * The value that changed: the other side's when one side still equals the base. When both changed, `resolve` decides
 * – except that a value changed on one side and removed on the other is kept (no work is lost).
 */
export function scalar(resolve: Resolver): Rule {
  return (b, l, r, ctx) => {
    if (jsonEqual(l, b)) return r;
    if (jsonEqual(r, b) || jsonEqual(l, r)) return l;
    if (l === undefined) return r;
    if (r === undefined) return l;
    return resolve(l, r, ctx);
  };
}

/** Both changed: the side saved last wins. */
export const newest: Rule = scalar((l, r, ctx) => (ctx.newer === "local" ? l : r));

/** Both changed: the larger number wins (anything else: the side saved last). */
export const max: Rule = scalar((l, r, ctx) =>
  typeof l === "number" && typeof r === "number" ? Math.max(l, r) : ctx.newer === "local" ? l : r,
);

/** Both changed: the smaller string wins – e.g. the earlier of two "yyyy-MM-ddTHH:mm" dates. */
export const earliest: Rule = scalar((l, r, ctx) =>
  typeof l === "string" && typeof r === "string" ? (l <= r ? l : r) : ctx.newer === "local" ? l : r,
);

function num(v: Json | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : v === undefined ? 0 : null;
}

/**
 * A counter that only grows: what each side added since the base is added up. A side whose count is below the base
 * was reset; then the base is dropped and only what was counted after the reset (and on the other side) remains.
 * Without a base (the first sync on a computer) nothing tells what the two sides share, so the larger count wins.
 */
export const counter: Rule = (b, l, r, ctx) => {
  if (l === undefined && r === undefined) return undefined;
  if (b === undefined && l !== undefined && r !== undefined) return max(b, l, r, ctx);
  const nb = num(b), nl = num(l), nr = num(r);
  if (nb === null || nl === null || nr === null) return newest(b, l, r, ctx);
  const reset = nl < nb || nr < nb;
  const added = (n: number) => (n >= nb ? n - nb : n);
  return (reset ? 0 : nb) + added(nl) + added(nr);
};

function stringList(v: Json | undefined): string[] | null {
  if (v === undefined) return [];
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null;
}

/**
 * A list used as a set of strings: an item stays when either side has it, unless it was in the base and one side
 * removed it. Local order first, then what only the remote side has.
 */
export const set: Rule = (b, l, r, ctx) => {
  if (l === undefined && r === undefined) return undefined;
  const lb = stringList(b), ll = stringList(l), lr = stringList(r);
  if (lb === null || ll === null || lr === null) return newest(b, l, r, ctx);
  const inB = new Set(lb), inL = new Set(ll), inR = new Set(lr);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of [...ll, ...lr]) {
    if (seen.has(x)) continue;
    seen.add(x);
    if (inB.has(x) && (!inL.has(x) || !inR.has(x))) continue;
    out.push(x);
  }
  return out;
};

/** Keys in merge order: the local object's, then the ones only the remote object has. */
function keysOf(l: JsonRecord | undefined, r: JsonRecord | undefined): string[] {
  const keys = Object.keys(l ?? {});
  for (const k of Object.keys(r ?? {})) if (!Object.hasOwn(l ?? {}, k)) keys.push(k);
  return keys;
}

function recordOrUndefined(v: Json | undefined): JsonRecord | undefined | null {
  return v === undefined ? undefined : isRecord(v) ? v : null;
}

/** An object used as a map (task key → value): each key is merged with `value`. */
export function map(value: Rule): Rule {
  return (b, l, r, ctx) => {
    if (l === undefined && r === undefined) return undefined;
    const mb = recordOrUndefined(b), ml = recordOrUndefined(l), mr = recordOrUndefined(r);
    if (mb === null || ml === null || mr === null) return newest(b, l, r, ctx);
    const out: JsonRecord = {};
    for (const k of keysOf(ml, mr)) {
      const v = value(mb?.[k], ml?.[k], mr?.[k], ctx);
      if (v !== undefined) out[k] = v;
    }
    return out;
  };
}

/** Fields that belong together and come from one side, e.g. a streak and the day it was last extended. */
export interface FieldGroup {
  readonly keys: readonly string[];
  /** Both sides changed the group: which one to take. */
  readonly pick: (local: JsonRecord, remote: JsonRecord, ctx: MergeContext) => Side;
}

/**
 * An object with known fields: each field merged by its rule, groups taken whole from one side, and any field without
 * a rule (one a newer version added) merged with {@link newest}, so it is never lost.
 */
export function record(fields: Readonly<Record<string, Rule>>, groups: readonly FieldGroup[] = []): Rule {
  return (b, l, r, ctx) => {
    if (l === undefined && r === undefined) return undefined;
    const ob = recordOrUndefined(b), ol = recordOrUndefined(l), or = recordOrUndefined(r);
    if (ob === null || ol === null || or === null) return newest(b, l, r, ctx);
    const merged = new Map<string, Json>();
    const grouped = new Set<string>();
    for (const g of groups) {
      for (const k of g.keys) grouped.add(k);
      const tuple = (o: JsonRecord | undefined): Json[] => g.keys.map((k) => o?.[k] ?? null);
      let side: Side;
      if (jsonEqual(tuple(ol), tuple(ob))) side = "remote";
      else if (jsonEqual(tuple(or), tuple(ob))) side = "local";
      else if (ol === undefined) side = "remote";
      else if (or === undefined) side = "local";
      else side = g.pick(ol, or, ctx);
      const from = side === "local" ? ol : or;
      for (const k of g.keys) {
        const v = from?.[k];
        if (v !== undefined) merged.set(k, v);
      }
    }
    for (const k of keysOf(ol, or)) {
      if (grouped.has(k)) continue;
      const v = (fields[k] ?? newest)(ob?.[k], ol?.[k], or?.[k], ctx);
      if (v !== undefined) merged.set(k, v);
    }
    const out: JsonRecord = {};
    for (const k of keysOf(ol, or)) {
      const v = merged.get(k);
      if (v !== undefined) out[k] = v;
    }
    return out;
  };
}
