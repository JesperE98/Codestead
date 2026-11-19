// The main process's side of the course worker (electron/worker.ts): starts it when it is first needed, sends it
// requests and hands back the answers. Two workers, as C# runs the checks and the pictures on background threads of
// their own: one for "Check my code" and saving files, one for the expected-result pictures – so a picture never waits
// for a check. A running check is stopped by ending its worker (a new one starts with the next request).

import * as path from "node:path";
import { Worker } from "node:worker_threads";
import type { CourseOp } from "./CourseService.js";
import type { WorkerRequest, WorkerResponse } from "./worker.js";

interface Pending {
  op: CourseOp;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class CourseWorker {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly file: string) {}

  /** Runs an operation of CourseService in the worker. */
  request(op: CourseOp, args: unknown[]): Promise<unknown> {
    const worker = this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { op, resolve, reject });
      worker.postMessage({ id, op, args } satisfies WorkerRequest);
    });
  }

  /** Ends the worker if it is running an operation of these (their promises reject); true when it did. */
  stopIfRunning(ops: readonly CourseOp[]): boolean {
    if (this.worker === null || ![...this.pending.values()].some((p) => ops.includes(p.op))) return false;
    this.stop(new Error("Cancelled."));
    return true;
  }

  /** Ends the worker; what it was doing rejects. */
  stop(why = new Error("The course worker was stopped.")): void {
    const w = this.worker;
    this.worker = null;
    if (w !== null) void w.terminate();
    this.failAll(why);
  }

  private start(): Worker {
    if (this.worker !== null) return this.worker;
    const w = new Worker(this.file);
    w.on("message", (r: WorkerResponse) => {
      const p = this.pending.get(r.id);
      if (p === undefined) return;
      this.pending.delete(r.id);
      if (r.ok) p.resolve(r.value);
      else p.reject(new Error(r.error));
    });
    w.on("error", (e: Error) => {
      if (this.worker !== w) return;
      this.worker = null;
      this.failAll(e);
    });
    w.on("exit", (code) => {
      if (this.worker !== w) return;
      this.worker = null;
      this.failAll(new Error(`The course worker ended (${code}).`));
    });
    w.unref();
    return (this.worker = w);
  }

  private failAll(e: Error): void {
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) p.reject(e);
  }
}

/** The app's two workers and which operation goes where. */
export class CourseWorkers {
  private readonly checks: CourseWorker;
  private readonly pictures: CourseWorker;

  constructor(directory: string) {
    const file = path.join(directory, "worker.cjs");
    this.checks = new CourseWorker(file);
    this.pictures = new CourseWorker(file);
  }

  request(op: CourseOp, args: unknown[]): Promise<unknown> {
    return (op === "draw" || op === "smokeBuilds" || op === "smokeAssets" ? this.pictures : this.checks).request(op, args);
  }

  /** Stops a running check (C#: checkCancel.Cancel()). */
  cancelCheck(): void {
    this.checks.stopIfRunning(["check"]);
  }

  stop(): void {
    this.checks.stop();
    this.pictures.stop();
  }
}
