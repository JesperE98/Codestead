// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Checkpoint, type CheckpointHandle, type CheckpointTexts, CheckpointView, FormatException, SandboxRun } from "../src/index.js";
import { FakeSandbox } from "./FakeSandbox.js";

afterEach(cleanup);

const texts: CheckpointTexts = {
  check: "Check",
  correct: "Correct",
  wrong: "Wrong",
  predictPrompt: "Predict",
  tryPrompt: "Try",
  done: "Done",
  answerPlaceholder: "Answer",
  question: "Question",
};

const sample = `# Title

\`\`\`quiz
Which command shows where you are?
- [ ] ls
- [x] pwd
---
\`pwd\` = print working directory.
\`\`\`

Some text.

\`\`\`predict
$ echo $((2 + 3))
5
\`\`\`

\`\`\`try
pwd
echo $PWD
\`\`\`

\`\`\`sh
ls
\`\`\``;

/** A checkpoint on screen, with its handle and how often it was solved. */
function view(kind: string, body: string, opts: { exam?: boolean; solved?: boolean; onCommandClicked?: (c: string) => void } = {}) {
  const ref = createRef<CheckpointHandle>();
  const counter = { solved: 0 };
  const r = render(
    <CheckpointView
      ref={ref}
      cp={Checkpoint.parse(kind, body, 0)}
      texts={texts}
      alreadySolved={opts.solved ?? false}
      sandbox={new FakeSandbox()}
      examMode={opts.exam ?? false}
      onCommandClicked={opts.onCommandClicked}
      onSolved={() => counter.solved++}
    />,
  );
  return { handle: () => ref.current!, counter, container: r.container, unmount: r.unmount };
}

