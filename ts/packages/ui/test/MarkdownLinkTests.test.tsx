// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinkOpener, MarkdownView } from "../src/index.js";

afterEach(cleanup);

/** A link in rendered markdown opens on a real mouse click: in a paragraph, a list, a table and bold text. */
describe("MarkdownLinkTests", () => {
  it.each([
    ["Ett stycke med en [länk](https://example.com/a) i.", "https://example.com/a"],
    ["- en punkt med [länk](https://example.com/b)", "https://example.com/b"],
    ["| A | B |\n|---|---|\n| [länk](https://example.com/c) | x |", "https://example.com/c"],
    ["**Fet** text ([länk](https://example.com/d)) efter.", "https://example.com/d"],
  ])("en länk i markdown öppnas när man klickar på den: %s", (markdown, url) => {
    let clicked: string | null = null;
    render(<MarkdownView markdown={markdown} onLinkClicked={(u) => (clicked = u)} />);
    const link = screen.getByTitle(url);
    fireEvent.click(link);
    expect(clicked).toBe(url);
  });

  it("en länk utan lyssnare öppnas av vyn själv (uppgifter, tips, frågor) utan att krascha", () => {
    const open = vi.spyOn(LinkOpener, "open").mockImplementation(() => {});
    try {
      render(<MarkdownView markdown="En [länk](https://example.com/e) i en uppgift." />);
      expect(() => fireEvent.click(screen.getByTitle("https://example.com/e"))).not.toThrow();
      expect(open).toHaveBeenCalledWith("https://example.com/e");
    } finally {
      open.mockRestore();
    }
    // Only web links are opened, and never by the page itself.
    const windowOpen = vi.fn();
    vi.stubGlobal("open", windowOpen);
    try {
      LinkOpener.open("javascript:alert(1)");
      LinkOpener.open("file:///etc/passwd");
      expect(windowOpen).not.toHaveBeenCalled();
      LinkOpener.open("https://example.com/f");
      expect(windowOpen).toHaveBeenCalledWith("https://example.com/f", "_blank", "noopener,noreferrer");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
