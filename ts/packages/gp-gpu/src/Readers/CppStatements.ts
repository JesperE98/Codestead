import { isWhiteSpace, trimNet } from "../internal/dotnet.js";
import { CppSource } from "./CppSource.js";
import { CppStatement } from "./CppStatement.js";

const Keyword = /^(if|while|for|switch|do|else|try|catch)\b/;
// try { … } is walked as its block; its catch blocks are skipped (a simulated program does not throw).

/** The end of a single statement (a body without braces): the ';' at depth 0, from `from`. */
function singleStatementEnd(code: string, from: number, end: number): number {
  let k = from;
  let depth = 0;
  while (k < end && !(code[k] === ";" && depth === 0)) {
    const c = code[k];
    if (c === "(" || c === "{") depth++;
    else if (c === ")" || c === "}") depth--;
    k++;
  }
  return k;
}

const isRenderLoop = (condition: string): boolean => condition.includes("WindowShouldClose") || condition.includes("WM_QUIT");

/**
 * Walks a function body statement by statement, in order. The render loop (a while loop whose condition asks
 * whether the window should close, or a message loop that runs until WM_QUIT) is marked. The body of an if runs
 * unless it is an error branch (it returns or throws); a for loop comes with its body (the reader runs it);
 * else branches, switch and other loops are skipped, but conditions are kept (if (!gladLoadGLLoader(…)) still
 * loads GLAD).
 */
export const CppStatements = {
  walk(src: CppSource, fn: string): CppStatement[] {
    const list: CppStatement[] = [];
    const range = src.functions.get(fn);
    if (range === undefined) return list;
    walk(src.code, range.start, range.end, list);
    return list;
  },
};

function walk(code: string, start: number, end: number, into: CppStatement[]): void {
  let i = start;
  while (i < end) {
    while (i < end && isWhiteSpace(code[i])) i++;
    if (i >= end) break;
    if (code[i] === ";") {
      i++;
      continue;
    }
    if (code[i] === "{") {
      const close = CppSource.matchBracket(code, i);
      if (close < 0) return;
      walk(code, i + 1, close, into);
      i = close + 1;
      continue;
    }
    const m = Keyword.exec(code.slice(i, Math.min(end, i + 8)));
    if (m !== null) {
      const word = m[1]!;
      let j = i + word.length;
      while (j < end && isWhiteSpace(code[j])) j++;
      // else if (…): an if like any other (its body runs unless it is an error branch).
      if (word === "else" && /^if\b/.test(code.slice(j, Math.min(end, j + 3)))) {
        i = j;
        continue;
      }
      let condition = "";
      if (j < end && code[j] === "(") {
        const close = CppSource.matchBracket(code, j);
        if (close < 0) return;
        condition = code.slice(j + 1, close);
        j = close + 1;
      }
      if (condition.length > 0 && (word === "if" || word === "while" || word === "switch")) into.push(new CppStatement(condition, i));
      while (j < end && isWhiteSpace(code[j])) j++;
      // The body: a block or a single statement.
      let bodyStart = j;
      let bodyEnd: number;
      if (j < end && code[j] === "{") {
        bodyEnd = CppSource.matchBracket(code, j);
        if (bodyEnd < 0) return;
        bodyStart = j + 1;
      } else bodyEnd = singleStatementEnd(code, j, end);
      // The body of an if runs unless it is an error branch (it returns or throws): if (data) { glTexImage2D(…); }
      if (word === "if" && !/\b(?:return|throw|exit)\b/.test(code.slice(bodyStart, bodyEnd))) {
        // A condition the reader may be able to decide (if (cubeVAO == 0), if (!oddRow)) comes with both
        // branches; any other if is its body.
        const then: CppStatement[] = [];
        walk(code, bodyStart, bodyEnd, then);
        // Every if comes with both branches (the reader decides it when it can, else runs the body); a render
        // loop inside one is walked as before.
        if (condition.length > 0 && !then.some((s) => s.kind === "loop-start")) {
          let otherwise: CppStatement[] | null = null;
          let e = bodyEnd + 1;
          while (e < end && isWhiteSpace(code[e])) e++;
          if (e + 4 <= end && /^else\b/.test(code.slice(e, Math.min(end, e + 5)))) {
            let es = e + 4;
            while (es < end && isWhiteSpace(code[es])) es++;
            if (!/^if\b/.test(code.slice(es, Math.min(end, es + 3)))) {
              let ee: number;
              if (es < end && code[es] === "{") {
                ee = CppSource.matchBracket(code, es);
                if (ee < 0) return;
                es++;
              } else ee = singleStatementEnd(code, es, end);
              otherwise = [];
              walk(code, es, ee, otherwise);
              bodyEnd = ee;
            }
          }
          // The condition itself was added above as a statement: replaced by the if.
          into.pop();
          into.push(new CppStatement(condition, i, "if", then, otherwise));
        } else into.push(...then);
      } else if (word === "if") {
        // An error branch (if (FT_New_Face(…)) { …; return -1; } else { … }) is not taken: its else is.
        let e = bodyEnd + 1;
        while (e < end && isWhiteSpace(code[e])) e++;
        if (e + 4 <= end && /^else\b/.test(code.slice(e, Math.min(end, e + 5)))) {
          let es = e + 4;
          while (es < end && isWhiteSpace(code[es])) es++;
          if (es < end && code[es] === "{") {
            const ee = CppSource.matchBracket(code, es);
            if (ee > 0) {
              walk(code, es + 1, ee, into);
              bodyEnd = ee;
            }
          }
        }
      } else if (word === "try") walk(code, bodyStart, bodyEnd, into);
      else if (word === "for") {
        const body: CppStatement[] = [];
        walk(code, bodyStart, bodyEnd, body);
        into.push(new CppStatement(condition, i, "for", body, null, { end: Math.min(end, bodyEnd + 1) }));
      } else if (word === "while" && isRenderLoop(condition)) {
        into.push(new CppStatement("", i, "loop-start"));
        walk(code, bodyStart, bodyEnd, into);
        into.push(new CppStatement("", bodyEnd, "loop-end"));
      } else if (word === "while" && condition.length > 0) {
        // Another while loop (std::getline over a file): run while its condition is known to hold. Its
        // condition was added as a statement above: the loop evaluates it itself.
        const body: CppStatement[] = [];
        walk(code, bodyStart, bodyEnd, body);
        into.pop();
        into.push(new CppStatement(condition, i, "while", body));
      }
      // do { … } while (…); – skip the trailing while.
      i = bodyEnd + 1;
      if (word === "do") {
        const semi = code.indexOf(";", i);
        i = semi < 0 ? end : semi + 1;
      }
      continue;
    }
    // A plain statement up to ';' at depth 0.
    let k = i;
    let d = 0;
    while (k < end) {
      const c = code[k];
      if (c === '"' || c === "'") {
        k++;
        while (k < end && code[k] !== c) {
          if (code[k] === "\\") k++;
          k++;
        }
      } else if (c === "(" || c === "{" || c === "[") d++;
      else if (c === ")" || c === "}" || c === "]") d--;
      else if (c === ";" && d <= 0) break;
      k++;
    }
    into.push(new CppStatement(trimNet(code.slice(i, Math.min(k, end))), i));
    i = k + 1;
  }
}
