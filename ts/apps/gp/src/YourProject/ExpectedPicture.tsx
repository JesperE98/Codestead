// Port of YourProject/ExpectedPicture.cs.

import { UiParts } from "@codestead/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { DrawnData } from "../CourseHost.js";
import type { Tr } from "./Tr.js";

export const Width1 = 400;
export const Large = 720;

/** Draws a task's expected result at a width (the course worker). */
export type DrawFn = (chapter: string, api: string, task: number, width: number) => Promise<DrawnData>;

/** A drawn picture (an image URL), or the text key that says why there is none. */
interface Drawn {
  url: string | null;
  message: string;
}

/** The pictures drawn this session (C#: a static ConcurrentDictionary). */
const cache = new Map<string, Drawn>();

const key = (chapter: string, api: string, task: number, width: number) => `${api}/${chapter}/${task}@${width}`;

/**
 * A frame's BGRA pixels (top row first) as a BMP image in a data URL: 32 bits per pixel, top-down, opaque (C# makes a
 * WriteableBitmap with AlphaFormat.Opaque) – no canvas needed.
 */
export function bmpDataUrl(width: number, height: number, pixels: Uint8Array): string {
  const size = 54 + width * height * 4;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42; // "BM"
  bytes[1] = 0x4d;
  view.setUint32(2, size, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true); // negative: the top row first
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(34, width * height * 4, true);
  bytes.set(pixels.subarray(0, width * height * 4), 54);
  for (let i = 54 + 3; i < size; i += 4) bytes[i] = 255;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return "data:image/bmp;base64," + btoa(binary);
}

/** A task's picture at a width: from this session's pictures, else drawn by the course worker. */
async function render(draw: DrawFn, chapter: string, api: string, task: number, width: number): Promise<Drawn> {
  const k = key(chapter, api, task, width);
  const known = cache.get(k);
  if (known !== undefined) return known;
  let d: DrawnData;
  try {
    d = await draw(chapter, api, task, width);
  } catch {
    // The worker was stopped (the window is closing) or failed: no picture, and it may be drawn again later.
    return { url: null, message: "expected.none" };
  }
  const drawn: Drawn = { url: d.pixels === null ? null : bmpDataUrl(d.width, d.height, d.pixels), message: d.message };
  cache.set(k, drawn);
  return drawn;
}

export interface ExpectedPictureProps {
  chapter: string;
  api: string;
  task: number;
  caption: string;
  t: Tr;
  draw: DrawFn;
  /** The learner clicked the picture: show it larger (the panel to show). */
  onEnlarge: (panel: ReactNode) => void;
}

/**
 * What the current task's result should look like: the course's solution up to that task, drawn by the simulated GPU
 * in the background (a short wait first, so flicking through chapters draws nothing) and kept for the session.
 * Clicking it shows it larger.
 */
export function ExpectedPicture({ chapter, api, task, caption, t, draw, onEnlarge }: ExpectedPictureProps) {
  const wanted = key(chapter, api, task, Width1);
  const [shown, setShown] = useState<{ key: string; drawn: Drawn } | null>(null);
  // The latest draw function and whether the picture is still on screen, for the drawing that ends later.
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cache.has(wanted)) return;
    const timer = setTimeout(() => {
      void render(drawRef.current, chapter, api, task, Width1).then((drawn) => {
        if (mounted.current) setShown({ key: wanted, drawn });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [wanted, chapter, api, task]);

  const current = cache.get(wanted) ?? (shown?.key === wanted ? shown.drawn : null);

  const enlarge = async () => {
    if (chapter === "") return;
    const drawn = await render(draw, chapter, api, task, Large);
    if (drawn.url === null) return;
    onEnlarge(
      <div className="cs-stack" style={{ gap: 8 }}>
        {UiParts.text(caption, 15, 600)}
        <div style={{ borderRadius: 6, overflow: "hidden", lineHeight: 0 }}>
          <img src={drawn.url} alt={caption} style={{ width: "100%", maxWidth: Large }} />
        </div>
      </div>,
    );
  };

  return (
    <div className="cs-gp-expected" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
      {UiParts.text(caption, 14, 600)}
      <button type="button" className="cs-gp-expected-frame" title={t("expected.enlarge")} onClick={() => void enlarge()}>
        <div style={{ borderRadius: 6, overflow: "hidden", background: "black", minHeight: 120, display: "grid", lineHeight: 0 }}>
          {current?.url ? (
            <img src={current.url} alt={caption} style={{ width: "100%", maxWidth: Width1 }} />
          ) : (
            <div className="cs-gp-expected-note" style={{ color: "#9aa3b0", fontSize: 12.5, lineHeight: "18px", textAlign: "center", alignSelf: "center", margin: "24px 12px" }}>
              {current === null ? t("expected.drawing") : current.message === "" ? "" : t(current.message)}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
