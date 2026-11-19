// @vitest-environment jsdom
// The tween engine that stands in for GSAP (engine/tween.ts), on a fake clock.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gsap, { activeCount, ease, killContext, pauseContext, resetTweens, withContext } from "../engine/tween.js";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["performance", "requestAnimationFrame", "setTimeout", "Date"] });
  resetTweens();
});
afterEach(() => vi.useRealTimers());

/** Lets `seconds` pass, frame by frame. */
function run(seconds: number): void {
  for (let t = 0; t < seconds * 1000; t += 16) vi.advanceTimersByTime(16);
}

describe("Tween", () => {
  it("eases som GSAP:s", () => {
    for (const name of ["none", "power1.out", "power2.inOut", "power3.in", "back.out(1.6)", "sine.inOut"]) {
      expect(ease(name)(0), name).toBeCloseTo(0, 6);
      expect(ease(name)(1), name).toBeCloseTo(1, 6);
    }
    expect(ease("power2.in")(0.5)).toBeCloseTo(0.125, 6);
    expect(ease("power2.out")(0.5)).toBeCloseTo(0.875, 6);
    expect(ease("back.out(2)")(0.6)).toBeGreaterThan(1); // overshoots
  });

  it("to, fromTo, from och set på vanliga objekt, med delay och onComplete", () => {
    const o = { a: 0, b: 10, c: 5 };
    const done = vi.fn();
    const tw = gsap.to(o, { a: 1, duration: 1, ease: "none", onComplete: done });
    run(0.5);
    expect(o.a).toBeGreaterThan(0.4);
    expect(o.a).toBeLessThan(0.6);
    expect(tw.progress()).toBeGreaterThan(0.4);
    run(0.6);
    expect(o.a).toBe(1);
    expect(done).toHaveBeenCalledTimes(1);

    gsap.fromTo(o, { b: 0 }, { b: 2, duration: 1, delay: 1, ease: "none" });
    expect(o.b).toBe(0); // the start is shown at once
    run(1.5);
    expect(o.b).toBeCloseTo(1, 1);
    gsap.from(o, { c: 0, duration: 1 });
    expect(o.c).toBe(0);
    run(1.1);
    expect(o.c).toBe(5);
    gsap.set(o, { a: 7 });
    expect(o.a).toBe(7);
  });

  it("DOM: x, y och scale som transform, opacity och enheter som stil, stagger och clearProps", () => {
    const els = [document.createElement("div"), document.createElement("div")];
    gsap.fromTo(els, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.5, clearProps: "transform" });
    expect(els[0]!.style.opacity).toBe("0");
    expect(els[1]!.style.transform).toContain("translate(0px, 12px)");
    run(0.6);
    expect(els[0]!.style.opacity).toBe("1");
    expect(Number(els[1]!.style.opacity)).toBeLessThan(1);
    run(0.6);
    expect(els[1]!.style.opacity).toBe("1");
    expect(els[1]!.style.transform).toBe("");
    const bar = document.createElement("div");
    gsap.fromTo(bar, { height: "24%" }, { height: "95%", duration: 0.2, yoyo: true, repeat: 1, repeatDelay: 0.5 });
    run(0.3);
    expect(bar.style.height).toBe("95%");
    run(1);
    expect(bar.style.height).toBe("24%");
  });

  it("timeline: tider, call, set, repeat -1 med iteration(), pause och seek", () => {
    const o = { v: 0 };
    const calls: number[] = [];
    const tl = gsap.timeline({ repeat: -1 });
    tl.call(() => calls.push(tl.iteration()), [], 0);
    tl.fromTo(o, { v: 0 }, { v: 1, duration: 1, ease: "none", immediateRender: false }, 0.5);
    tl.set({}, {}, 2);
    run(1);
    expect(o.v).toBeCloseTo(0.5, 1);
    run(1.2);
    expect(calls).toEqual([0, 1]);
    expect(o.v).toBe(0); // the loop started over
    tl.pause();
    const v = o.v;
    run(1);
    expect(o.v).toBe(v);
    tl.resume();
    tl.seek(1.25);
    expect(o.v).toBeCloseTo(0.75, 2);
    tl.kill();
  });

  it("killTweensOf och delayedCall", () => {
    const o = { v: 0 };
    gsap.to(o, { v: 1, duration: 1 });
    gsap.killTweensOf(o);
    run(1.2);
    expect(o.v).toBe(0);
    const fn = vi.fn();
    gsap.delayedCall(0.5, fn, [3]);
    run(0.3);
    expect(fn).not.toHaveBeenCalled();
    run(0.3);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("en scens tweens (även de som dess callbacks startar) pausas och stoppas tillsammans", () => {
    const scene = {};
    const o = { a: 0, b: 0 };
    withContext(scene, () => {
      gsap.to(o, { a: 1, duration: 1, ease: "none", onComplete: () => void gsap.to(o, { b: 1, duration: 10 }) });
      gsap.timeline({ repeat: -1 }).set({}, {}, 1);
    });
    pauseContext(scene, true);
    run(0.5);
    expect(o.a).toBe(0);
    pauseContext(scene, false);
    run(1.2);
    expect(o.a).toBe(1);
    run(0.5);
    expect(o.b).toBeGreaterThan(0);
    killContext(scene);
    const b = o.b;
    run(1);
    expect(o.b).toBe(b);
    run(0.1);
    expect(activeCount()).toBe(0);
  });
});
