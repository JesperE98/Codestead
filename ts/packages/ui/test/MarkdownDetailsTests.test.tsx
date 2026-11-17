// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownView } from "../src/index.js";

afterEach(cleanup);

/** Visible: in the document and not inside a hidden element. */
function visible(text: string): boolean {
  const el = screen.queryByText(text, { exact: false });
  return el !== null && el.closest("[hidden]") === null;
}

/** A folded block (<details data-summary="…">) hides its contents until its summary is clicked. */
describe("MarkdownDetailsTests", () => {
  it("ett hopfällt block visas först när man klickar på sammanfattningen", () => {
    render(<MarkdownView markdown={'Före.\n\n<details data-summary="Visa en färdig fil">\n\n```text\nhemlig rad\n```\n\n</details>\n\nEfter.'} />);
    expect(visible("Före.")).toBe(true);
    expect(visible("Efter.")).toBe(true);
    expect(visible("Visa en färdig fil")).toBe(true);
    expect(visible("hemlig rad")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Visa en färdig fil/ }));
    expect(visible("hemlig rad")).toBe(true);
  });
});
