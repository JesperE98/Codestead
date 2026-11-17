// Port of Shell/ShellLib.cs – static helpers for the shell: flattening multi-line code, node to text and sleep detection.

import type { Node } from "../Parser/Ast/Node.js";

export const Dim = "\x1b[2m";
export const Reset = "\x1b[0m";

// .NET \b is Unicode-aware: a word character is a letter or digit of any script.
const nb = String.raw`(?<![\p{L}\p{Mn}\p{Nd}\p{Pc}])`;
const joinerEndRe = new RegExp(String.raw`(${nb}do|${nb}then|${nb}else|\{|\||&&|\|\||${nb}in|;)$`, "u");
const joinerStartRe = /^(;|\))/;

/**
 * Turns multi-line code into one line for the history, like bash does:
 * "for i in 1 2\ndo echo $i\ndone" becomes "for i in 1 2; do echo $i; done".
 */
export function flattenLines(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length <= 1) return text;
  let acc = lines[0]!;
  for (const l of lines.slice(1)) {
    const joiner = joinerEndRe.test(acc) || joinerStartRe.test(l) ? " " : "; ";
    acc = acc + joiner + l;
  }
  return acc;
}

/** Approximate source code for a command (shown by jobs and ps). */
export function nodeToString(node: Node): string {
  switch (node.type) {
    case "simple":
      return [...node.words.map((w) => w.raw), ...node.redirects.map((r) => r.op + (r.target ? " " + r.target.raw : ""))].join(" ");
    case "pipeline":
      return (node.negate ? "! " : "") + node.commands.map(nodeToString).join(" | ");
    case "andor":
      return [nodeToString(node.first), ...node.rest.map((r) => `${r.op} ${nodeToString(r.node)}`)].join(" ");
    case "list":
      return node.items.map((i) => nodeToString(i.node) + (i.background ? " &" : "")).join("; ");
    case "funcdef":
      return `${node.name}()`;
    default:
      return node.type;
  }
}

const sleepRe = /^([0-9]+(?:\.[0-9]+)?)([smh]?)$/;

/** If the node is `sleep N`: the number of seconds, otherwise null. */
export function sleepSeconds(node: Node): number | null {
  // "nohup sleep 60 &" is a sleep in the background too.
  const skip = node.type === "simple" && node.words.length === 3 && node.words[0]!.raw === "nohup" ? 1 : 0;
  if (node.type !== "simple" || node.words.length !== 2 + skip || node.words[skip]!.raw !== "sleep") return null;
  const m = sleepRe.exec(node.words[1 + skip]!.raw);
  if (!m) return null;
  const n = Number(m[1]);
  return n * (m[2] === "m" ? 60 : m[2] === "h" ? 3600 : 1);
}
