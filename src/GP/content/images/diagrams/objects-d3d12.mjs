// The Direct3D 12 objects of the course's triangle program (Microsoft's D3D12HelloTriangle, LoadPipeline and
// LoadAssets): the debug layer and DXGI on the left, the device and what is made from it on the right. The same
// picture in three chapters: all of it (Direct3D 12, the overview), and with the objects of Creating a window or Hello
// Window highlighted. Language-free (type names).
import { C, PAD, W, arrow, box, svg, text } from "./style.mjs";

export const variants = [
  { out: "objects-d3d12.webp", lang: "en", highlight: null },
  { out: "objects-d3d12-setup.webp", lang: "en", highlight: ["ID3D12Debug", "DXGI", "IDXGIFactory4", "IDXGIAdapter1", "ID3D12Device", "ID3D12CommandQueue"] },
  {
    out: "objects-d3d12-window.webp",
    lang: "en",
    highlight: ["DXGI", "IDXGISwapChain3", "ID3D12DescriptorHeap", "ID3D12Resource", "ID3D12CommandAllocator", "ID3D12GraphicsCommandList", "ID3D12Fence", "ID3D12CommandQueue"],
  },
];

const BH = 32;
const rows = [58, 102, 146, 190];
export const height = rows[3] + BH + 14 + PAD;

export function draw(v) {
  const on = (name) => v.highlight === null || v.highlight.includes(name);
  const style = (name) => (v.highlight !== null && on(name) ? "accent" : "plain");
  const node = (x, y, name, w) => box(x, y, w, BH, { label: name, mono: true, size: 12, style: style(name), opacity: on(name) ? 1 : 0.35 });
  const container = (x, y, w, h, name, mono = true, titleY = 18) =>
    `<g opacity="${on(name) ? 1 : 0.45}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${v.highlight !== null && on(name) ? C.accentSoft : "#ffffff"}" fill-opacity="0.5" stroke="${v.highlight !== null && on(name) ? C.accent : C.line}" stroke-width="1.5"/>` +
    text(x + 12, y + titleY, name, { mono, weight: 700, size: 13 }) + "</g>";

  let s = "";
  // The debug layer; DXGI: the factory, the adapter it finds, the swap chain it makes.
  const lx = PAD, lw = 180;
  const lrows = [rows[1] - 10, rows[2] - 6, rows[3] - 2];
  s += node(lx + 10, PAD, "ID3D12Debug", lw - 20);
  s += container(lx, PAD + BH + 10, lw, height - 2 * PAD - BH - 10, "DXGI", false, 16);
  ["IDXGIFactory4", "IDXGIAdapter1", "IDXGISwapChain3"].forEach((name, r) => (s += node(lx + 10, lrows[r], name, lw - 20)));
  // The device and what comes from it.
  const dx = lx + lw + 20, dw = W - PAD - dx;
  const bw = (dw - 24 - 8) / 2;
  const col = (i) => dx + 12 + i * (bw + 8);
  s += container(dx, PAD, dw, height - 2 * PAD, "ID3D12Device");
  const grid = [
    ["ID3D12CommandQueue", "ID3D12Fence"],
    ["ID3D12CommandAllocator", "ID3D12GraphicsCommandList"],
    ["ID3D12DescriptorHeap", "ID3D12Resource"],
    ["ID3D12RootSignature", "ID3D12PipelineState"],
  ];
  grid.forEach((row, r) => row.forEach((name, c) => (s += node(col(c), rows[r], name, bw))));
  const mid = (r) => rows[r] + BH / 2;
  const link = (x1, y1, x2, y2, names) => arrow(x1, y1, x2, y2, { color: C.line, width: 1.5, opacity: names.every(on) ? 1 : 0.35 });
  s += link(lx + lw / 2, lrows[0] + BH, lx + lw / 2, lrows[1] - 1, ["IDXGIFactory4", "IDXGIAdapter1"]);
  s += link(lx + lw - 10, lrows[1] + BH / 2, dx - 2, lrows[1] + BH / 2, ["IDXGIAdapter1", "ID3D12Device"]);
  s += link(col(0) + bw, mid(1), col(1) - 1, mid(1), ["ID3D12CommandAllocator", "ID3D12GraphicsCommandList"]);
  s += link(col(0) + bw, mid(3), col(1) - 1, mid(3), ["ID3D12RootSignature", "ID3D12PipelineState"]);
  return svg(height, s);
}
