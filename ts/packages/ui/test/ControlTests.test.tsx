// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownView } from "../src/index.js";

afterEach(cleanup);

describe("ControlTests", () => {
  // DeadKeys works around Avalonia's X11 input method (dead tilde + space came out as a space). Chromium (Electron)
  // combines dead keys itself, so there is nothing to port.
  it.todo("död tilde + mellanslag blir ~, andra döda tangenter lämnas i fred (DeadKeys: bara Avalonia/X11, behövs inte i Electron)");

  it("markdown blir rubriker, stycken, listor, tabeller och klickbara kommandon", () => {
    let clicked: string | null = null;
    const { container } = render(
      <MarkdownView
        onCommandClicked={(c) => (clicked = c)}
        markdown={`# Rubrik

Ett stycke med \`kod\`, **fet** och *kursiv* text och en [länk](https://example.com).

- punkt ett
- punkt två

| Kommando | Gör |
|---|---|
| \`ls\` | listar |

\`\`\`sh
ls -l
cd ~
\`\`\`

> **Tips:** ett citat.

<div class="distro-block" data-family="debian" data-label="Debian-familjen">

Bara för Debian.

</div>`}
      />,
    );
    expect(container.querySelector("h1")?.textContent).toBe("Rubrik");
    expect(container.querySelector("code")?.textContent).toBe("kod");
    expect(container.querySelector("strong")?.textContent).toBe("fet");
    expect(container.querySelector("em")?.textContent).toBe("kursiv");
    expect(container.querySelectorAll(".cs-md-item").length).toBe(2);
    expect(container.querySelector("td")?.textContent).toBe("ls");
    expect(container.querySelector(".cs-md-quote")?.textContent).toBe("Tips: ett citat.");
    expect(container.querySelector(".cs-md-distro-badge")?.textContent).toBe("Debian-familjen");
    expect(container.querySelector(".cs-md-distro")?.textContent).toContain("Bara för Debian.");
    const buttons = [...container.querySelectorAll("button.cmd")];
    expect(buttons.length).toBe(2);
    fireEvent.click(buttons[0]!);
    expect(clicked).toBe("ls -l");
  });

  it("entiteter avkodas, rå HTML visas inte, och kod står som den är", () => {
    const { container } = render(<MarkdownView markdown={"A &amp; B &copy; <b>fet</b> `a &amp; b`\n\n3. tre\n4. fyra"} />);
    const p = container.querySelector("p")!;
    expect(p.textContent).toBe("A & B © fet a &amp; b");
    expect(container.querySelector("b")).toBeNull();
    expect([...container.querySelectorAll(".cs-md-marker")].map((m) => m.textContent)).toEqual(["3.", "4."]);
  });
});
