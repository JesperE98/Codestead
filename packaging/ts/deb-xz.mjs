#!/usr/bin/env node
// Compresses the files of a .deb nfpm made without compression (packaging/ts/nfpm.yaml: deb.compression none) with xz
// (packaging/build-linux.sh). nfpm's own xz compresses Electron about 15 % worse than xz itself; dpkg reads
// data.tar.xz on every Debian and Ubuntu release Electron runs on (zstd only from dpkg 1.21.18).
//
// Usage: node packaging/ts/deb-xz.mjs <file.deb>   (replaced in place)
//
// A .deb is an ar archive: debian-binary, control.tar.*, data.tar.* in this order. Only data.tar becomes data.tar.xz;
// the other members and their headers stay as they are.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAGIC = "!<arch>\n";

/** The members of an ar archive: name, the 60-byte header and the data. */
export function readAr(b) {
  if (b.toString("latin1", 0, 8) !== MAGIC) throw new Error("not an ar archive");
  const members = [];
  for (let at = 8; at < b.length; ) {
    if (at + 60 > b.length) throw new Error("ar: a header runs past the end");
    const header = b.subarray(at, at + 60);
    if (header.toString("latin1", 58, 60) !== "`\n") throw new Error("ar: damaged header");
    const name = header.toString("latin1", 0, 16).trimEnd().replace(/\/$/, "");
    const size = Number(header.toString("latin1", 48, 58).trim());
    if (!Number.isSafeInteger(size) || at + 60 + size > b.length) throw new Error(`ar: bad size of ${name}`);
    members.push({ name, header, data: b.subarray(at + 60, at + 60 + size) });
    at += 60 + size + (size % 2);
  }
  return members;
}

/** An ar header like `header` (time, owner, mode) for another name and size. */
function headerFor(header, name, size) {
  const h = Buffer.from(header);
  h.write(name.padEnd(16, " "), 0, 16, "latin1");
  h.write(String(size).padEnd(10, " "), 48, 10, "latin1");
  return h;
}

export function writeAr(members) {
  const parts = [Buffer.from(MAGIC, "latin1")];
  for (const m of members) {
    parts.push(headerFor(m.header, m.name, m.data.length), m.data);
    if (m.data.length % 2 === 1) parts.push(Buffer.from("\n"));
  }
  return Buffer.concat(parts);
}

/** The .deb with its data.tar compressed by `compress` (data.tar → data.tar.xz). */
export function debWithXzData(deb, compress) {
  const members = readAr(deb);
  const names = members.map((m) => m.name);
  if (names.length !== 3 || names[0] !== "debian-binary" || !names[1].startsWith("control.tar") || names[2] !== "data.tar")
    throw new Error(`not a .deb with an uncompressed data.tar (members: ${names.join(", ")})`);
  const data = members[2];
  return writeAr([members[0], members[1], { name: "data.tar.xz", header: data.header, data: compress(data.data) }]);
}

/** xz -6 on all cores (as dpkg-deb -Zxz). */
function xz(data) {
  const dir = mkdtempSync(join(tmpdir(), "deb-xz-"));
  try {
    const file = join(dir, "data.tar");
    writeFileSync(file, data);
    const r = spawnSync("xz", ["-6", "-T0", "--keep", file], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`xz failed (${r.status ?? r.signal})`);
    return readFileSync(`${file}.xz`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: node packaging/ts/deb-xz.mjs <file.deb>");
  const before = readFileSync(file);
  const after = debWithXzData(before, xz);
  const tmp = join(dirname(file), `.${Date.now()}.deb`);
  writeFileSync(tmp, after);
  renameSync(tmp, file);
  console.log(`${file}: data.tar.xz (${before.length} → ${after.length} bytes)`);
}
