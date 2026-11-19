// A tool for the course writers, not a test: it runs only when CODESTEAD_RENDER_PICTURES names a folder, and is
// skipped otherwise. src/GP/content/images/diagrams/make.mjs starts it; see "Bilder i kapitlen" in docs/DEVELOPMENT.md.
// Renders the simulator pictures that the chapters' diagrams show: the folder's requests.json lists them, each a
// course project (a chapter's start, a step, the solution or an exercise) with some extra changes, drawn by the
// simulated GPU at some widths and times. Every request becomes <folder>/<key>/<n>.png (n = the index of its time).
//   CODESTEAD_RENDER_PICTURES=<folder> npx vitest run packages/gp-gpu/test/RenderPictures.test.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, it } from "vitest";
import { type GpuProject, NoteLevel, Rasterizer, Simulator } from "../src/index.js";
import { applyEdit, exerciseProject, solutionProject, startProject, tasks } from "./CourseProjects.js";

const output = process.env["CODESTEAD_RENDER_PICTURES"] ?? "";

interface RenderRequest {
  /** The folder the frames go to (make.mjs names it after the request and a hash of it). */
  key: string;
  api: string;
  chapter: string;
  /** "solution" (the default), "start", "task:<id>" (the start with the steps up to and including it), "exercise:<id>". */
  from?: string;
  /** Changes to that project, applied in order; each find text must be there. */
  edits?: { file: string; find: string; replace: string }[];
  width: number;
  /** The times (in seconds since the program started) to draw; one frame when left out (time 1.0). */
  times?: number[];
}

function project(r: RenderRequest): GpuProject {
  const from = r.from ?? "solution";
  if (from === "solution") return solutionProject(r.api, r.chapter);
  if (from.startsWith("exercise:")) return exerciseProject(r.api, r.chapter, from.slice("exercise:".length));
  const p = startProject(r.api, r.chapter);
  if (from === "start") return p;
  if (!from.startsWith("task:")) throw new Error(`${r.key}: unknown from "${from}"`);
  const id = from.slice("task:".length);
  const list = tasks(r.api, r.chapter);
  const last = list.findIndex((t) => t.id === id);
  if (last < 0) throw new Error(`${r.key}: no task ${id} in ${r.api}/${r.chapter}`);
  for (const t of list.slice(0, last + 1)) for (const e of t.edits) applyEdit(p, e);
  return p;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** An RGB PNG of a frame (the rasterizer's pixels are BGRA). */
function png(width: number, height: number, bgra: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      raw[row + 1 + x * 3] = bgra[p + 2]!;
      raw[row + 2 + x * 3] = bgra[p + 1]!;
      raw[row + 3 + x * 3] = bgra[p]!;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array(0))]);
}

describe.skipIf(output === "")("RenderPictures", () => {
  it("renders the requested simulator pictures", () => {
    const requests = JSON.parse(readFileSync(join(output, "requests.json"), "utf8")) as RenderRequest[];
    for (const r of requests) {
      const dir = join(output, r.key);
      const times = r.times ?? [1.0];
      if (existsSync(join(dir, `${times.length - 1}.png`))) continue;
      const p = project(r);
      for (const e of r.edits ?? []) if (!applyEdit(p, e)) throw new Error(`${r.key}: "${e.find}" is not in ${e.file}`);
      const build = Simulator.build(p, r.api);
      const scene = build.scene;
      if (scene === null || !scene.showsFrames)
        throw new Error(`${r.key}: the program draws nothing (${build.diagnostics.map((d) => d.toString()).join("; ")})`);
      // The simulator's warnings (an unbound texture, a missing clear …) usually mean the changes broke something.
      for (const n of scene.notes) if (n.level !== NoteLevel.Info) console.warn(`${r.key}: ${n.key} ${[...n.args.values()].join(", ")}`);
      mkdirSync(dir, { recursive: true });
      times.forEach((t, i) => {
        const frame = Rasterizer.render(scene, r.width, t);
        writeFileSync(join(dir, `${i}.png`), png(frame.width, frame.height, frame.pixels));
      });
      console.log(`${r.key}: ${times.length} frame(s)`);
    }
  }, 24 * 3600 * 1000);
});
