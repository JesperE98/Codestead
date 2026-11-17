// Port of tests/Linux/Codestead.Shell.Tests/CoreTests.cs – tests for the core written while porting (parser,
// arithmetic, snapshots). The full port of src/shell/shell.test.ts lives in ShellTests.test.ts.

import { describe, expect, it } from "vitest";
import { ArithError } from "../src/Arith/ArithError.js";
import * as ArithLib from "../src/Arith/ArithLib.js";
import type { ArithVars } from "../src/Arith/ArithVars.js";
import { Js } from "../src/Js.js";
import type { AndOrNode } from "../src/Parser/Ast/AndOrNode.js";
import type { FuncDefNode } from "../src/Parser/Ast/FuncDefNode.js";
import type { ListNode } from "../src/Parser/Ast/ListNode.js";
import type { PipelineNode } from "../src/Parser/Ast/PipelineNode.js";
import type { SimpleNode } from "../src/Parser/Ast/SimpleNode.js";
import { ParseError } from "../src/Parser/ParseError.js";
import * as ParserLib from "../src/Parser/ParserLib.js";
import { Shell } from "../src/Shell/Shell.js";
import * as ShellLib from "../src/Shell/ShellLib.js";

const types = (code: string): string[] => (ParserLib.parse(code) as ListNode).items.map((i) => i.node.type);

describe("CoreTests", () => {
  it("parser: pipes, kedjor och omdirigering", () => {
    const ast = ParserLib.parse("ls -l | grep x > ut.txt && echo klar; echo \"a b\" 'c d'") as ListNode;
    expect(ast.items.length).toBe(2);
    const andor = ast.items[0]!.node as AndOrNode;
    expect(andor.type).toBe("andor");
    const pipeline = andor.first as PipelineNode;
    expect(pipeline.type).toBe("pipeline");
    expect((pipeline.commands[1] as SimpleNode).redirects[0]!.op).toBe(">");
    expect(andor.rest[0]!.op).toBe("&&");
    expect((ast.items[1]!.node as SimpleNode).words.map((w) => w.raw)).toEqual(["echo", '"a b"', "'c d'"]);
  });

  it("parser: syntaxfel och ofullständig kod", () => {
    expect(() => ParserLib.parse("ls |")).toThrow(ParseError);
    expect(() => ParserLib.parse('echo "oavslutad')).toThrow(ParseError);
    expect(() => ParserLib.parse("ls &&")).toThrow(ParseError);
    const incomplete = (code: string): boolean => {
      try {
        ParserLib.parse(code);
        return false;
      } catch (e) {
        if (e instanceof ParseError) return e.incomplete;
        throw e;
      }
    };
    expect(incomplete("for i in 1 2 3; do")).toBe(true);
    expect(incomplete("if true; then echo a")).toBe(true);
    expect(incomplete('echo "a')).toBe(true);
    expect(incomplete("fi")).toBe(false);
    expect(incomplete("done")).toBe(false);
  });

  it("parser: 2> räknas bara som operator i början av ett ord", () => {
    const cmd = (ParserLib.parse("echo fil2>x") as ListNode).items[0]!.node as SimpleNode;
    expect(cmd.words.map((w) => w.raw)).toEqual(["echo", "fil2"]);
    expect(cmd.redirects[0]!.op).toBe(">");
  });

  it("parser: sammansatta kommandon", () => {
    expect(types("if true; then echo a; elif false; then echo b; else echo c; fi")).toEqual(["if"]);
    expect(types("for f in *.txt; do echo $f; done")).toEqual(["for"]);
    expect(types("for ((i=0; i<3; i++)); do echo $i; done")).toEqual(["cfor"]);
    expect(types("while read x; do echo $x; done < fil")).toEqual(["while"]);
    expect(types("case $x in a|b) echo ab;; *) echo annat;; esac")).toEqual(["case"]);
    expect(types("hej() { echo hej; }; function da { echo da; }")).toEqual(["funcdef", "funcdef"]);
    expect(types("(cd /tmp; ls); { echo a; echo b; }")).toEqual(["group", "group"]);
    expect(types("((x = 1 + 2))")).toEqual(["arith"]);
  });

  it("parser: here-dokument", () => {
    const cmd = (ParserLib.parse("cat << SLUT\nhej $X\nSLUT\n") as ListNode).items[0]!.node as SimpleNode;
    expect(cmd.redirects[0]!.op).toBe("<<");
    expect(cmd.redirects[0]!.body).toBe("hej $X\n");
    expect(cmd.redirects[0]!.expand).toBe(true);
  });

  it("aritmetik som i bash", () => {
    const env = new Map<string, string>();
    const vars: ArithVars = { get: (n) => env.get(n) ?? null, set: (n, v) => void env.set(n, v) };
    expect(ArithLib.evalArith("1 + 2 * 3", vars)).toBe(7n);
    expect(ArithLib.evalArith("7 / 3", vars)).toBe(2n);
    expect(ArithLib.evalArith("2 ** 10", vars)).toBe(1024n);
    expect(ArithLib.evalArith("x = 5", vars)).toBe(5n);
    expect(ArithLib.evalArith("x++", vars)).toBe(5n);
    expect(env.get("x")).toBe("6");
    expect(ArithLib.evalArith("x > 3 ? 1 : 0", vars)).toBe(1n);
    expect(() => ArithLib.evalArith("1 / 0", vars)).toThrow(ArithError);
  });

  it("glob blir regex", () => {
    expect(ParserLib.globToRegex("*.txt").test("a.txt")).toBe(true);
    expect(ParserLib.globToRegex("*.txt").test("a.txt\n")).toBe(false);
    expect(ParserLib.globToRegex("*.txt").test("dir/a.txt")).toBe(false);
    expect(ParserLib.globToRegex("[!a]?", false).test("bc")).toBe(true);
  });

  it("ögonblicksbilden kan sparas som JSON och läsas in igen", () => {
    const sh = Shell.create("ubuntu", "sv");
    sh.functions.set("hej", ((ParserLib.parse("hej() { echo hej; }") as ListNode).items[0]!.node as FuncDefNode).body);
    sh.env.set("X", "1");
    const json = sh.snapshotJson();
    const back = Shell.restoreJson(json);
    expect(back).not.toBeNull();
    expect(back!.env.get("X")).toBe("1");
    expect(back!.functions.get("hej")!.type).toBe("group");
    expect([...back!.env.keys()]).toEqual([...sh.env.keys()]);
    expect(back!.vfs.lookup("/home/elev", back!.rootUser()).type).toBe("dir");
  });

  it("JS-hjälparna: slice, oktalt och talformat", () => {
    expect("hello".slice(1, -1)).toBe("ell");
    expect("hello".slice(-2)).toBe("lo");
    expect(Js.oct(755)).toBe(493);
    expect(Js.num(1.5)).toBe("1.5");
    expect(Js.num(3.0)).toBe("3");
    expect(Js.num(9007199254740992.0)).toBe("9007199254740992");
    expect(ShellLib.flattenLines("ab b")).toBe("ab b");
    expect(ShellLib.flattenLines("for i in 1 2\ndo echo $i\ndone")).toBe("for i in 1 2; do echo $i; done");
  });
});
