// Tests for ps: which processes the options choose, the column layout of -f/-ef and aux, and -o with procps's
// column names, headers and errors.

import { afterEach, describe, expect, it } from "vitest";
import { Js } from "../src/Js.js";
import { TestShell } from "./TestShell.js";

/** The lines of an output, without the last empty one. */
const lines = (out: string): string[] => out.split("\n").slice(0, -1);

/** Where the header's column name ends – right-aligned columns end there on every line. */
const endOf = (header: string, name: string): number => header.indexOf(` ${name} `) + name.length + 1;

describe("ProcsTests", () => {
  afterEach(() => {
    Js.clockOverride = null;
  });

  it("ps and ps -f show only the processes of your own terminal", () => {
    const t = new TestShell("ubuntu", "en", "en");
    const short = lines(t.run("ps").out);
    expect(short[0]).toBe("    PID TTY          TIME CMD");
    expect(short.slice(1).map((l) => l.trim().split(/\s+/)[3])).toEqual(["bash", "ps"]);

    const full = lines(t.run("ps -f").out);
    expect(full[0]).toBe("UID          PID    PPID  C STIME TTY          TIME CMD");
    expect(full.slice(1).map((l) => l.split(/\s+/).slice(7).join(" "))).toEqual(["-bash", "ps -f"]);
    expect(full.every((l) => !l.includes("/sbin/init"))).toBe(true);
  });

  it("ps -ef, ps -e, ps aux and ps ax show every process", () => {
    const t = new TestShell("ubuntu", "en", "en");
    for (const cmd of ["ps -ef", "ps -e", "ps -A", "ps aux", "ps ax", "ps -aux"]) {
      const out = t.run(cmd).out;
      expect(out, cmd).toContain("/sbin/init");
      expect(out, cmd).toContain("/usr/sbin/sshd -D");
    }
    expect(lines(t.run("ps aux").out)[0]).toBe("USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND");
  });

  it("ps -ef and ps aux keep their columns, also for long user names (message+ like procps)", () => {
    const t = new TestShell("ubuntu", "en", "en");
    const ef = lines(t.run("ps -ef").out);
    const efHeader = ef[0]!;
    for (const name of ["PID", "PPID", "C"]) {
      const end = endOf(efHeader, name);
      for (const l of ef.slice(1)) expect(l[end], `${name} in "${l}"`).toBe(" ");
      for (const l of ef.slice(1)) expect(l[end - 1], `${name} in "${l}"`).toMatch(/[0-9]/);
    }
    expect(ef.find((l) => l.includes("dbus-daemon"))).toMatch(/^message\+ {5}498 {7}1 {2}0 /);
    // The C column is at most 99, even for the process that uses 99.7 % of the CPU.
    expect(ef.find((l) => l.endsWith(" yes"))).toMatch(/ 1201 99 10:05 /);

    const aux = lines(t.run("ps aux").out);
    const auxHeader = aux[0]!;
    for (const name of ["PID", "%CPU", "%MEM", "VSZ", "RSS"]) {
      const end = endOf(auxHeader, name);
      for (const l of aux.slice(1)) expect(l[end], `${name} in "${l}"`).toBe(" ");
    }
    expect(aux.find((l) => l.includes("dbus-daemon"))).toMatch(/^message\+ {5}498 /);
  });

  it("ps -o shows the chosen columns, with procps's headers and widths", () => {
    const t = new TestShell("ubuntu", "en", "en");
    expect(t.run("ps -o pid,cmd").out).toBe("    PID CMD\n   1290 -bash\n   4200 ps -o pid,cmd\n");
    expect(t.run("ps -o pid,ppid,user,comm,stat,tty,time -p 1290").out).toBe(
      "    PID    PPID USER     COMMAND         STAT TT           TIME\n" +
        "   1290    1201 student  bash            Ss   pts/0    00:00:00\n",
    );
    expect(t.run("ps -o pid,%cpu,%mem,args -p 3141").out).toBe("    PID %CPU %MEM COMMAND\n   3141 99.7  0.0 yes\n");
    // A left-aligned column that isn't last is cut to its width (27 for cmd and args).
    expect(t.run("ps -o cmd,pid -p 812").out).toBe("CMD                             PID\n/usr/local/bin/myserver --p     812\n");
    // comm is the program's name, at most 15 characters, like the kernel's.
    expect(t.run("ps -o comm= -p 312").out).toBe("systemd-journal\n");
    expect(t.run("ps -o user,pid -p 498").out).toBe("USER         PID\nmessage+     498\n");
    expect(t.run("ps -o pid,uid,user -u student").out).toContain("   1290  1000 student\n");
  });

  it("ps -eo, axo and -C choose processes, = drops or renames headers", () => {
    const t = new TestShell("ubuntu", "en", "en");
    const eo = t.run("ps -eo pid,comm").out;
    expect(eo).toContain("      1 init\n");
    expect(eo).toContain("    733 sshd\n");
    expect(t.run("ps axo pid,comm").out).toContain("    733 sshd\n");
    expect(t.run("ps -p 1 -o comm=").out).toBe("init\n");
    expect(t.run("ps -o pid= -o comm= -p 1,812").out).toBe("      1 init\n    812 myserver\n");
    expect(t.run("ps -C sshd -o pid=").out).toBe("    733\n");
    expect(t.run("ps -o pid,user=Owner -p 1").out).toBe("    PID Owner\n      1 root\n");
    expect(t.run("ps -o pid,user= -p 1").out).toBe("    PID \n      1 root\n");
    expect(lines(t.run("ps -eo pid,%cpu,comm --sort=-%cpu").out)[1]).toBe("   3141 99.7 yes");
  });

  it("ps -o etime counts from when the process started", () => {
    Js.clockOverride = () => new Date(2026, 10, 25, 12, 34, 56).getTime();
    const t = new TestShell("ubuntu", "en", "en");
    expect(t.run("ps -o pid,etime,etimes,stime,start -p 1,3141").out).toBe(
      "    PID     ELAPSED ELAPSED STIME  STARTED\n" +
        "      1    04:34:56   16496 08:00 08:00:00\n" +
        "   3141    02:29:56    8996 10:05 10:05:00\n",
    );
  });

  it("unknown columns and options get procps's errors", () => {
    const t = new TestShell("ubuntu", "en", "en");
    const usage =
      "\n\nUsage:\n ps [options]\n\n Try 'ps --help <simple|list|output|threads|misc|all>'\n  or 'ps --help <s|l|o|t|m|a>'\n for additional help text.\n\nFor more details see ps(1).\n";
    const cases: [string, string][] = [
      ["ps -o foo", 'error: unknown user-defined format specifier "foo"'],
      ["ps -eo pid,PID", 'error: unknown user-defined format specifier "PID"'],
      ["ps -o", "error: format specification must follow -o"],
      ["ps -k", "error: unsupported SysV option"],
      ["ps --bogus", "error: unknown gnu long option"],
      ["ps qq", "error: unsupported option (BSD syntax)"],
    ];
    for (const [cmd, error] of cases) {
      const r = t.run(cmd);
      expect(r.out, cmd).toBe(error + usage);
      expect(r.exitCode, cmd).toBe(1);
    }
  });
});
