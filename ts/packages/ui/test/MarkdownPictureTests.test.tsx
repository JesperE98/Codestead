// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { imageInfo, MarkdownView } from "../src/index.js";

afterEach(cleanup);

// 4×4 pictures: red, green, blue frames of 50 ms (made with Pillow).
const gif =
  "R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQABQAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBBQABACwAAAAABAAEAIEA/wAAAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBBQABACwAAAAABAAEAIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7";
const webp =
  "UklGRrQAAABXRUJQVlA4WAoAAAACAAAAAwAAAwAAQU5JTQYAAAAAAAAAAABBTk1GKAAAAAAAAAAAAAMAAAMAADIAAAJWUDhMDwAAAC8DwAAABxD9j/4HIqL/AQBBTk1GKAAAAAAAAAAAAAMAAAMAADIAAABWUDhMDwAAAC8DwAAAB9D/iP4HIqL/AQBBTk1GKAAAAAAAAAAAAAMAAAMAADIAAABWUDhMDwAAAC8DwAAABxDR//4HIqL/AQA=";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP8z4AATAxEcQAz0QEHOoQ+uAAAAABJRU5ErkJggg==";

const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** Pictures in a text: still images, animated GIF and WebP (every frame), and a missing picture left out. */
describe("MarkdownPictureTests", () => {
  it.each([
    ["images/a.png", png, 1, "image/png"],
    ["images/a.gif", gif, 3, "image/gif"],
    ["images/a.webp", webp, 3, "image/webp"],
  ])("en bild i texten visas med alla sina bildrutor: %s", (path, base64, frames, mime) => {
    expect(imageInfo(bytes(base64))).toEqual({ mime, frames, width: 4 });
    const { container, getByText } = render(
      <MarkdownView markdown={`Före.\n\n![En bild](${path} "Bildtext")\n\nEfter.`} imageSource={(p) => (p === path ? bytes(base64) : null)} />,
    );
    const pictures = container.querySelectorAll(".cs-picture");
    expect(pictures.length).toBe(1);
    expect(pictures[0]!.getAttribute("data-frames")).toBe(String(frames));
    expect(pictures[0]!.classList.contains("animated")).toBe(frames > 1);
    const img = pictures[0]!.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("En bild");
    expect(img.getAttribute("src")).toBe(`data:${mime};base64,${base64}`);
    expect(getByText("Bildtext")).toBeTruthy();
  });

  it("en bild som saknas lämnas bort, och texten runt den visas", () => {
    const { container, getByText } = render(<MarkdownView markdown={"Före.\n\n![En bild](images/saknas.png)\n\nEfter."} imageSource={() => null} />);
    expect(container.querySelectorAll(".cs-picture").length).toBe(0);
    expect(getByText("Före.")).toBeTruthy();
    expect(getByText("Efter.")).toBeTruthy();
    // Bytes that are no picture are left out too.
    const broken = render(<MarkdownView markdown={"![x](images/x.png)"} imageSource={() => new Uint8Array([1, 2, 3])} />);
    expect(broken.container.querySelectorAll(".cs-picture").length).toBe(0);
  });
  it("ett klick på en bild visar den större med sin bildtext; Enter också; animationen pausas först i den stora", () => {
    const shown: { view: ReactNode; width: number }[] = [];
    const { container } = render(
      <MarkdownView
        markdown={'![En animation](images/a.webp "Bildtext")'}
        imageSource={() => bytes(webp)}
        enlargeHint="Klicka för att förstora"
        onPictureEnlarge={(view, width) => shown.push({ view, width })}
      />,
    );
    const picture = container.querySelector<HTMLElement>(".cs-picture")!;
    expect(picture.classList.contains("zoomable")).toBe(true);
    expect(picture.getAttribute("role")).toBe("button");
    expect(picture.getAttribute("title")).toBe("Klicka för att förstora");
    fireEvent.click(picture);
    fireEvent.keyDown(picture, { key: "Enter" });
    expect(shown.map((s) => s.width)).toEqual([4, 4]);
    // The enlarged view: the same picture (an animation that a click pauses) and its caption.
    const large = render(<>{shown[0]!.view}</>).container;
    const big = large.querySelector(".cs-picture-large .cs-picture")!;
    expect(big.classList.contains("animated")).toBe(true);
    expect(big.classList.contains("zoomable")).toBe(false);
    expect(large.querySelector(".cs-md-caption")!.textContent).toBe("Bildtext");
    // Without a place to show it larger, a picture is not a button.
    const plain = render(<MarkdownView markdown={"![x](images/a.png)"} imageSource={() => bytes(png)} />).container;
    expect(plain.querySelector(".cs-picture")!.classList.contains("zoomable")).toBe(false);
  });
});
