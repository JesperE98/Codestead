// A small tween engine with the part of GSAP's API the Render Pipeline Visualizer's slides use (gsap.to, from, fromTo,
// set, timeline, killTweensOf, delayedCall; eases none, power1-3 and back), so the slides run unchanged without GSAP:
// GSAP's "standard no-charge" licence is not an open-source licence and the package only links to its terms, so it is
// not shipped with Codestead (see the package's README). The vendored slides import it as `gsap`
// (scripts/sync-visualizer.mjs rewrites their `import gsap from 'gsap'`).
//
// Times are seconds. A tween animates numbers (and numbers inside strings: "24%", "blur(8px)") of plain objects
// (three.js vectors, materials, uniforms) and of DOM elements (x, y, scale, rotation as a CSS transform; opacity and
// other style properties). Contexts: every tween made while a context runs (a scene's code, or a callback of a tween
// of the context) belongs to it, and killContext stops them all when the scene goes away.

export type Ease = (t: number) => number;

/** The options of a tween; every other key is a property to animate. */
export interface TweenVars {
  [key: string]: any;
  duration?: number;
  delay?: number;
  ease?: string | Ease;
  stagger?: number;
  repeat?: number;
  yoyo?: boolean;
  repeatDelay?: number;
  immediateRender?: boolean;
  overwrite?: boolean | "auto";
  clearProps?: string;
  transformOrigin?: string;
  paused?: boolean;
  onStart?: (this: Tween, ...args: any[]) => void;
  onUpdate?: (this: Tween, ...args: any[]) => void;
  onComplete?: (this: Tween, ...args: any[]) => void;
}

export interface TimelineVars {
  repeat?: number;
  delay?: number;
  paused?: boolean;
  onComplete?: () => void;
}

const reserved = new Set([
  "duration",
  "delay",
  "ease",
  "stagger",
  "repeat",
  "yoyo",
  "repeatDelay",
  "immediateRender",
  "overwrite",
  "clearProps",
  "transformOrigin",
  "paused",
  "onStart",
  "onUpdate",
  "onComplete",
  "callbackScope",
]);

// ---------- Eases ----------

const powerIn = (p: number): Ease => (t) => t ** (p + 1);
const powerOut = (p: number): Ease => (t) => 1 - (1 - t) ** (p + 1);
const powerInOut = (p: number): Ease => (t) => (t < 0.5 ? (2 * t) ** (p + 1) / 2 : 1 - (2 * (1 - t)) ** (p + 1) / 2);
const backOut = (s: number): Ease => (t) => {
  const u = t - 1;
  return u * u * ((s + 1) * u + s) + 1;
};
const backIn = (s: number): Ease => (t) => t * t * ((s + 1) * t - s);

/** GSAP's ease names ("power2.inOut", "back.out(1.6)", "none"); unknown names ease like GSAP's default, power1.out. */
export function ease(name: string | Ease | undefined): Ease {
  if (typeof name === "function") return name;
  if (name === undefined) return powerOut(1);
  if (name === "none" || name === "linear") return (t) => t;
  const m = /^(power([0-4])|quad|cubic|quart|sine|back|expo)\.(in|out|inOut)(?:\(([\d.]+)\))?$/.exec(name);
  if (!m) return powerOut(1);
  const kind = m[1]!;
  const dir = m[3]!;
  if (kind === "back") {
    const s = m[4] !== undefined ? Number(m[4]) : 1.70158;
    const inn = backIn(s);
    const out = backOut(s);
    return dir === "in" ? inn : dir === "out" ? out : (t) => (t < 0.5 ? inn(2 * t) / 2 : 0.5 + out(2 * t - 1) / 2);
  }
  if (kind === "sine") return dir === "in" ? (t) => 1 - Math.cos((t * Math.PI) / 2) : dir === "out" ? (t) => Math.sin((t * Math.PI) / 2) : (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const power = m[2] !== undefined ? Number(m[2]) : kind === "quad" ? 1 : kind === "cubic" ? 2 : kind === "quart" ? 3 : 4;
  return dir === "in" ? powerIn(power) : dir === "out" ? powerOut(power) : powerInOut(power);
}

// ---------- Values ----------

const transformKeys = new Set(["x", "y", "scale", "scaleX", "scaleY", "rotation"]);
interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}
const transforms = new WeakMap<Element, Transform>();

