import { useMemo, useRef, useState } from "react";

/** What a picture's bytes are: its type, how many frames it has and its width (from the file's header). */
export interface ImageInfo {
  /** "image/png", "image/gif", "image/webp", "image/jpeg". */
  mime: string;
  /** 1 for a still image, more for an animation, 0 when it cannot be read. */
  frames: number;
  /** The width in pixels, or 0 when the header does not say. */
  width: number;
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u16le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u24le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const u32le = (b: Uint8Array, at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;
const u32be = (b: Uint8Array, at: number) => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;

/** The frames of a GIF: one per image descriptor, walking the blocks. */
function gifFrames(b: Uint8Array): number {
  if (b.length < 13) return 0;
  let at = 13;
  const flags = b[10]!;
  if (flags & 0x80) at += 3 * (1 << ((flags & 7) + 1)); // the global colour table
  const skipSubBlocks = () => {
    while (at < b.length) {
      const size = b[at++]!;
      if (size === 0) return;
      at += size;
    }
  };
  let frames = 0;
  while (at < b.length) {
    const kind = b[at++]!;
    if (kind === 0x3b) break; // trailer
    if (kind === 0x21) {
      at++; // the extension's label
      skipSubBlocks();
    } else if (kind === 0x2c) {
      if (at + 9 > b.length) break;
      const local = b[at + 8]!;
      at += 9;
      if (local & 0x80) at += 3 * (1 << ((local & 7) + 1));
      at++; // LZW minimum code size
      skipSubBlocks();
      frames++;
    } else break;
  }
  return frames;
}

/** The frames of a WebP: its ANMF chunks when it is animated, else 1. */
function webpInfo(b: Uint8Array): { frames: number; width: number } {
  let frames = 0;
  let animated = false;
  let width = 0;
  let at = 12;
  while (at + 8 <= b.length) {
    const id = ascii(b, at, 4);
    const size = u32le(b, at + 4);
    const data = at + 8;
    if (id === "VP8X" && data + 10 <= b.length) {
      animated = (b[data]! & 0x02) !== 0;
      width = u24le(b, data + 4) + 1;
    } else if (id === "ANMF") frames++;
    else if (id === "VP8 " && data + 10 <= b.length && width === 0) width = u16le(b, data + 6) & 0x3fff;
    else if (id === "VP8L" && data + 5 <= b.length && width === 0) width = (u16le(b, data + 1) & 0x3fff) + 1;
    at = data + size + (size & 1);
  }
  return { frames: animated ? frames : 1, width };
}

/** The frames of a PNG: an APNG's acTL says how many, else 1. */
function pngInfo(b: Uint8Array): { frames: number; width: number } {
  const width = b.length >= 24 ? u32be(b, 16) : 0;
  let at = 8;
  while (at + 8 <= b.length) {
    const size = u32be(b, at);
    const id = ascii(b, at + 4, 4);
    if (id === "acTL" && at + 12 <= b.length) return { frames: u32be(b, at + 8), width };
    if (id === "IDAT") break;
    at += 12 + size;
  }
  return { frames: 1, width };
}

/** What the bytes of a picture are (C#'s AnimatedImage.Decode reads the frames with Skia; the browser decodes here). */
export function imageInfo(bytes: Uint8Array): ImageInfo {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return { mime: "image/png", ...pngInfo(b) };
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return { mime: "image/gif", frames: gifFrames(b), width: u16le(b, 6) };
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return { mime: "image/webp", ...webpInfo(b) };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", frames: 1, width: 0 };
  return { mime: "application/octet-stream", frames: 0, width: 0 };
}

/** The bytes as a data: URL (works in every renderer, also without URL.createObjectURL). */
export function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}

export interface AnimatedImageProps {
  /** The picture's bytes, or a URL the renderer can load. */
  source: Uint8Array | string;
  alt?: string;
  /** Tooltip on animations (a click pauses them). */
  hint?: string;
  /**
   * Makes the picture a button that shows it larger (a chapter's pictures): a click, Enter or Space calls it with the
   * picture's natural width (0 when unknown). Without it a click pauses an animation.
   */
  onEnlarge?: (naturalWidth: number) => void;
  /** Tooltip and accessible name of the enlarge button. */
  enlargeHint?: string;
  /** Fills its box, also beyond its natural size (the enlarged picture); otherwise never wider than its natural size. */
  fill?: boolean;
}

/**
 * A picture in a text: a still image (PNG, JPEG, WebP) or an animation (animated GIF or WebP), played in a loop by
 * the browser's own decoder. With `onEnlarge` a click shows it larger; otherwise (e.g. the enlarged picture) a click
 * pauses and resumes the animation (the frame on screen is drawn on a canvas while paused). The picture is never wider
 * than its natural size.
 *
 * Not yet as in C#: there, frames shown for a second or more are a slideshow and the next one fades in; here every
 * frame is simply shown for its time.
 */
export function AnimatedImage({ source, alt, hint, onEnlarge, enlargeHint, fill }: AnimatedImageProps) {
  const info = useMemo(() => (typeof source === "string" ? null : imageInfo(source)), [source]);
  const src = useMemo(() => (typeof source === "string" ? source : info && info.frames > 0 ? dataUrl(source, info.mime) : null), [source, info]);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  if (src === null || failed) return null;
  const animated = (info?.frames ?? 1) > 1;

  const toggle = () => {
    if (!animated) return;
    const c = canvas.current;
    const i = img.current;
    if (!paused && c && i) {
      c.width = i.naturalWidth;
      c.height = i.naturalHeight;
      try {
        c.getContext("2d")?.drawImage(i, 0, 0);
      } catch {
        // No canvas (tests): the picture just stays.
      }
    }
    setPaused(!paused);
  };

  if (onEnlarge) {
    const enlarge = () => onEnlarge(info?.width || img.current?.naturalWidth || 0);
    return (
      <div
        className="cs-picture zoomable"
        role="button"
        tabIndex={0}
        title={enlargeHint}
        aria-label={enlargeHint ? (alt ? `${alt} – ${enlargeHint}` : enlargeHint) : alt}
        onClick={enlarge}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          enlarge();
        }}
        data-frames={info?.frames}
        style={info?.width ? { maxWidth: `min(100%, ${info.width}px)` } : undefined}
      >
        <img ref={img} src={src} alt={alt ?? ""} draggable={false} onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div
      className={"cs-picture" + (animated ? " animated" : "") + (fill ? " fill" : "")}
      title={animated && hint ? hint : undefined}
      onPointerDown={animated ? (e) => e.button === 0 && toggle() : undefined}
      data-frames={info?.frames}
      style={info?.width && !fill ? { maxWidth: `min(100%, ${info.width}px)` } : undefined}
    >
      <img ref={img} src={src} alt={alt ?? ""} draggable={false} onError={() => setFailed(true)} style={paused ? { visibility: "hidden" } : undefined} />
      {animated && <canvas ref={canvas} hidden={!paused} aria-hidden="true" />}
    </div>
  );
}
