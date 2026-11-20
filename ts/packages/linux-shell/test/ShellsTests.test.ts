// Port of tests/Linux/Codestead.Shell.Tests/ShellsTests.cs (src/shell/shells.test.ts).

import { describe, expect, it } from "vitest";
import * as ShellsCmd from "../src/Commands/Shells/ShellsCmd.js";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import * as FishLib from "../src/Fish/FishLib.js";
import { ParseError } from "../src/Parser/ParseError.js";
import type { Shell } from "../src/Shell/Shell.js";
import * as ShellmodeLib from "../src/Shellmode/ShellmodeLib.js";
import { TestShell, itNeeds } from "./TestShell.js";

function prompt(s: TestShell): string {
  return UtilCmd.stripAnsi(s.sh.prompt());
}

/** The commands withShells needs on a distribution (the package manager and sudo). */
function installer(distro: string): string[] {
  return distro === "arch" ? ["sudo", "pacman"] : distro === "fedora" ? ["sudo", "dnf"] : ["sudo", "apt"];
}

/** A shell with zsh and fish installed. */
function withShells(distro = "ubuntu"): TestShell {
  const s = new TestShell(distro);
  let cmds: string[];
  switch (distro) {
    case "ubuntu":
    case "debian":
      cmds = ["sudo apt update", "sudo apt install zsh fish"];
      break;
    case "arch":
      cmds = ["sudo pacman -S zsh fish", "y"];
      break;
    case "fedora":
      cmds = ["sudo dnf install zsh fish", "y"];
      break;
    default:
      throw new Error(distro);
  }
  for (const c of cmds) s.run(c);
  return s;
}

/** Starts zsh and answers zsh-newuser-install. */
function startZsh(s: TestShell, answer = "2"): void {
  const r = s.run("zsh");
  if (r.pending) s.run(answer);
}

/** The commands the tests in a terminal with zsh and fish need (ubuntu). */
const shells = (...more: string[]): string[] => ["zsh", "fish", ...installer("ubuntu"), ...more];

/** itNeeds for a [Theory]: one case per value. */
function eachNeeds<T>(values: readonly T[], commands: (v: T) => string[], name: string, fn: (v: T) => void): void {
  for (const v of values) itNeeds(commands(v), `${name} (${String(v)})`, () => fn(v));
}

function passwdShell(sh: Shell): string {
  return sh.vfs
    .readFile("/etc/passwd", sh.rootUser())
    .split("\n")
    .find((l) => l.startsWith("elev:"))!
    .split(":")[6]!;
}