function isElement(t: unknown): t is HTMLElement | SVGElement {
  return typeof Element !== "undefined" && t instanceof Element;
}

function transformOf(el: Element): Transform {
  let tr = transforms.get(el);
  if (!tr) {
    tr = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    transforms.set(el, tr);
  }
  return tr;
}

function styleOf(el: Element): CSSStyleDeclaration {
  return (el as HTMLElement).style;
}

function read(target: any, key: string): unknown {
  if (isElement(target)) {
    if (transformKeys.has(key)) {
      const tr = transformOf(target);
      return key === "scale" ? tr.scaleX : (tr as unknown as Record<string, number>)[key];
    }
    const style = styleOf(target);
    if (key in style) {
      const inline = style.getPropertyValue(cssName(key));
      if (inline !== "") return inline;
      const computed = typeof getComputedStyle === "function" ? getComputedStyle(target).getPropertyValue(cssName(key)) : "";
      return key === "opacity" ? (computed === "" ? 1 : Number(computed)) : computed;
    }
  }
  return target[key];
}

function cssName(key: string): string {
  return key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

function write(target: any, key: string, value: unknown): void {
  if (isElement(target)) {
    if (transformKeys.has(key)) {
      const tr = transformOf(target);
      const v = Number(value);
      if (key === "scale") tr.scaleX = tr.scaleY = v;
      else (tr as unknown as Record<string, number>)[key] = v;
      styleOf(target).transform = `translate(${tr.x}px, ${tr.y}px) rotate(${tr.rotation}deg) scale(${tr.scaleX}, ${tr.scaleY})`;
      return;
    }
    const style = styleOf(target);
    if (key in style) {
      style.setProperty(cssName(key), typeof value === "number" && key !== "opacity" && key !== "zIndex" ? `${value}px` : String(value));
      return;
    }
  }
  target[key] = value;
}

/** The numbers in a string and the text around them ("blur(8px)" → ["blur(", "px)"], [8]). */
function split(s: string): { parts: string[]; nums: number[] } {
  const parts: string[] = [];
  const nums: number[] = [];
  let last = 0;
  for (const m of s.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)) {
    parts.push(s.slice(last, m.index));
    nums.push(Number(m[0]));
    last = m.index + m[0].length;
  }
  parts.push(s.slice(last));
  return { parts, nums };
}

type Lerp = (p: number) => unknown;

/** How a property goes from `from` to `to`. */
function lerp(from: unknown, to: unknown): Lerp {
  if (typeof to === "number") {
    const a = typeof from === "number" ? from : parseFloat(String(from));
    const start = Number.isFinite(a) ? a : to;
    return (p) => start + (to - start) * p;
  }
  if (typeof to === "string") {
    const b = split(to);
    const a = split(typeof from === "number" ? String(from) : typeof from === "string" ? from : "");
    if (b.nums.length > 0 && a.nums.length === b.nums.length) return (p) => b.parts.map((part, i) => (i < b.nums.length ? part + (a.nums[i]! + (b.nums[i]! - a.nums[i]!) * p) : part)).join("");
    if (b.nums.length === 1 && b.parts[0] === "" && typeof from === "number") return (p) => `${from + (b.nums[0]! - from) * p}${b.parts[1]}`;
  }
  return (p) => (p >= 1 ? to : from);
}

// ---------- Contexts and the ticker ----------

/** Whatever owns tweens (a scene): killContext stops every tween made while it was current. */
export type Context = object;
let currentContext: Context | null = null;
const byContext = new Map<Context, Set<Animation>>();

/** Runs `fn` with `ctx` as the current context (tweens made meanwhile belong to it). */
export function withContext<T>(ctx: Context | null, fn: () => T): T {
  const prev = currentContext;
  currentContext = ctx;
  try {
    return fn();
  } finally {
    currentContext = prev;
  }
}

/** Kills every tween and timeline of the context. */
export function killContext(ctx: Context): void {
  const set = byContext.get(ctx);
  byContext.delete(ctx);
  pausedBy.delete(ctx);
  set?.forEach((a) => a.kill());
}