describe("CheckpointTests", () => {
  it("kontrollpunkter tolkas i ordning: quiz, predict, try", () => {
    const cps = Checkpoint.parseAll(sample);
    expect(cps.map((c) => c.kind)).toEqual(["quiz", "predict", "try"]);
    expect(cps.map((c) => c.index)).toEqual([0, 1, 2]);

    const quiz = cps[0]!;
    expect(quiz.prompt).toBe("Which command shows where you are?");
    expect(quiz.options.length).toBe(2);
    expect(quiz.multipleAnswers).toBe(false);
    expect(quiz.explanation).toBe("`pwd` = print working directory.");
    expect(quiz.isCorrectChoice([1])).toBe(true);
    expect(quiz.isCorrectChoice([0])).toBe(false);
    expect(quiz.isCorrectChoice([0, 1])).toBe(false);

    const predict = cps[1]!;
    expect(predict.commands).toEqual(["echo $((2 + 3))"]);
    expect(predict.isCorrectPrediction(" 5 ")).toBe(true);
    expect(predict.isCorrectPrediction("6")).toBe(false);
    expect(predict.explanation).toBeNull();

    expect(cps[2]!.commands).toEqual(["pwd", "echo $PWD"]);
  });

  it("felaktiga kontrollpunkter ger FormatException", () => {
    expect(() => Checkpoint.parse("quiz", "Question?\n- [ ] a\n- [ ] b", 0)).toThrow(FormatException);
    expect(() => Checkpoint.parse("quiz", "Question?\n- [x] only one", 0)).toThrow(FormatException);
    expect(() => Checkpoint.parse("quiz", "- [x] a\n- [ ] b", 0)).toThrow(FormatException);
    expect(() => Checkpoint.parse("predict", "echo hi\nhi", 0)).toThrow(FormatException);
    expect(() => Checkpoint.parse("try", "\n---\nText", 0)).toThrow(FormatException);
  });

  it("flervalsfråga med flera rätt kräver exakt de rätta", () => {
    const cp = Checkpoint.parse("quiz", "Pick both\n- [x] a\n- [ ] b\n- [x] c", 0);
    expect(cp.multipleAnswers).toBe(true);
    expect(cp.isCorrectChoice([0, 2])).toBe(true);
    expect(cp.isCorrectChoice([0])).toBe(false);
  });

  it("quiz: fel svar låser inte upp, rätt svar gör det", () => {
    const v = view("quiz", "Which?\n- [ ] ls\n- [x] pwd");
    const options = screen.getAllByRole("radio");
    const check = screen.getByRole("button", { name: "Check" });

    fireEvent.click(options[0]!);
    fireEvent.click(check);
    expect(v.handle().isSolved).toBe(false);
    expect(v.counter.solved).toBe(0);

    fireEvent.click(options[1]!);
    fireEvent.click(check);
    expect(v.handle().isSolved).toBe(true);
    expect(v.counter.solved).toBe(1);
    for (const o of screen.getAllByRole("radio")) expect((o as HTMLInputElement).disabled).toBe(true);
  });

  it("predict: bara filnamnen utan katalogen ger en ledtråd", () => {
    const cp = Checkpoint.parse("predict", "$ ls documents/?r*\ndocuments/fruits.txt  documents/grades.csv", 0);
    expect(cp.isRightWithoutDirectories("fruits.txt grades.csv")).toBe(true);
    expect(cp.isRightWithoutDirectories("documents/fruits.txt  documents/grades.csv")).toBe(false); // right, not a near miss
    expect(cp.isRightWithoutDirectories("fruits.txt")).toBe(false);
    expect(Checkpoint.parse("predict", "$ ls /home/student/documents/*.txt\n/home/student/documents/fruits.txt", 0).isRightWithoutDirectories("fruits.txt")).toBe(true);
    expect(Checkpoint.parse("predict", "$ echo hej\nhej", 0).isRightWithoutDirectories("hej")).toBe(false);
  });

  it("efter två fel svar kan svaret visas, och frågan räknas som klar", () => {
    const v = view("predict", "$ ls documents/?r*\ndocuments/fruits.txt  documents/grades.csv");
    const box = screen.getByRole("textbox") as HTMLInputElement;
    const answer = (text: string) => {
      fireEvent.change(box, { target: { value: text } });
      fireEvent.keyDown(box, { key: "Enter" });
    };
    const show = () => screen.queryByRole("button", { name: "Show the answer" });
    expect(show()).toBeNull();
    answer("fruits.txt grades.csv");
    expect(screen.getByText(/^✗ Almost/)).toBeTruthy();
    expect(show()).toBeNull();
    answer("no idea");
    expect(show()).not.toBeNull();
    expect(v.handle().isSolved).toBe(false);
    fireEvent.click(show()!);
    expect(v.handle().isSolved).toBe(true);
    expect(v.counter.solved).toBe(1);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("documents/fruits.txt  documents/grades.csv");
    expect(show()).toBeNull();
  });

  it("predict: svaret jämförs med förväntad utskrift", () => {
    const v = view("predict", "$ echo hej\nhej");
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "hej då" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(v.handle().isSolved).toBe(false);
    fireEvent.change(box, { target: { value: "hej" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(v.handle().isSolved).toBe(true);
  });

  it("inga miniterminaler: varken predict eller try har en egen terminal", () => {
    for (const [kind, body] of [
      ["predict", "$ echo $((2 + 3))\n5"],
      ["try", "pwd"],
    ] as const) {
      const v = view(kind, body);
      const buttons = [...v.container.querySelectorAll("button")];
      expect(buttons.some((b) => b.textContent?.includes("terminal"))).toBe(false);
      if (kind === "try") expect(v.container.querySelectorAll("input, textarea").length).toBe(0);
      v.unmount();
    }
  });

  it("try: rätt kommando – eller ett med samma utskrift – i verktygets terminal löser den", () => {
    for (const typed of ["pwd", "echo $PWD"]) {
      const v = view("try", "pwd");
      const ran = (run: SandboxRun) => act(() => v.handle().commandRan(run));
      ran(new SandboxRun("ls", FakeSandbox.run("ls"), 0, true));
      expect(v.handle().isSolved).toBe(false);
      // Waiting for more input does not count.
      ran(new SandboxRun(typed, "", 0, false));
      expect(v.handle().isSolved).toBe(false);
      ran(new SandboxRun(typed, FakeSandbox.run(typed), 0, true));
      expect(v.handle().isSolved, typed).toBe(true);
      ran(new SandboxRun(typed, FakeSandbox.run(typed), 0, true));
      expect(v.counter.solved).toBe(1);
      v.unmount();
    }

    // Other kinds ignore the terminal.
    const predict = view("predict", "$ echo hej\nhej");
    act(() => predict.handle().commandRan(new SandboxRun("echo hej", "hej\n", 0, true)));
    expect(predict.handle().isSolved).toBe(false);
  });

  it("try: kommandot kan klickas in i terminalen", () => {
    let injected: string | null = null;
    view("try", "pwd", { onCommandClicked: (c) => (injected = c) });
    fireEvent.click(screen.getByRole("button", { name: "pwd" }));
    expect(injected).toBe("pwd");
  });

  it("try i prov: rättas först med Grade()", () => {
    const v = view("try", "pwd", { exam: true });
    act(() => v.handle().commandRan(new SandboxRun("pwd", "/home/elev\n", 0, true)));
    expect(v.handle().isSolved).toBe(false);
    act(() => void expect(v.handle().grade()).toBe(true));
    const other = view("try", "pwd", { exam: true });
    act(() => void expect(other.handle().grade()).toBe(false));
  });

  it("redan klarad kontrollpunkt visas som klar utan att Solved skickas", () => {
    const v = view("quiz", "Which?\n- [ ] ls\n- [x] pwd", { solved: true });
    expect(v.handle().isSolved).toBe(true);
    expect(v.counter.solved).toBe(0);
  });

  it("provläge: inget rättas förrän Grade() anropas", () => {
    const v = view("quiz", "Which?\n- [ ] ls\n- [x] pwd", { exam: true });
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    expect(v.handle().isSolved).toBe(false);
    act(() => void expect(v.handle().grade()).toBe(true));
    for (const o of screen.getAllByRole("radio")) expect((o as HTMLInputElement).disabled).toBe(true);

    const wrong = view("predict", "$ echo hej\nhej", { exam: true });
    act(() => void expect(wrong.handle().grade()).toBe(false));
  });
});
