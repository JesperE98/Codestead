// Port of tests/Linux/Codestead.Shell.Tests/TextprocTests.cs (src/shell/textproc.test.ts) – tr, sed and awk.

import { describe, expect, it } from "vitest";
import * as AwkCmd from "../src/Commands/Awk/AwkCmd.js";
import * as DistrosLib from "../src/Distros/DistrosLib.js";
import { itNeeds, TestShell } from "./TestShell.js";

const nonEmptyLines = (s: string): number => s.split("\n").filter((l) => l !== "").length;

const distroIds = DistrosLib.distros.map((d) => d.id);

describe("TextprocTests", () => {
  // describe('paket')

  for (const id of distroIds) {
    itNeeds(["which"], `sed, tr och awk finns från start i ${id}`, () => {
      const t = new TestShell(id);
      expect(t.run("which sed tr awk").out).toBe("/usr/bin/sed\n/usr/bin/tr\n/usr/bin/awk\n");
    });
  }

  // describe('tr')

  it("byter tecken, intervall och klasser", () => {
    const t = new TestShell();
    expect(t.run("echo hej världen | tr a-z A-Z").out).toBe("HEJ VäRLDEN\n");
    expect(t.run("echo Hej | tr '[:lower:]' '[:upper:]'").out).toBe("HEJ\n");
    expect(t.run("echo 'a:b:c' | tr ':' '\\n'").out).toBe("a\nb\nc\n");
    expect(t.run("echo abc | tr abc x").out).toBe("xxx\n");
    expect(t.run("echo hello | tr el ip").out).toBe("hippo\n");
  });

  it("-d, -s och -c", () => {
    const t = new TestShell();
    expect(t.run("echo 'abc123def' | tr -d 0-9").out).toBe("abcdef\n");
    expect(t.run("echo 'a   b    c' | tr -s ' '").out).toBe("a b c\n");
    expect(t.run("echo 'abc123' | tr -cd '[:digit:]'").out).toBe("123");
    expect(t.run("echo 'aabbcc' | tr -s a-z A-Z").out).toBe("ABC\n");
    expect(t.run("echo 'x1  2' | tr -ds x ' '").out).toBe("1 2\n");
  });

  it("läser bara stdin och ger fel som GNU tr", () => {
    const t = new TestShell();
    expect(t.run("tr a-z A-Z dokument/frukter.txt").out).toContain("tr: extra operand 'dokument/frukter.txt'");
    expect(t.run("tr").out).toContain("tr: missing operand");
    expect(t.run("echo x | tr a").out).toContain("tr: missing operand after 'a'");
    expect(t.run("echo x | tr z-a A").out).toContain("reverse collating sequence order");
    expect(t.run("echo x | tr '[:foo:]' a").out).toContain("invalid character class 'foo'");
    expect(t.run("tr a-z A-Z < dokument/frukter.txt").out).toContain("BANAN\n");
  });

  // describe('sed')

  it("s med flaggor, avgränsare, & och grupper", () => {
    const t = new TestShell();
    expect(t.run("echo 'a a a' | sed 's/a/b/'").out).toBe("b a a\n");
    expect(t.run("echo 'a a a' | sed 's/a/b/g'").out).toBe("b b b\n");
    expect(t.run("echo 'a a a' | sed 's/a/b/2'").out).toBe("a b a\n");
    expect(t.run("echo 'a a a' | sed 's/a/b/2g'").out).toBe("a b b\n");
    expect(t.run("echo 'Hej HEJ' | sed 's/hej/x/gI'").out).toBe("x x\n");
    expect(t.run("echo /usr/bin | sed 's|/usr|/opt|'").out).toBe("/opt/bin\n");
    expect(t.run("echo hej | sed 's/.*/[&]/'").out).toBe("[hej]\n");
    expect(t.run("echo 'Anna Svensson' | sed 's/\\(.*\\) \\(.*\\)/\\2, \\1/'").out).toBe("Svensson, Anna\n");
    expect(t.run("echo 'Anna Svensson' | sed -E 's/(.*) (.*)/\\2, \\1/'").out).toBe("Svensson, Anna\n");
    expect(t.run("echo 'abc' | sed 's/b/\\U&/'").out).toBe("aBc\n");
    expect(t.run("echo 'x+y' | sed 's/x\\+/z/'").out).toBe("z+y\n");
    expect(t.run("echo 'aaa' | sed 's/a\\+/b/'").out).toBe("b\n");
    expect(t.run("echo '2026' | sed 's/[[:digit:]]/#/g'").out).toBe("####\n");
  });

  itNeeds(["seq"], "d, p, q, = och adresser", () => {
    const t = new TestShell();
    const log = "dokument/server.log";
    expect(t.run(`sed -n '2p' ${log}`).out).toContain("Reading configuration");
    expect(nonEmptyLines(t.run(`sed -n '2,4p' ${log}`).out)).toBe(3);
    expect(t.run(`sed -n '$p' ${log}`).out).toContain("Rotating");
    expect(nonEmptyLines(t.run(`sed '/INFO/d' ${log}`).out)).toBe(6);
    expect(nonEmptyLines(t.run(`sed '/ERROR/!d' ${log}`).out)).toBe(3);
    expect(nonEmptyLines(t.run(`sed -n '/WARN/,/ERROR/p' ${log}`).out)).toBe(4 + 3);
    expect(nonEmptyLines(t.run(`sed 3q ${log}`).out)).toBe(3);
    expect(t.run(`sed -n '$=' ${log}`).out).toBe("15\n");
    expect(t.run('sed -n "/kiwi/=" dokument/frukter.txt').out).toBe("3\n8\n");
    expect(t.run("seq 5 | sed '2,3d'").out).toBe("1\n4\n5\n");
    expect(t.run("seq 5 | sed -n '4,2p'").out).toBe("4\n");
    expect(t.run("seq 3 | sed '2!s/$/ x/'").out).toBe("1 x\n2\n3 x\n");
    expect(t.run("seq 6 | sed -n '1~2p'").out).toBe("1\n3\n5\n");
  });

  itNeeds(["seq"], "flera skript med ; och -e, samt y, a, i och c", () => {
    const t = new TestShell();
    expect(t.run("echo abc | sed 's/a/A/; s/c/C/'").out).toBe("AbC\n");
    expect(t.run("echo abc | sed -e 's/a/A/' -e 's/c/C/'").out).toBe("AbC\n");
    expect(t.run("echo abc | sed 'y/abc/xyz/'").out).toBe("xyz\n");
    expect(t.run("seq 2 | sed '1a efter'").out).toBe("1\nefter\n2\n");
    expect(t.run("seq 2 | sed '2i före'").out).toBe("1\nföre\n2\n");
    expect(t.run("seq 3 | sed '2c ny'").out).toBe("1\nny\n3\n");
  });

  itNeeds(["sudo"], "-i ändrar filen på plats och kräver skrivrättighet", () => {
    const t = new TestShell();
    expect(t.run("sed -i 's/kiwi/KIWI/g' dokument/frukter.txt").out).toBe("");
    expect(t.content("~/dokument/frukter.txt")).toContain("KIWI\n");
    expect(t.content("~/dokument/frukter.txt")).not.toContain("kiwi");
    t.run("sed -i.bak '1d' dokument/frukter.txt");
    expect(t.content("~/dokument/frukter.txt.bak")?.startsWith("äpple\n") === true).toBe(true);
    expect(t.content("~/dokument/frukter.txt")?.startsWith("banan\n") === true).toBe(true);
    const r = t.run("sed -i 's/localhost/lokal/' /etc/hosts");
    expect(r.out).toContain("Permission denied");
    expect(r.exitCode).not.toBe(0);
    expect(t.run("sudo sed -i 's/localhost/lokal/' /etc/hosts").exitCode).toBe(0);
    expect(t.content("/etc/hosts")).toContain("lokal");
    expect(t.run("sed -i 's/a/b/'").out).toBe("sed: no input files\n");
  });

  it("felmeddelanden som GNU sed", () => {
    const t = new TestShell();
    expect(t.run("echo x | sed 'k'").out).toBe("sed: -e expression #1, char 1: unknown command: `k'\n");
    expect(t.run("echo x | sed 's/a/b'").out).toContain("unterminated `s' command");
    expect(t.run("echo x | sed 's/a/b/z'").out).toContain("unknown option to `s'");
    expect(t.run("echo x | sed -e p -e 'k'").out).toContain("-e expression #2");
    expect(t.run("echo x | sed 's/a/\\1/'").out).toContain("invalid reference \\1 on `s' command's RHS");
    expect(t.run("sed p finnsinte.txt").out).toBe("sed: can't read finnsinte.txt: No such file or directory\n");
    const r = t.run("echo x | sed 'h'");
    expect(r.out).toContain("stöds inte");
    expect(r.exitCode).toBe(1);
    expect(t.run("sed").exitCode).toBe(1);
  });

  // describe('awk')

  it("fält, -F och $NF", () => {
    const t = new TestShell();
    expect(t.run("echo 'a b  c' | awk '{print $2}'").out).toBe("b\n");
    expect(t.run("echo 'a b  c' | awk '{print $NF, NF}'").out).toBe("c 3\n");
    expect(t.run("echo 'a b c' | awk '{print $(NF-1)}'").out).toBe("b\n");
    expect(t.run("awk -F: '{print $1, $7}' /etc/passwd").out).toContain("elev /bin/bash\n");
    expect(t.run("awk -F: '$3 >= 1000 {print $1}' /etc/passwd").out).toBe("nobody\nelev\n");
    expect(t.run("echo 'a,b' | awk -F, '{print $2 $1}'").out).toBe("ba\n");
    expect(t.run("echo 'a b' | awk '{print $1 \"-\" $2}'").out).toBe("a-b\n");
    expect(t.run("echo 'a b' | awk 'BEGIN {OFS=\"-\"} {$1=$1; print}'").out).toBe("a-b\n");
    expect(t.run("echo 'a b c' | awk '{$2=\"X\"; print; print NF}'").out).toBe("a X c\n3\n");
  });

  it("mönster: regex, jämförelser, NR och BEGIN/END", () => {
    const t = new TestShell();
    const csv = "dokument/betyg.csv";
    expect(t.run(`awk -F, 'NR > 1 {s += $3} END {print s}' ${csv}`).out).toBe("590\n");
    expect(t.run(`awk -F, 'NR > 1 {s += $3; n++} END {print s / n}' ${csv}`).out).toBe("73.75\n");
    expect(t.run(`awk -F, 'NR > 1 && $3 >= 90 {print $1}' ${csv}`).out).toBe("Cleo\nFarid\n");
    expect(t.run(`awk -F, '$2 == "matte" {print $1}' ${csv}`).out).toBe("Alva\nBilal\nFarid\n");
    expect(t.run(`awk -F, '$1 ~ /^[A-C]/ {print $1}' ${csv}`).out).toBe("Alva\nBilal\nCleo\n");
    // The header row is compared as text: "poäng" > "70".
    expect(t.run(`awk -F, '$3 > 70 {print $1}' ${csv}`).out.split("\n")[0]).toBe("namn");
    expect(t.run("awk '/ERROR/ {n++} END {print n}' dokument/server.log").out).toBe("3\n");
    expect(nonEmptyLines(t.run("awk '!/INFO/' dokument/server.log").out)).toBe(6);
    expect(t.run("awk 'END {print NR}' dokument/frukter.txt").out).toBe("10\n");
    expect(t.run("awk 'BEGIN {print 1 + 2, 7 / 2, 2 ^ 10, 10 % 3}'").out).toBe("3 3.5 1024 1\n");
    expect(t.run("awk -v namn=Elev 'BEGIN {print \"Hej\", namn}'").out).toBe("Hej Elev\n");
    expect(t.run("awk 'BEGIN {x = 1; x += 4; x++; print x; print x--, x}'").out).toBe("6\n6 5\n");
  });

  it("printf och inbyggda funktioner", () => {
    const t = new TestShell();
    expect(t.run("awk 'BEGIN {printf \"%-6s|%5.1f|%03d|%x|%%\\n\", \"ab\", 3.14159, 7, 255}'").out).toBe("ab    |  3.1|007|ff|%\n");
    expect(t.run("awk 'BEGIN {printf(\"%s=%d\\n\", \"x\", 42.9)}'").out).toBe("x=42\n");
    expect(t.run("echo äpple | awk '{print toupper($0), length($0), length()}'").out).toBe("äPPLE 5 5\n");
    // Arch and Fedora have GNU awk, which handles å, ä and ö.
    expect(new TestShell("fedora").run("echo äpple | awk '{print toupper($0)}'").out).toBe("ÄPPLE\n");
    expect(t.run("awk 'BEGIN {print substr(\"hello\", 2, 3), index(\"hello\", \"l\"), tolower(\"ABC\"), int(3.9)}'").out).toBe("ell 3 abc 3\n");
    expect(t.run("echo 'a-b-c' | awk '{n = split($0, p, \"-\"); print n, p[3]}'").out).toBe("3 c\n");
    expect(t.run("echo 'aaa' | awk '{gsub(/a/, \"b\"); print}'").out).toBe("bbb\n");
    expect(t.run("echo 'aaa' | awk '{sub(/a/, \"[&]\"); print}'").out).toBe("[a]aa\n");
    expect(t.run("awk 'BEGIN {print sprintf(\"%5s\", \"x\") \"|\"}'").out).toBe("    x|\n");
  });

  itNeeds(["seq"], "if, loopar och arrayer", () => {
    const t = new TestShell();
    expect(t.run("awk '{c[$1]++} END {print c[\"äpple\"], c[\"kiwi\"], length(c)}' dokument/frukter.txt").out).toBe("3 2 6\n");
    expect(t.run("awk 'BEGIN {for (i = 1; i <= 3; i++) s = s i; print s}'").out).toBe("123\n");
    expect(t.run("awk 'BEGIN {i = 0; while (i < 3) {i++}; print i}'").out).toBe("3\n");
    expect(t.run("awk 'BEGIN {if (2 > 1) print \"ja\"; else print \"nej\"}'").out).toBe("ja\n");
    expect(t.run("awk 'BEGIN {x = 5 > 3 ? \"stor\" : \"liten\"; print x}'").out).toBe("stor\n");
    expect(t.run("seq 5 | awk '$1 == 3 {next} {print}'").out).toBe("1\n2\n4\n5\n");
    expect(t.run("seq 5 | awk '$1 == 3 {exit} {print}'").out).toBe("1\n2\n");
    expect(t.run("awk -F, 'NR > 1 {s[$2] += $3} END {for (k in s) print k, s[k]}' dokument/betyg.csv").out).toBe(
      "matte 246\nsvenska 241\nengelska 103\n",
    );
  });

  it("fel", () => {
    const t = new TestShell();
    const r = t.run("awk '{print $1'");
    expect(r.out).toContain("awk: cmd. line:1: {print $1\n");
    expect(r.out).toContain("^ unexpected newline or end of string");
    expect(r.out).toContain("simulatorn");
    expect(r.exitCode).not.toBe(0);
    expect(t.run("awk '{print $1 > \"fil\"}'").out).toContain("omdirigering av utdata");
    expect(t.run("awk 'function f(x) {return x}'").out).toContain("egna funktioner");
    expect(t.run("awk '{getline}'").out).toContain("getline stöds inte");
    expect(t.run("awk 'BEGIN {print 1/0}'").out).toContain("fatal: division by zero attempted");
    expect(t.run("awk '{print}' finnsinte").out).toContain("cannot open file `finnsinte' for reading: No such file or directory");
    expect(t.run("awk 'BEGIN {while (1) x++}'").out).toContain("oändlig loop");
    expect(t.run("awk").exitCode).toBe(2);
  });

  it("formatering av tal", () => {
    expect(AwkCmd.formatG(3.14159265)).toBe("3.14159");
    expect(AwkCmd.formatG(0.1 + 0.2)).toBe("0.3");
    expect(AwkCmd.formatG(1e-7)).toBe("1e-07");
    expect(AwkCmd.formatG(123456789)).toBe("1.23457e+08");
    expect(AwkCmd.awkSprintf("%5.2f|%-4d|%e", [2.5, 3.0, 12345.0])).toBe(" 2.50|3   |1.234500e+04");
  });
});
