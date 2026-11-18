// The course worker: a Node worker thread of the main process that runs the course's work (CourseService) – "Check
// my code" and the expected results take seconds in the simulated GPU, so neither the window nor the main process
// (which answers the window's synchronous storage calls) waits for them. One request at a time, in order.

import { parentPort } from "node:worker_threads";
import { CourseService, type CourseOp } from "./CourseService.js";

/** A request from the main process. */
export interface WorkerRequest {
  id: number;
  op: CourseOp;
  args: unknown[];
}

/** The answer: the value, or the error's message. */
export type WorkerResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

const port = parentPort;
if (port === null) throw new Error("worker.cjs runs as a worker thread of the main process.");

port.on("message", (request: WorkerRequest) => {
  let response: WorkerResponse;
  try {
    const run = CourseService[request.op] as (...args: unknown[]) => unknown;
    if (typeof run !== "function") throw new Error(`No operation ${String(request.op)}.`);
    response = { id: request.id, ok: true, value: run(...request.args) };
  } catch (e) {
    response = { id: request.id, ok: false, error: e instanceof Error ? (e.stack ?? e.message) : String(e) };
  }
  // The pixels of a picture are handed over, not copied.
  const value = response.ok ? response.value : null;
  const pixels = typeof value === "object" && value !== null && (value as { pixels?: unknown }).pixels instanceof Uint8Array ? (value as { pixels: Uint8Array }).pixels : null;
  port.postMessage(response, pixels !== null && pixels.byteOffset === 0 && pixels.byteLength === pixels.buffer.byteLength ? [pixels.buffer as ArrayBuffer] : []);
});