/** Pauses (or resumes) every running tween and timeline of the context. */
export function pauseContext(ctx: Context, paused: boolean): void {
  if (paused) {
    const list = [...(byContext.get(ctx) ?? [])].filter((a) => a.parent === null && !a.isPaused && !a.done);
    list.forEach((a) => a.pause());
    pausedBy.set(ctx, [...(pausedBy.get(ctx) ?? []), ...list]);
  } else {
    pausedBy.get(ctx)?.forEach((a) => a.resume());
    pausedBy.delete(ctx);
  }
}
const pausedBy = new Map<Context, Animation[]>();

const roots = new Set<Animation>();
let frame: number | null = null;
const clock = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
const raf: (fn: () => void) => number = typeof requestAnimationFrame === "function" ? (fn) => requestAnimationFrame(fn) : (fn) => setTimeout(fn, 16) as unknown as number;

function tick(): void {
  frame = null;
  const now = clock();
  for (const a of [...roots]) {
    if (a.isPaused) continue;
    a.renderTime(now - a.startTime);
    if (a.done) {
      roots.delete(a);
      if (a.context) byContext.get(a.context)?.delete(a);
    }
  }
  if (roots.size > 0) frame = raf(tick);
}

function schedule(a: Animation): void {
  roots.add(a);
  if (frame === null) frame = raf(tick);
}

/** The number of tweens and timelines running (for tests). */
export function activeCount(): number {
  return roots.size;
}

/** Forgets every animation and the pending frame (for tests, whose fake clock is new in every test). */
export function resetTweens(): void {
  for (const a of [...roots]) a.kill();
  byContext.clear();
  pausedBy.clear();
  frame = null;
}

/** Renders every running animation now (for tests: with fake timers there is no animation frame). */
export function tickNow(): void {
  tick();
}

abstract class Animation {
  /** Root animations: the clock time it starts (delay included). In a timeline: unused. */
  startTime = 0;
  parent: Timeline | null = null;
  killed = false;
  done = false;
  isPaused = false;
  private pausedAt = 0;
  readonly context: Context | null = currentContext;
  protected last = -1;

  constructor() {
    if (this.context) {
      let set = byContext.get(this.context);
      if (!set) byContext.set(this.context, (set = new Set()));
      set.add(this);
    }
  }

  abstract totalDuration(): number;
  /** Renders the animation at local time `t` (seconds since it started; may be negative before its delay). */
  abstract renderTime(t: number): void;
  /** Rendered back at time 0 when a timeline repeats. */
  abstract rewind(): void;

  protected start(delay: number, paused: boolean): void {
    this.startTime = clock() + delay;
    if (paused) this.pause();
    schedule(this);
  }

  kill(): this {
    this.killed = true;
    this.done = true;
    roots.delete(this);
    this.parent?.remove(this);
    if (this.context) byContext.get(this.context)?.delete(this);
    return this;
  }

  pause(): this {
    if (!this.isPaused) {
      this.isPaused = true;
      this.pausedAt = clock();
    }
    return this;
  }

  resume(): this {
    if (this.isPaused) {
      this.isPaused = false;
      this.startTime += clock() - this.pausedAt;
      if (!this.done && this.parent === null) schedule(this);
    }
    return this;
  }

  play(): this {
    return this.resume();
  }

  /** How far it is (0..1), or jumps there. */
  progress(): number;
  progress(value: number): this;
  progress(value?: number): number | this {
    const total = this.totalDuration();
    if (value === undefined) return total === Infinity ? 0 : total <= 0 ? (this.last >= 0 ? 1 : 0) : Math.max(0, Math.min(1, this.last / total));
    const t = total === Infinity ? 0 : value * total;
    this.startTime = clock() - t;
    this.renderTime(t);
    return this;
  }

  isActive(): boolean {
    return !this.done && !this.killed && !this.isPaused && this.last >= 0;
  }

  /** Calls a callback in this animation's context (tweens it makes belong to the same scene). */
  protected callback(fn: ((...args: any[]) => void) | undefined, self: unknown, args: readonly unknown[] = []): void {
    if (fn && !this.killed) withContext(this.context, () => fn.apply(self, args as unknown[]));
  }
}

interface Track {
  target: any;
  offset: number;
  props: { key: string; at: Lerp | null; to: unknown; from: unknown; hasFrom: boolean }[];
  started: boolean;
}

