// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Overlay, OverlayHost } from "../src/index.js";
import { repoRoot } from "./repo.js";

afterEach(cleanup);

function open(): Overlay {
  const overlay = new Overlay();
  render(
    <OverlayHost overlay={overlay}>
      <div>content</div>
    </OverlayHost>,
  );
  // A dialog with nothing focusable in it, like the enlarged picture of an expected result.
  act(() => overlay.showDialog(<div style={{ width: 300, height: 200 }} />, () => overlay.closeDialog()));
  return overlay;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "dist") return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Every dialog can be closed: with Escape (also when nothing in it can take the focus) and with its ✕. */
describe("DialogCloseTests", () => {
  it("Escape stänger en dialog utan knappar", () => {
    const overlay = open();
    expect(overlay.dialogOpen).toBe(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(overlay.dialogOpen).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("✕ i hörnet stänger varje dialog", () => {
    const overlay = open();
    // The ✕ has the focus: the dialog has no buttons of its own.
    expect(document.activeElement?.classList.contains("dialog-close")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(overlay.dialogOpen).toBe(false);
  });

  it("ingen dialog öppnas med en stängning som inte gör något", () => {
    const ts = join(repoRoot(), "ts");
    const empty = ["packages", "apps"]
      .flatMap((d) => {
        try {
          return sourceFiles(join(ts, d));
        } catch {
          return [];
        }
      })
      .filter((f) => !f.includes(`${join("ui", "test")}`) && /showDialog\([^;]*\(\)\s*=>\s*\{\s*\}/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ts, f));
    expect(empty).toEqual([]);
  });
});
