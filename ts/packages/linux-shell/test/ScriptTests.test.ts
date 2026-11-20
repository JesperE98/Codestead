// Port of tests/Linux/Codestead.Shell.Tests/ScriptTests.cs (src/shell/script.test.ts).

import { describe, expect } from "vitest";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import { Shell } from "../src/Shell/Shell.js";
import { TestShell, itNeeds } from "./TestShell.js";

describe("ScriptTests", () => {
  // ---------- variabler och expansion ----------

  itNeeds(["echo", "set"], "variabler och expansion: tilldelning delas inte upp, men ociterade variabler gör det", () => {
    const t = new TestShell();
    t.run('x="a  b   c"');
    expect(t.run("echo $x").out).toBe("a b c\n");
    expect(t.run('echo "$x"').out).toBe("a  b   c\n");
    t.run('set -- ett "två tre"');
    expect(t.run('for a in "$@"; do echo "[$a]"; done').out).toBe("[ett]\n[två tre]\n");
  });

  itNeeds(["echo", "whoami", "wc", "cd", "pwd"], "variabler och expansion: $(...), `...` och $((...))", () => {
    const t = new TestShell();
    expect(t.run('echo "Jag är $(whoami)"').out).toBe("Jag är elev\n");
    expect(t.run("echo `echo hej`").out).toBe("hej\n");
    expect(t.run("echo $(( 2 + 3 * 4 ))").out).toBe("14\n");
    t.run("antal=$(wc -l < dokument/frukter.txt)");
    expect(t.run("echo $antal").out).toBe("10\n");
    expect(t.run("echo $(( antal / 3 ))").out).toBe("3\n");
    expect(t.run("cd /tmp; echo $(cd /etc; pwd); pwd").out).toBe("/etc\n/tmp\n");
  });

  itNeeds(["echo"], "variabler och expansion: ${...}-varianter", () => {
    const t = new TestShell();
    t.run("fil=rapport.txt");
    expect(t.run("echo ${fil%.txt} ${#fil} ${saknas:-standard} ${fil#rap}").out).toBe("rapport 11 standard port.txt\n");
    expect(t.run("echo ${fil%%.*} ${fil^^}").exitCode).toBe(0);
  });

  // ---------- villkor ----------

  itNeeds(["echo", "test", "["], "villkor: if med test och [ ]", () => {
    const t = new TestShell();
    expect(t.run("if [ -f ~/.bashrc ]; then echo finns; else echo saknas; fi").out).toBe("finns\n");
    expect(t.run("if [ -d /finnsinte ]; then echo ja; elif [ 3 -gt 2 ]; then echo elif; fi").out).toBe("elif\n");
    expect(t.run('[ "a" = "b" ] || echo olika').out).toBe("olika\n");
    expect(t.run("[ 5 -lt abc ]").exitCode).toBe(2);
    expect(t.run('[ -z "" ] && [ -n "x" ] && echo ok').out).toBe("ok\n");
    expect(t.run("[[ rapport.txt == *.txt && 2 -lt 3 ]] && echo match").out).toBe("match\n");
    expect(t.run("test ! -e /finnsinte && echo saknas").out).toBe("saknas\n");
  });

  itNeeds(["echo"], "villkor: case", () => {
    const t = new TestShell();
    const code = 'for f in bild.png text.txt okänd; do case $f in *.png|*.jpg) echo "$f: bild";; *.txt) echo "$f: text";; *) echo "$f: ?";; esac; done';
    expect(t.run(code).out).toBe("bild.png: bild\ntext.txt: text\nokänd: ?\n");
  });

  // ---------- loopar ----------

  itNeeds(["echo", "[", "seq", "continue", "break"], "loopar: for, while, until och c-stil", () => {
    const t = new TestShell();
    expect(t.run('for i in 1 2 3; do echo "varv $i"; done').out).toBe("varv 1\nvarv 2\nvarv 3\n");
    expect(t.run("for f in dokument/*; do echo $f; done").out).toBe("dokument/betyg.csv\ndokument/frukter.txt\ndokument/server.log\n");
    expect(t.run("i=0; while [ $i -lt 3 ]; do echo $i; i=$((i+1)); done").out).toBe("0\n1\n2\n");
    expect(t.run("n=3; until [ $n -eq 0 ]; do echo $n; ((n--)); done").out).toBe("3\n2\n1\n");
    expect(t.run("for ((i=1; i<=3; i++)); do echo $i; done").out).toBe("1\n2\n3\n");
    expect(t.run("for i in $(seq 1 5); do [ $i -eq 2 ] && continue; [ $i -eq 4 ] && break; echo $i; done").out).toBe("1\n3\n");
  });

  itNeeds(["echo", "read", "grep"], "loopar: while read rad < fil och pipe", () => {
    const t = new TestShell();
    expect(t.run("n=0; while read rad; do n=$((n+1)); done < dokument/frukter.txt; echo $n").out).toBe("10\n");
    expect(t.run('grep ERROR dokument/server.log | while read datum tid niva rest; do echo "$tid $rest"; done').out).toBe(
      '09:15:10 Could not connect to the database\n13:30:00 Disk /var is 95% full\n18:00:00 Time limit exceeded for job "backup"\n',
    );
  });

  itNeeds(["echo", "sort", "cat"], "loopar: loopens utdata kan skickas vidare och omdirigeras", () => {
    const t = new TestShell();
    expect(t.run("for i in 3 1 2; do echo $i; done | sort").out).toBe("1\n2\n3\n");
    t.run("for i in a b; do echo $i; done > loop.txt");
    expect(t.run("cat loop.txt").out).toBe("a\nb\n");
  });

  itNeeds(["echo", "true"], "loopar: oändliga loopar stoppas", () => {
    const t = new TestShell();
    const r = t.run("while true; do :; done");
    expect(r.out).toContain("oändlig loop");
    expect(r.exitCode).toBe(130);
    expect(t.run("echo fortfarande vid liv").out).toBe("fortfarande vid liv\n");
  });

  // ---------- funktioner ----------

  itNeeds(["echo", "local", "return", "type", "unset"], "funktioner: argument, return och local", () => {
    const t = new TestShell();
    t.run('halsa() { echo "Hej $1, du har $# argument"; }');
    expect(t.run("halsa Kim extra").out).toBe("Hej Kim, du har 2 argument\n");
    t.run("x=global; satt() { local x=lokal; echo $x; return 3; }");
    expect(t.run('satt; echo "$? $x"').out).toBe("lokal\n3 global\n");
    expect(t.run("type halsa").out).toBe("halsa is a function\n");
    t.run("unset -f halsa");
    expect(t.sh.functions.has("halsa")).toBe(false);
  });

  itNeeds(["echo", "["], "funktioner: rekursion", () => {
    const t = new TestShell();
    t.run("fak() { if [ $1 -le 1 ]; then echo 1; else echo $(( $1 * $(fak $(( $1 - 1 ))) )); fi; }");
    expect(t.run("fak 5").out).toBe("120\n");
  });

  // ---------- skriptfiler ----------

  itNeeds(["echo", "printf", "chmod", "ls", "wc", "[", "exit"], "skriptfiler: flerradigt skript med argument, exit och funktioner", () => {
    const t = new TestShell();
    const script = [
      "#!/bin/bash",
      "# Räknar filer",
      "rakna() {",
      '  ls "$1" | wc -l',
      "}",
      "if [ $# -eq 0 ]; then",
      '  echo "Användning: $0 KATALOG"',
      "  exit 1",
      "fi",
      'for k in "$@"; do',
      '  echo "$k: $(rakna $k) filer"',
      "done",
    ].join("\n");
    t.run(`printf '%s\\n' '${script.replaceAll("'", "'\\''")}' > raknare.sh`);
    t.run("chmod +x raknare.sh");
    expect(t.run("./raknare.sh").out).toBe("Användning: ./raknare.sh KATALOG\n");
    expect(t.run("./raknare.sh; echo $?").out).toContain("\n1\n");
    expect(t.run("./raknare.sh dokument gammalt").out).toBe("dokument: 3 filer\ngammalt: 3 filer\n");
  });

  itNeeds(["echo", "bash", "source", "cd"], "skriptfiler: skript körs i ett underskal men source påverkar skalet", () => {
    const t = new TestShell();
    const sh = t.sh;
    t.run("echo 'cd /tmp; X=1; f() { echo f; }' > s.sh");
    t.run("bash s.sh");
    expect(sh.cwd).toBe("/home/elev");
    expect(sh.env.has("X")).toBe(false);
    t.run("source s.sh");
    expect(sh.cwd).toBe("/tmp");
    expect(sh.env.get("X")).toBe("1");
    expect(t.run("f").out).toBe("f\n");
  });

  // ---------- interaktivt ----------

  itNeeds(["echo"], "interaktivt: flerradig inmatning med > -prompt", () => {
    const t = new TestShell();
    const sh = t.sh;
    expect(t.run("for i in 1 2").incomplete).toBe(true);
    expect(sh.prompt()).toBe("> ");
    expect(t.run("do").incomplete).toBe(true);
    expect(t.run("echo $i").incomplete).toBe(true);
    const r = t.run("done");
    expect(r.out).toBe("1\n2\n");
    expect(r.line).toBe("for i in 1 2; do echo $i; done");
    expect(sh.history.at(-1)).toBe("for i in 1 2; do echo $i; done");
  });

  itNeeds(["echo", "true"], "interaktivt: Ctrl+C avbryter påbörjad kod", () => {
    const t = new TestShell();
    const sh = t.sh;
    t.run("if true; then");
    sh.cancel();
    expect(sh.prompt()).not.toBe("> ");
    expect(t.run("echo ok").out).toBe("ok\n");
  });

  itNeeds(["echo", "read"], "interaktivt: read frågar användaren och fortsätter sedan raden", () => {
    const t = new TestShell();
    t.run('read -p "Vad heter du? " namn; echo "Hej $namn!"');
    expect(t.sh.prompt()).toBe("Vad heter du? ");
    expect(t.run("Kim").out).toBe("Hej Kim!\n");
  });

  itNeeds(["echo", "read", "bash"], "interaktivt: read i skript utan indata ger ett tydligt fel", () => {
    const t = new TestShell();
    t.run("echo 'read x; echo \"[$x]\"' > r.sh");
    expect(t.run("bash r.sh").out).toContain("ingen indata");
    expect(t.run("echo hej | bash r.sh").out).toBe("[hej]\n");
  });

  // ---------- here-dokument ----------

  itNeeds(["cat", "bash"], "here-dokument: skapa ett skript med cat << EOF, rad för rad som i terminalen", () => {
    const t = new TestShell();
    expect(t.run("cat > hej.sh << 'SLUT'").incomplete).toBe(true);
    t.run("#!/bin/bash");
    t.run('echo "Hej $1"');
    const r = t.run("SLUT");
    expect(r.incomplete).toBe(false);
    expect(t.run("cat hej.sh").out).toBe('#!/bin/bash\necho "Hej $1"\n');
    expect(t.run("bash hej.sh Kim").out).toBe("Hej Kim\n");
  });

  itNeeds(["cat", "wc"], "here-dokument: variabler expanderas bara utan citattecken runt slutordet", () => {
    const t = new TestShell();
    expect(t.run("cat << EOF\nJag är $USER\nEOF").out).toBe("Jag är elev\n");
    expect(t.run("cat << 'EOF'\nJag är $USER\nEOF").out).toBe("Jag är $USER\n");
    expect(t.run('wc -w <<< "ett två tre"').out).toBe("3\n");
  });

  // ---------- miljövariabler: bara exporterade variabler når program och skript som skalet startar ----------

  itNeeds(["echo", "bash", "export"], "miljövariabler: en vanlig variabel syns inte i bash -c, en exporterad gör det", () => {
    const t = new TestShell();
    t.run("x=linux");
    expect(t.run("echo $x").out).toBe("linux\n");
    expect(t.run("bash -c 'echo [$x]'").out).toBe("[]\n");
    expect(t.run("sh -c 'echo [$x]'").out).toBe("[]\n");
    t.run("export x");
    expect(t.run("bash -c 'echo [$x]'").out).toBe("[linux]\n");
    t.run("export EDITOR=nano");
    expect(t.run("bash -c 'echo $EDITOR'").out).toBe("nano\n");
    // Det som barnet ändrar kommer inte tillbaka.
    t.run("bash -c 'x=windows; export NY=1'");
    expect(t.run("echo $x [$NY]").out).toBe("linux []\n");
    // Skalets funktioner följer inte heller med.
    t.run("hej() { echo hej; }");
    expect(t.run("bash -c hej").out).toBe("bash: hej: command not found\n");
  });

  itNeeds(["echo", "bash"], "miljövariabler: NAMN=värde kommando exporterar bara till det kommandot", () => {
    const t = new TestShell();
    expect(t.run("z=5 bash -c 'echo [$z]'").out).toBe("[5]\n");
    expect(t.run("echo [$z]").out).toBe("[]\n");
    expect(t.run("bash -c 'echo [$z]'").out).toBe("[]\n");
    // En vanlig variabel som finns sedan innan är fortfarande inte exporterad efteråt.
    t.run("y=1");
    expect(t.run("y=2 bash -c 'echo [$y]'").out).toBe("[2]\n");
    expect(t.run("echo $y; bash -c 'echo [$y]'").out).toBe("1\n[]\n");
    // Och env NAMN=värde kommando gör samma sak.
    expect(t.run("env A=1 B=2 bash -c 'echo $A$B'").out).toBe("12\n");
    expect(t.run("env -i bash -c 'echo [$HOME]'").out).toBe("[]\n");
  });

  itNeeds(["echo", "bash", "export", "unset"], "miljövariabler: export -n, export utan värde och unset", () => {
    const t = new TestShell();
    t.run("export y=1");
    t.run("export -n y");
    expect(t.run("bash -c 'echo [$y]'; echo $y").out).toBe("[]\n1\n");
    // export NAMN innan variabeln har ett värde: den exporteras när den får ett.
    t.run("export q");
    expect(t.run("export -p | grep ' q'").out).toBe("declare -x q\n");
    t.run("q=3");
    expect(t.run("bash -c 'echo [$q]'").out).toBe("[3]\n");
    // unset tar bort exporten också.
    t.run("unset q");
    t.run("q=4");
    expect(t.run("bash -c 'echo [$q]'").out).toBe("[]\n");
    expect(t.run("export -z").exitCode).toBe(2);
    // export i ett delskal ( ... ) stannar där.
    t.run("(export sub=1)");
    expect(t.run("bash -c 'echo [$sub]'").out).toBe("[]\n");
  });

  itNeeds(["env", "printenv", "set", "export", "grep"], "miljövariabler: env och printenv visar bara exporterade, set visar alla", () => {
    const t = new TestShell();
    t.run("vanlig=1");
    t.run("export EXPORTERAD=2");
    expect(t.run("env | grep -c vanlig").out).toBe("0\n");
    expect(t.run("env | grep EXPORTERAD").out).toBe("EXPORTERAD=2\n");
    expect(t.run("printenv vanlig").exitCode).toBe(1);
    expect(t.run("printenv EXPORTERAD").out).toBe("2\n");
    expect(t.run("printenv | grep -c vanlig").out).toBe("0\n");
    expect(t.run("set | grep -E '^(vanlig|EXPORTERAD)='").out).toBe("EXPORTERAD=2\nvanlig=1\n");
    expect(t.run("export -p | grep -E 'vanlig|EXPORTERAD'").out).toBe('declare -x EXPORTERAD="2"\n');
    // Inloggningsmiljön är exporterad från början.
    expect(t.run("env | grep -E '^(HOME|USER|PATH|LANG)='").out).toBe(
      "HOME=/home/elev\nLANG=sv_SE.UTF-8\nPATH=/usr/local/bin:/usr/bin:/bin\nUSER=elev\n",
    );
  });

  itNeeds(["echo", "printf", "chmod", "source"], "miljövariabler: ./skript.sh ser bara exporterade, . skript.sh ser allt", () => {
    const t = new TestShell();
    t.run("printf '#!/bin/bash\\necho \"v=[$vanlig] e=[$exp]\"\\nvanlig=ändrad\\n' > x.sh");
    t.run("printf 'echo \"v=[$vanlig] e=[$exp]\"\\n' > utan-shebang.sh");
    t.run("chmod +x x.sh utan-shebang.sh");
    t.run("vanlig=1; export exp=2");
    expect(t.run("./x.sh").out).toBe("v=[] e=[2]\n");
    expect(t.run("./utan-shebang.sh").out).toBe("v=[] e=[2]\n");
    expect(t.run("bash x.sh").out).toBe("v=[] e=[2]\n");
    expect(t.run("echo $vanlig").out).toBe("1\n");
    expect(t.run(". ./x.sh").out).toBe("v=[1] e=[2]\n");
    expect(t.run("echo $vanlig").out).toBe("ändrad\n");
    expect(t.run("source ./x.sh").out).toBe("v=[ändrad] e=[2]\n");
  });

  itNeeds(["echo", "bash"], "miljövariabler: terminaler sparade innan exporten fanns har allt exporterat", () => {
    const t = new TestShell();
    t.run("gammal=1");
    const json = JSON.parse(t.sh.snapshotJson()) as Record<string, unknown>;
    delete json["exported"];
    const sh = Shell.restoreJson(JSON.stringify(json))!;
    expect(UtilCmd.stripAnsi(sh.execute("bash -c 'echo [$gammal]'").output)).toBe("[1]\n");
    sh.execute("ny=2");
    expect(UtilCmd.stripAnsi(sh.execute("bash -c 'echo [$ny]'").output)).toBe("[]\n");
    // Och exporten sparas med terminalen.
    sh.execute("export ny");
    const again = Shell.restoreJson(sh.snapshotJson())!;
    expect(UtilCmd.stripAnsi(again.execute("bash -c 'echo [$ny]'; ny2=3; bash -c 'echo [$ny2]'").output)).toBe("[2]\n[]\n");
  });

  // ---------- printf ----------

  itNeeds(["printf"], "printf: format", () => {
    const t = new TestShell();
    expect(t.run('printf "%-6s|%4d|%.2f\\n" ab 42 3.14159').out).toBe("ab    |  42|3.14\n");
    expect(t.run('printf "%s\\n" a b c').out).toBe("a\nb\nc\n");
    expect(t.run('printf "100%%\\n"').out).toBe("100%\n");
  });
});