/** One tween: some properties of some targets, possibly staggered, repeated and yoyoing. */
export class Tween extends Animation {
  readonly vars: TweenVars;
  private readonly tracks: Track[];
  private readonly duration: number;
  private readonly easeFn: Ease;
  private readonly repeat: number;
  private readonly cycle: number;
  private startedCb = false;

  /** `fromVars`: the start values (fromTo, from); null: the targets' values when the tween starts. */
  constructor(targets: unknown, vars: TweenVars, fromVars: TweenVars | null, mode: "to" | "from" | "fromTo" | "set") {
    super();
    this.vars = vars;
    const list = toArray(targets);
    const stagger = vars.stagger ?? 0;
    this.duration = mode === "set" ? 0 : Math.max(0, vars.duration ?? 0.5);
    this.easeFn = ease(vars.ease);
    this.repeat = vars.repeat ?? 0;
    this.cycle = this.duration + (vars.repeatDelay ?? 0);
    const keys = Object.keys(mode === "from" ? (fromVars ?? {}) : vars).filter((k) => !reserved.has(k));
    this.tracks = list.map((target, i) => ({
      target,
      offset: i * stagger,
      started: false,
      props: keys.map((key) => ({
        key,
        at: null,
        to: mode === "from" ? undefined : vars[key],
        from: mode === "from" ? fromVars![key] : fromVars?.[key],
        hasFrom: fromVars !== null && key in fromVars,
      })),
    }));
    if (vars.transformOrigin !== undefined)
      for (const tr of this.tracks)
        if (isElement(tr.target)) {
          styleOf(tr.target).transformOrigin = vars.transformOrigin;
          if (tr.target instanceof SVGElement) styleOf(tr.target).transformBox = "fill-box";
        }
    const immediate = vars.immediateRender ?? (mode === "from" || mode === "fromTo" || mode === "set");
    if (mode === "from") for (const tr of this.tracks) for (const p of tr.props) p.to = read(tr.target, p.key);
    if (immediate) for (const tr of this.tracks) this.init(tr, mode !== "set");
    if (mode === "set" && immediate) {
      this.renderTime(0);
      this.done = true;
    }
  }

  /** Root tweens start ticking; tweens of a timeline are rendered by it. */
  begin(): this {
    if (!this.done) this.start(this.vars.delay ?? 0, this.vars.paused ?? false);
    return this;
  }

  targets(): any[] {
    return this.tracks.map((t) => t.target);
  }

  private oneDuration(): number {
    return this.repeat < 0 ? Infinity : this.duration * (this.repeat + 1) + (this.vars.repeatDelay ?? 0) * this.repeat;
  }

  totalDuration(): number {
    const n = this.tracks.length;
    return this.oneDuration() + (n > 1 ? this.tracks[n - 1]!.offset : 0);
  }

  /** Records where each property starts (and shows the start when `show`). */
  private init(tr: Track, show: boolean): void {
    if (tr.started) return;
    tr.started = true;
    for (const p of tr.props) {
      const from = p.hasFrom || p.from !== undefined ? p.from : read(tr.target, p.key);
      p.from = from;
      p.at = lerp(from, p.to);
      if (show) write(tr.target, p.key, p.at(0));
    }
  }

  /** The eased progress of one target at local time t. */
  private at(t: number): number {
    if (this.duration <= 0) return t >= 0 ? 1 : 0;
    const total = this.oneDuration();
    if (t >= total) {
      const it = this.repeat < 0 ? 0 : this.repeat;
      return this.vars.yoyo && it % 2 === 1 ? 0 : 1;
    }
    const iteration = Math.floor(t / this.cycle);
    const inCycle = Math.min(this.duration, t - iteration * this.cycle);
    let p = inCycle / this.duration;
    if (this.vars.yoyo && iteration % 2 === 1) p = 1 - p;
    return this.easeFn(p);
  }