describe("ShellsTests", () => {
  // ---------- paket och /etc/shells ----------

  eachNeeds(
    ["ubuntu", "debian", "arch", "fedora"],
    (d) => ["zsh", "fish", "cat", "which", ...installer(d)],
    "zsh och fish installeras och läggs i /etc/shells",
    (d) => {
      const s = withShells(d);
      expect(s.sh.installed.has("zsh") && s.sh.installed.has("fish")).toBe(true);
      const shellsText = s.run("cat /etc/shells").out;
      expect(shellsText).toContain("/usr/bin/zsh");
      expect(shellsText).toContain("/usr/bin/fish");
      expect(s.run("which zsh").out.trim()).toBe("/usr/bin/zsh");
    },
  );

  itNeeds(["zsh", "cat"], "zsh finns inte från början", () => {
    const s = new TestShell();
    expect(s.run("zsh").exitCode).toBe(127);
    expect(s.run("cat /etc/shells").out).not.toContain("zsh");
  });

  itNeeds(["zsh", "fish", "cat", ...installer("arch")], "avinstallation tar bort skalet ur /etc/shells", () => {
    const s = withShells("arch");
    s.run("sudo pacman -R fish");
    s.run("y");
    const shellsText = s.run("cat /etc/shells").out;
    expect(shellsText).not.toContain("fish");
    expect(shellsText).toContain("/usr/bin/zsh");
  });

  // ---------- zsh ----------

  itNeeds(shells("echo", "exit"), "startar med zsh-newuser-install, prompt och exit", () => {
    const s = withShells();
    const r = s.run("zsh");
    expect(r.out).toContain("zsh-newuser-install");
    expect(r.pending).toBe(true);
    s.run("0");
    expect(s.sh.vfs.readFile("/home/elev/.zshrc", s.sh.rootUser())).toContain("newuser");
    expect(s.sh.shellMode).toBe("zsh");
    expect(prompt(s)).toBe("ubuntu% ");
    expect(s.run("echo $0").out.trim()).toBe("zsh");
    expect(s.run("echo $ZSH_VERSION").out.trim()).toBe("5.9");
    // $SHELL is the login shell, not the shell that is running.
    expect(s.run("echo $SHELL").out.trim()).toBe("/bin/bash");
    s.run("exit");
    expect(s.sh.shellMode).toBe("bash");
    expect(prompt(s)).toBe("elev@ubuntu:~$ ");
    expect(s.run("echo $0").out.trim()).toBe("bash");
  });

  itNeeds(shells("cd", "exit", "setopt"), "rekommenderade inställningar: prompt och autocd", () => {
    const s = withShells();
    startZsh(s, "2");
    expect(prompt(s)).toBe("elev@ubuntu ~ % ");
    s.run("dokument");
    expect(s.sh.cwd).toBe("/home/elev/dokument");
    expect(prompt(s)).toBe("elev@ubuntu dokument % ");
    // Next time zsh does not ask again.
    s.run("exit");
    expect(s.run("zsh").pending).toBe(false);
    expect(s.sh.shellMode).toBe("zsh");
  });

  itNeeds(shells("cd", "setopt"), "setopt autocd och setopt finns bara i zsh", () => {
    const s = withShells();
    expect(s.run("setopt autocd").out).toContain("command not found");
    startZsh(s, "q");
    expect(s.run("gammalt").exitCode).toBe(127);
    s.run("setopt autocd");
    s.run("gammalt");
    expect(s.sh.cwd).toBe("/home/elev/gammalt");
    expect(s.run("setopt").out).toContain("autocd");
    expect(s.run("setopt nosuchthing").out).toContain("no such option");
  });

  itNeeds(shells("ps", "exit"), "ps visar zsh som barn till bash", () => {
    const s = withShells();
    startZsh(s);
    const output = s.run("ps").out;
    expect(output).toMatch(/bash\n.*zsh\n.*ps/);
    s.run("exit");
    expect(s.run("ps").out).not.toContain("zsh");
  });

  itNeeds(shells("ls"), "** letar i alla underkataloger, men inte i bash", () => {
    const s = withShells();
    expect(s.run("ls -d ~/**/*.txt").out).not.toContain("logg-2019.txt");
    startZsh(s);
    const output = s.run("ls -d ~/**/*.txt").out;
    expect(output).toContain("/home/elev/dokument/frukter.txt");
    expect(output).toContain("/home/elev/gammalt/arkiv/logg-2019.txt");
    expect(output).toContain("/home/elev/anteckningar.txt");
  });

  itNeeds(shells("echo", "setopt"), "ociterade variabler delas inte upp", () => {
    const s = withShells();
    const loop = 'x="a b c"; for i in $x; do echo "[$i]"; done';
    expect(s.run(loop).out).toBe("[a]\n[b]\n[c]\n");
    startZsh(s);
    expect(s.run(loop).out).toBe("[a b c]\n");
    s.run("setopt shwordsplit");
    expect(s.run(loop).out).toBe("[a]\n[b]\n[c]\n");
  });

  itNeeds(shells(), "felmeddelanden ser ut som i zsh", () => {
    const s = withShells();
    startZsh(s);
    expect(s.run("finnsinte").out).toBe("zsh: command not found: finnsinte\n");
  });

  itNeeds(shells("alias", "cd", "echo", "exit"), "variabler, alias och katalog från zsh försvinner vid exit", () => {
    const s = withShells();
    s.run('alias ll="ls -l"');
    startZsh(s);
    expect(s.run("ll").exitCode).toBe(127);
    s.run("hemligt=42");
    s.run("cd /tmp");
    s.run("exit");
    expect(s.sh.cwd).toBe("/home/elev");
    expect(s.run('echo "[$hemligt]"').out).toBe("[]\n");
    expect(s.sh.aliases.get("ll")).toBe("ls -l");
  });

  itNeeds(shells("echo", "printf", "chmod"), "zsh -c och skript med #!/bin/zsh", () => {
    const s = withShells();
    expect(s.run("zsh -c 'echo $0'").out.trim()).toBe("zsh");
    s.run("printf '#!/usr/bin/zsh\\necho $ZSH_VERSION\\n' > ~/z.sh");
    s.run("chmod +x ~/z.sh");
    expect(s.run("~/z.sh").out.trim()).toBe("5.9");
    expect(s.sh.shellMode).toBe("bash");
  });

  itNeeds(shells("whoami", "exit"), "sudo zsh ger ett root-skal", () => {
    const s = withShells();
    // root has no ~/.zshrc, so zsh-newuser-install asks.
    expect(s.run("sudo zsh").out).toContain("zsh-newuser-install");
    s.run("q");
    expect(s.run("whoami").out.trim()).toBe("root");
    expect(prompt(s)).toBe("ubuntu# ");
    s.run("exit");
    expect(s.run("whoami").out.trim()).toBe("elev");
  });

  it("promptkoder", () => {
    const sh = new TestShell("fedora").sh;
    sh.cwd = "/home/elev/dokument";
    expect(ShellmodeLib.zshPrompt(sh, "%n@%m %~ %# ")).toBe("elev@fedora ~/dokument % ");
    expect(ShellmodeLib.zshPrompt(sh, "[%n %1~]%% ")).toBe("[elev dokument]% ");
    expect(ShellmodeLib.zshPrompt(sh, "%d")).toBe("/home/elev/dokument");
  });

  // ---------- fish: översättning ----------

  const T = (code: string): string => FishLib.translateFish(code);

  it("block och variabler", () => {
    expect(T("set namn Kim")).toBe("__fish_set namn Kim");
    expect(T("echo $namn (pwd)")).toBe("echo ${namn} $(pwd)");
    expect(T("for x in a b c; echo $x; end")).toBe("for x in a b c; do echo ${x}; done");
    expect(T("if test -f a; and test -f b; echo ja; else if true; echo kanske; else; echo nej; end")).toBe(
      "if test -f a && test -f b; then echo ja; elif true; then echo kanske; else echo nej; fi",
    );
    expect(T("while read -l rad; echo $rad; end < fil")).toBe("while read rad; do echo ${rad}; done < fil");
    expect(T('function hej; echo Hej $argv[1] "$argv"; end')).toBe('hej() { echo Hej ${1} "$*"; }');
    expect(T("begin; echo a; end | sort")).toBe("{ echo a; } | sort");
    expect(T("not test -f x; or echo saknas")).toBe("! test -f x || echo saknas");
    expect(T("switch $x; case a b; echo AB; case '*'; echo annat; end")).toBe("case ${x} in a|b) echo AB ;; *) echo annat ;; esac");
    expect(T('echo "status: $status"')).toBe('echo "status: $?"');
    expect(T("echo {$HOME}/x")).toBe("echo ${HOME}/x");
    expect(T("sleep 5 &")).toBe("sleep 5 &");
    expect(T("X=1 env")).toBe("X=1 env");
  });

  it("bash-syntax ger fish-fel", () => {
    const err = (code: string): string => {
      try {
        T(code);
        return "";
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        return e.message;
      }
    };
    expect(err("X=1")).toContain("Unsupported use of '='. In fish, please use 'set X 1'.");
    expect(err("echo $?")).toContain("$? is not the exit status. In fish, please use $status.");
    expect(err("echo ${HOME}")).toContain("Variables cannot be bracketed. In fish, please use {$HOME}.");
    expect(err("echo $((1+2))")).toContain("please use 'math'");
    expect(err("for i in 1 2; do echo $i; done")).toContain("Unknown command: do");
    expect(err("end")).toContain("'end' outside of a block");
    expect(err("cat << SLUT")).toContain("redirection");
  });

  it("ofullständiga block", () => {
    for (const code of ["for i in 1 2", "if true", 'echo "oavslutad', "echo (pwd"]) {
      let incomplete: boolean | null = null;
      try {
        T(code);
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        incomplete = e.incomplete;
      }
      expect(incomplete, code).toBe(true);
    }
  });

  it("math", () => {
    // toBeCloseTo(3.333333) with the default precision 2: |diff| < 0.005
    expect(ShellsCmd.fishMath("10 / 3")).toBeCloseTo(3.333333);
    expect(ShellsCmd.fishMath("2 + 3 x 4")).toBe(14);
    expect(ShellsCmd.fishMath("(2 + 3) * 4")).toBe(20);
    expect(ShellsCmd.fishMath("2 ^ 10")).toBe(1024);
    expect(() => ShellsCmd.fishMath("1 / 0")).toThrow();
  });

  // ---------- fish i terminalen ----------

  itNeeds(shells("mkdir", "cd", "exit"), "start, hälsning, prompt och exit", () => {
    const s = withShells();
    const r = s.run("fish");
    expect(r.out).toContain("Welcome to fish, the friendly interactive shell");
    expect(prompt(s)).toBe("elev@ubuntu ~> ");
    expect(s.sh.vfs.tryLookup("/home/elev/.config/fish/config.fish", s.sh.rootUser())).not.toBeNull();
    s.run("mkdir -p ~/dokument/projekt/kod");
    s.run("cd ~/dokument/projekt/kod");
    expect(prompt(s)).toBe("elev@ubuntu ~/d/p/kod> ");
    s.run("exit");
    expect(s.sh.shellMode).toBe("bash");
    expect(s.sh.cwd).toBe("/home/elev");
  });

  itNeeds(shells("echo", "env", "exit"), "set, variabler och listor", () => {
    const s = withShells();
    s.run("fish");
    expect(s.run("X=1").out).toContain("fish: Unsupported use of '='. In fish, please use 'set X 1'.");
    s.run("set frukt äpple");
    expect(s.run("echo $frukt").out).toBe("äpple\n");
    s.run("set frukter äpple päron banan");
    expect(s.run("echo $frukter[2]").out).toBe("päron\n");
    expect(s.run("echo $frukter[-1]").out).toBe("banan\n");
    expect(s.run("count $frukter").out).toBe("3\n");
    s.run("set -x EDITOR nano");
    expect(s.run("env").out).toContain("EDITOR=nano");
    expect(s.run("set -q EDITOR").exitCode).toBe(0);
    s.run("set -e EDITOR");
    expect(s.run("set -q EDITOR").exitCode).toBe(1);
    s.run("set -a frukter kiwi");
    expect(s.run("count $frukter").out).toBe("4\n");
    s.run("set PATH $PATH ~/bin");
    expect(s.sh.env.get("PATH")).toBe("/usr/local/bin:/usr/bin:/bin:/home/elev/bin");
    s.run("exit");
    expect(s.sh.env.get("frukt") ?? null).toBeNull();
  });

  itNeeds(shells("bash", "env", "exit", "export"), "fish: set -x och set -gx exporterar, set -u tar bort exporten", () => {
    const s = withShells();
    s.run("vanlig=1; export exp=2");
    s.run("fish");
    // fish är ett nytt program: det får bara bashs miljövariabler.
    expect(s.run("echo [$vanlig] [$exp]").out).toBe("[] [2]\n");
    s.run("set p1 ett; set -x p2 två; set -gx p3 tre");
    expect(s.run("bash -c 'echo [$p1] [$p2] [$p3]'").out).toBe("[] [två] [tre]\n");
    expect(s.run("env").out).not.toContain("p1=");
    expect(s.run("set -x").out).toContain("p2 två\n");
    expect(s.run("set -x").out).not.toContain("p1 ett");
    // En exporterad variabel förblir exporterad när den får ett nytt värde, tills set -u.
    s.run("set p2 fyra");
    expect(s.run("bash -c 'echo [$p2]'").out).toBe("[fyra]\n");
    s.run("set -u p2 fem");
    expect(s.run("bash -c 'echo [$p2]'; echo $p2").out).toBe("[]\nfem\n");
    s.run("set -Ux UNIV u");
    expect(s.sh.vfs.readFile("/home/elev/.config/fish/fish_variables", s.sh.rootUser())).toContain("SETUVAR --export UNIV:u\n");
    s.run("exit");
    expect(s.run("echo [$p3]").out).toBe("[]\n");
    // zsh som startas från bash får också bara miljövariablerna.
    expect(s.run("zsh -c 'echo [$vanlig] [$exp]'").out).toBe("[] [2]\n");
  });

  itNeeds(shells("echo", "seq", "test", "true", "false"), "loopar, villkor, funktioner och $status", () => {
    const s = withShells();
    s.run("fish");
    expect(s.run("for i in 1 2 3; echo $i; end").out).toBe("1\n2\n3\n");
    expect(s.run("for f in (seq 3); echo nr $f; end").out).toBe("nr 1\nnr 2\nnr 3\n");
    expect(s.run("if test -f ~/.bashrc; echo finns; else; echo saknas; end").out).toBe("finns\n");
    s.run("false");
    expect(s.run("echo $status").out).toBe("1\n");
    expect(s.run("true; and echo ja; or echo nej").out).toBe("ja\n");
    expect(s.run("false; and echo ja; or echo nej").out).toBe("nej\n");
    s.run('function hej; echo "Hej $argv!"; end');
    expect(s.run("hej Kim").out).toBe("Hej Kim!\n");
    s.run("function dubbla --argument-names tal; math $tal x 2; end");
    expect(s.run("dubbla 21").out).toBe("42\n");
    expect(s.run("math 10 / 4").out).toBe("2.5\n");
    expect(s.run("set i 0; while test $i -lt 3; set i (math $i + 1); echo $i; end").out).toBe("1\n2\n3\n");
    expect(s.run("echo $?").out).toContain("$? is not the exit status");
  });

  itNeeds(shells("echo"), "flerradiga block", () => {
    const s = withShells();
    s.run("fish");
    expect(s.run("for i in a b").incomplete).toBe(true);
    expect(s.run("echo $i").incomplete).toBe(true);
    const r = s.run("end");
    expect(r.out).toBe("a\nb\n");
    expect(r.line).toBe("for i in a b; echo $i; end");
  });

  itNeeds(shells("echo", "true"), "bash-syntax ger fel med tips, okänt kommando", () => {
    const s = withShells();
    s.run("fish");
    const r = s.run("for i in 1 2; do echo $i; done");
    expect(r.out).toContain("fish: Unknown command: do");
    expect(r.exitCode).not.toBe(0);
    expect(s.run("finnsinte").out).toBe("fish: Unknown command: finnsinte\n");
    // && and $(...) work in newer fish
    expect(s.run("true && echo ok").out).toBe("ok\n");
    expect(s.run("echo $(echo inne)").out).toBe("inne\n");
  });

  itNeeds(shells("exit"), "universella variabler sparas i fish_variables", () => {
    const s = withShells();
    s.run("fish");
    s.run('set -U fish_greeting ""');
    s.run("exit");
    expect(s.sh.vfs.readFile("/home/elev/.config/fish/fish_variables", s.sh.rootUser())).toContain("SETUVAR fish_greeting:");
    expect(s.run("fish").out).not.toContain("Welcome");
  });

  itNeeds(shells("printf", "chmod", "echo"), "skript med #!/usr/bin/fish körs av fish, bash-skript av bash", () => {
    const s = withShells();
    s.run("printf '#!/usr/bin/fish\\nset x fisk\\necho $x\\n' > ~/f.fish");
    s.run("chmod +x ~/f.fish");
    expect(s.run("~/f.fish").out).toBe("fisk\n");
    s.run("printf '#!/bin/bash\\nx=bash\\necho $x\\n' > ~/b.sh");
    s.run("chmod +x ~/b.sh");
    s.run("fish");
    expect(s.run("~/b.sh").out).toBe("bash\n");
    expect(s.run("fish -c 'echo (echo hej)'").out).toBe("hej\n");
  });

  itNeeds(["printf", "chmod"], "skript för ett skal som saknas: bad interpreter", () => {
    const s = new TestShell();
    s.run("printf '#!/usr/bin/fish\\necho hej\\n' > ~/f.fish");
    s.run("chmod +x ~/f.fish");
    const r = s.run("~/f.fish");
    expect(r.out).toContain("/usr/bin/fish: bad interpreter: No such file or directory");
    expect(r.exitCode).toBe(126);
  });

  it("fishPwd förkortar sökvägen", () => {
    const sh = new TestShell().sh;
    sh.cwd = "/home/elev/.config/fish";
    expect(ShellmodeLib.fishPwd(sh)).toBe("~/.c/fish");
    sh.cwd = "/usr/share/doc";
    expect(ShellmodeLib.fishPwd(sh)).toBe("/u/s/doc");
    sh.cwd = "/";
    expect(ShellmodeLib.fishPwd(sh)).toBe("/");
  });

  // ---------- chsh ----------

  eachNeeds(
    ["ubuntu", "arch"],
    (d) => ["zsh", "fish", "chsh", "echo", ...installer(d)],
    "byter skal i /etc/passwd",
    (d) => {
      const s = withShells(d);
      const r = s.run("chsh -s /usr/bin/zsh");
      expect(r.exitCode).toBe(0);
      expect(passwdShell(s.sh)).toBe("/usr/bin/zsh");
      if (d === "arch") expect(r.out).toContain("Shell changed.");
      // The shell in the terminal stays the same until the next login.
      expect(s.sh.shellMode).toBe("bash");
      expect(s.run("echo $SHELL").out.trim()).toBe("/bin/bash");
    },
  );

  itNeeds(["chsh"], "skal som inte finns i /etc/shells eller inte är installerade nekas", () => {
    const s = new TestShell("arch");
    expect(s.run("chsh -s /usr/bin/zsh").exitCode).toBe(1);
    expect(s.run("chsh -s zsh").out).toContain("full path");
    expect(s.run("chsh -s /usr/bin/ls").out).toContain("not listed in /etc/shells");
    expect(passwdShell(s.sh)).toBe("/bin/bash");
    expect(s.run("chsh -l").out).toContain("/bin/bash");
  });

  itNeeds(["zsh", "fish", "chsh", ...installer("debian")], "frågar efter skal utan -s, och bara root får byta åt andra", () => {
    const s = withShells("debian");
    const r = s.run("chsh");
    expect(r.pending).toBe(true);
    expect(prompt(s)).toBe("\tLogin Shell [/bin/bash]: ");
    s.run("/usr/bin/fish");
    expect(passwdShell(s.sh)).toBe("/usr/bin/fish");
    expect(s.run("chsh -s /bin/zsh root").out).toContain("You may not change the shell for 'root'");
    s.run("sudo chsh -s /bin/zsh root");
    expect(s.sh.vfs.readFile("/etc/passwd", s.sh.rootUser())).toContain("root:x:0:0:root:/root:/bin/zsh");
  });
});

