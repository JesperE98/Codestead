import type { Image } from "../Textures/Image.js";
import type { Framebuffer } from "./Framebuffer.js";

/**
 * The targets of the frame being rendered (render-target textures read them). C# keeps one per thread
 * ([ThreadStatic]); JavaScript renders on one thread, so a module variable holds the current one.
 */
export class RenderContext {
  private readonly images = new Map<string, Image>();

  constructor(readonly target: (id: string) => Framebuffer, readonly bottomUp: boolean, private readonly programSize: ((id: string) => [number, number]) | null = null) {}

  image(id: string, attachment: number, depth: boolean): Image {
    const key = `${id}\u0000${attachment}\u0000${depth}`;
    let image = this.images.get(key);
    if (image === undefined) {
      const fb = this.target(id);
      image = depth ? fb.depthImage(this.bottomUp) : fb.colorImage(this.bottomUp, attachment);
      // A target drawn at the preview's scale: the program still addresses its texels at its own size.
      const size = this.programSize?.(id) ?? null;
      if (size !== null && (size[0] !== image.width || size[1] !== image.height)) image = image.with({ programWidth: size[0], programHeight: size[1] });
      this.images.set(key, image);
    }
    return image;
  }

  /** A target was drawn into, cleared or copied to (between draws): its images are made again. */
  changed(id: string | null): void {
    if (id === null) return;
    // A layered target's layers ("id@1" … "id@5") change with it.
    for (const key of [...this.images.keys()]) {
      const target = key.slice(0, key.indexOf("\u0000"));
      if (target === id || target.startsWith(id + "@")) this.images.delete(key);
    }
  }
}

let current: RenderContext | null = null;

export function currentContext(): RenderContext | null {
  return current;
}

export function setCurrentContext(context: RenderContext | null): void {
  current = context;
}