  renderTime(t: number): void {
    if (this.killed) return;
    const total = this.totalDuration();
    if (t < 0 && this.last < 0) return;
    if (!this.startedCb && t >= 0) {
      this.startedCb = true;
      this.callback(this.vars.onStart, this);
    }
    for (const tr of this.tracks) {
      const lt = t - tr.offset;
      if (lt < 0 && !tr.started) continue;
      this.init(tr, false);
      const p = this.at(Math.max(0, lt));
      for (const prop of tr.props) write(tr.target, prop.key, prop.at!(p));
    }
    this.last = t;
    if (t >= 0) this.callback(this.vars.onUpdate, this);
    if (t >= total && !this.done) {
      this.done = true;
      if (this.vars.clearProps !== undefined) for (const tr of this.tracks) clearProps(tr.target, this.vars.clearProps);
      this.callback(this.vars.onComplete, this);
    }
  }

  rewind(): void {
    if (this.killed) return;
    this.done = false;
    this.startedCb = false;
    for (const tr of this.tracks) if (tr.started) for (const prop of tr.props) write(tr.target, prop.key, prop.at!(0));
    this.last = -1;
  }

  /** Stops animating these targets (all of them: the tween ends when none is left). */
  killTargets(targets: Set<unknown>): void {
    for (let i = this.tracks.length - 1; i >= 0; i--) if (targets.has(this.tracks[i]!.target)) this.tracks.splice(i, 1);
    if (this.tracks.length === 0) this.kill();
  }

  hasTarget(targets: Set<unknown>): boolean {
    return this.tracks.some((t) => targets.has(t.target));
  }
}

function clearProps(target: unknown, props: string): void {
  if (!isElement(target)) return;
  const style = styleOf(target);
  for (const p of props.split(",").map((s) => s.trim())) {
    if (p === "transform" || p === "all") {
      transforms.delete(target);
      style.removeProperty("transform");
    }
    if (p === "all") style.cssText = "";
    else if (p !== "transform") style.removeProperty(cssName(p));
  }
}

/** A function called at a moment of a timeline. */
class Call extends Animation {
  constructor(
    private readonly fn: (...args: any[]) => void,
    private readonly args: readonly unknown[],
  ) {
    super();
  }
  totalDuration(): number {
    return 0;
  }
  renderTime(t: number): void {
    if (t >= 0 && !this.done) {
      this.done = true;
      this.last = t;
      this.callback(this.fn, null, this.args);
    }
  }
  rewind(): void {
    this.done = false;
    this.last = -1;
  }
}

/** Tweens and calls placed at times; repeat -1 loops for ever. */
export class Timeline extends Animation {
  private children: { anim: Animation; at: number }[] = [];
  private readonly repeat: number;
  private iter = 0;

  constructor(private readonly tvars: TimelineVars = {}) {
    super();
    this.repeat = tvars.repeat ?? 0;
    // Started on the next frame, as GSAP does, after the code that fills it.
    this.start(tvars.delay ?? 0, tvars.paused ?? false);
  }

  private get length(): number {
    return this.children.reduce((m, c) => Math.max(m, c.at + c.anim.totalDuration()), 0);
  }

  totalDuration(): number {
    return this.repeat < 0 ? Infinity : this.length * (this.repeat + 1);
  }

  private add(anim: Animation, position: number | undefined, delay = 0): this {
    anim.parent = this;
    roots.delete(anim);
    this.children.push({ anim, at: (position ?? this.length) + delay });
    this.children.sort((a, b) => a.at - b.at);
    return this;
  }

  remove(anim: Animation): void {
    this.children = this.children.filter((c) => c.anim !== anim);
  }

  to(targets: unknown, vars: TweenVars, position?: number): this {
    return this.add(new Tween(targets, { ...vars, immediateRender: vars.immediateRender ?? false }, null, "to"), position, vars.delay);
  }

  from(targets: unknown, vars: TweenVars, position?: number): this {
    return this.add(new Tween(targets, { ...vars }, vars, "from"), position, vars.delay);
  }

  fromTo(targets: unknown, fromVars: TweenVars, toVars: TweenVars, position?: number): this {
    return this.add(new Tween(targets, toVars, fromVars, "fromTo"), position, toVars.delay);
  }

  set(targets: unknown, vars: TweenVars, position?: number): this {
    return this.add(new Tween(targets, { ...vars, immediateRender: false }, null, "set"), position);
  }

  call(fn: (...args: any[]) => void, args: readonly unknown[] = [], position?: number): this {
    return this.add(new Call(fn, args), position);
  }

  iteration(): number {
    return this.iter;
  }

  /** Jumps to time `t` (calls on the way are skipped unless `suppressEvents` is false). */
  seek(t: number, suppressEvents = true): this {
    if (suppressEvents) for (const c of this.children) if (c.anim instanceof Call && c.at <= t) c.anim.done = true;
    this.startTime = clock() - t;
    this.renderTime(t);
    return this;
  }

  /** Renders the children whose time lies between `a` (exclusive) and `b`. */
  private span(a: number, b: number): void {
    for (const c of [...this.children]) {
      if (c.anim.killed) continue;
      const end = c.at + c.anim.totalDuration();
      if (b < c.at) continue;
      if (a >= end && c.anim.done) continue;
      c.anim.renderTime(Math.min(b, end) - c.at);
    }
  }

  rewind(): void {
    for (const c of [...this.children].reverse()) c.anim.rewind();
    this.last = -1;
  }

  renderTime(t: number): void {
    if (this.killed || t < 0) return;
    const len = this.length;
    if (len <= 0) {
      this.span(-1, 0);
      this.last = t;
      if (this.repeat >= 0) this.finish();
      return;
    }
    const iteration = this.repeat < 0 ? Math.floor(t / len) : Math.min(this.repeat, Math.floor(t / len));
    const local = Math.min(len, t - iteration * len);
    let prev = this.last < 0 ? -1e-9 : this.last - this.iter * len;
    while (this.iter < iteration) {
      this.span(prev, len);
      this.rewind();
      this.iter++;
      prev = -1e-9;
    }
    this.span(prev, local);
    this.last = t;
    if (this.repeat >= 0 && t >= this.totalDuration()) this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.callback(this.tvars.onComplete, this);
  }

  override kill(): this {
    for (const c of this.children) c.anim.killed = true;
    return super.kill();
  }

  killTargets(targets: Set<unknown>): void {
    for (const c of [...this.children]) if (c.anim instanceof Tween && c.anim.hasTarget(targets)) c.anim.killTargets(targets);
  }
}

function toArray(targets: unknown): unknown[] {
  if (targets === null || targets === undefined) return [];
  if (Array.isArray(targets)) return targets.flatMap(toArray);
  if (typeof NodeList !== "undefined" && targets instanceof NodeList) return [...targets];
  if (typeof HTMLCollection !== "undefined" && targets instanceof HTMLCollection) return [...targets];
  return [targets];
}

/** Every tween and timeline that is not finished (for killTweensOf). */
function live(): Animation[] {
  const all: Animation[] = [];
  for (const set of byContext.values()) all.push(...set);
  all.push(...roots);
  return [...new Set(all)];
}

const gsap = {
  to(targets: unknown, vars: TweenVars): Tween {
    return new Tween(targets, vars, null, "to").begin();
  },
  from(targets: unknown, vars: TweenVars): Tween {
    return new Tween(targets, vars, vars, "from").begin();
  },
  fromTo(targets: unknown, fromVars: TweenVars, toVars: TweenVars): Tween {
    return new Tween(targets, toVars, fromVars, "fromTo").begin();
  },
  set(targets: unknown, vars: TweenVars): Tween {
    return new Tween(targets, vars, null, "set");
  },
  timeline(vars?: TimelineVars): Timeline {
    return new Timeline(vars);
  },
  delayedCall(delay: number, fn: (...args: any[]) => void, args: readonly unknown[] = []): Tween {
    return new Tween({}, { duration: 0, delay, onComplete: () => fn(...args) }, null, "to").begin();
  },
  killTweensOf(targets: unknown): void {
    const set = new Set(toArray(targets));
    if (set.size === 0) return;
    for (const a of live()) {
      if (a instanceof Tween && a.hasTarget(set)) a.killTargets(set);
      else if (a instanceof Timeline) a.killTargets(set);
    }
  },
};

// The types the slides name: gsap.core.Tween, gsap.core.Timeline, gsap.TweenVars.
type TweenType = Tween;
type TimelineType = Timeline;
type TweenVarsType = TweenVars;
declare namespace gsap {
  namespace core {
    type Tween = TweenType;
    type Timeline = TimelineType;
  }
  type TweenVars = TweenVarsType;
}

export default gsap;
