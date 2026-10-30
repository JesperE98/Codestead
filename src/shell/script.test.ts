import { describe, expect, test } from 'vitest';
import { stripAnsi } from './commands/util';
import { Shell } from './shell';

function shell(distro = 'ubuntu') {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  return { sh, run };
}

describe('variabler och expansion', () => {
  test('tilldelning delas inte upp, men ociterade variabler gör det', () => {
    const { run } = shell();
    run('x="a  b   c"');
    expect(run('echo $x').out).toBe('a b c\n');
    expect(run('echo "$x"').out).toBe('a  b   c\n');
    run('set -- ett "två tre"');
    expect(run('for a in "$@"; do echo "[$a]"; done').out).toBe('[ett]\n[två tre]\n');
  });

  test('$(...), `...` och $((...))', () => {
    const { run } = shell();
    expect(run('echo "Jag är $(whoami)"').out).toBe('Jag är elev\n');
    expect(run('echo `echo hej`').out).toBe('hej\n');
    expect(run('echo $(( 2 + 3 * 4 ))').out).toBe('14\n');
    run('antal=$(wc -l < dokument/frukter.txt)');
    expect(run('echo $antal').out).toBe('10\n');
    expect(run('echo $(( antal / 3 ))').out).toBe('3\n');
    expect(run('cd /tmp; echo $(cd /etc; pwd); pwd').out).toBe('/etc\n/tmp\n');
  });

  test('${...}-varianter', () => {
    const { run } = shell();
    run('fil=rapport.txt');
    expect(run('echo ${fil%.txt} ${#fil} ${saknas:-standard} ${fil#rap}').out).toBe('rapport 11 standard port.txt\n');
    expect(run('echo ${fil%%.*} ${fil^^}').exitCode).toBe(0);
  });
});

describe('villkor', () => {
  test('if med test och [ ]', () => {
    const { run } = shell();
    expect(run('if [ -f ~/.bashrc ]; then echo finns; else echo saknas; fi').out).toBe('finns\n');
    expect(run('if [ -d /finnsinte ]; then echo ja; elif [ 3 -gt 2 ]; then echo elif; fi').out).toBe('elif\n');
    expect(run('[ "a" = "b" ] || echo olika').out).toBe('olika\n');
    expect(run('[ 5 -lt abc ]').exitCode).toBe(2);
    expect(run('[ -z "" ] && [ -n "x" ] && echo ok').out).toBe('ok\n');
    expect(run('[[ rapport.txt == *.txt && 2 -lt 3 ]] && echo match').out).toBe('match\n');
    expect(run('test ! -e /finnsinte && echo saknas').out).toBe('saknas\n');
  });

  test('case', () => {
    const { run } = shell();
    const code = 'for f in bild.png text.txt okänd; do case $f in *.png|*.jpg) echo "$f: bild";; *.txt) echo "$f: text";; *) echo "$f: ?";; esac; done';
    expect(run(code).out).toBe('bild.png: bild\ntext.txt: text\nokänd: ?\n');
  });
});

describe('loopar', () => {
  test('for, while, until och c-stil', () => {
    const { run } = shell();
    expect(run('for i in 1 2 3; do echo "varv $i"; done').out).toBe('varv 1\nvarv 2\nvarv 3\n');
    expect(run('for f in dokument/*; do echo $f; done').out).toBe('dokument/frukter.txt\ndokument/server.log\n');
    expect(run('i=0; while [ $i -lt 3 ]; do echo $i; i=$((i+1)); done').out).toBe('0\n1\n2\n');
    expect(run('n=3; until [ $n -eq 0 ]; do echo $n; ((n--)); done').out).toBe('3\n2\n1\n');
    expect(run('for ((i=1; i<=3; i++)); do echo $i; done').out).toBe('1\n2\n3\n');
    expect(run('for i in $(seq 1 5); do [ $i -eq 2 ] && continue; [ $i -eq 4 ] && break; echo $i; done').out).toBe('1\n3\n');
  });

  test('while read rad < fil och pipe', () => {
    const { run } = shell();
    expect(run('n=0; while read rad; do n=$((n+1)); done < dokument/frukter.txt; echo $n').out).toBe('10\n');
    expect(run('grep ERROR dokument/server.log | while read datum tid niva rest; do echo "$tid $rest"; done').out).toBe(
      '09:15:10 Kunde inte ansluta till databasen\n13:30:00 Disken /var är 95% full\n18:00:00 Tidsgräns överskriden för jobbet "backup"\n',
    );
  });

  test('loopens utdata kan skickas vidare och omdirigeras', () => {
    const { run } = shell();
    expect(run('for i in 3 1 2; do echo $i; done | sort').out).toBe('1\n2\n3\n');
    run('for i in a b; do echo $i; done > loop.txt');
    expect(run('cat loop.txt').out).toBe('a\nb\n');
  });

  test('oändliga loopar stoppas', () => {
    const { run } = shell();
    const r = run('while true; do :; done');
    expect(r.out).toContain('oändlig loop');
    expect(r.exitCode).toBe(130);
    expect(run('echo fortfarande vid liv').out).toBe('fortfarande vid liv\n');
  });
});

describe('funktioner', () => {
  test('argument, return och local', () => {
    const { run, sh } = shell();
    run('halsa() { echo "Hej $1, du har $# argument"; }');
    expect(run('halsa Kim extra').out).toBe('Hej Kim, du har 2 argument\n');
    run('x=global; satt() { local x=lokal; echo $x; return 3; }');
    expect(run('satt; echo "$? $x"').out).toBe('lokal\n3 global\n');
    expect(run('type halsa').out).toBe('halsa is a function\n');
    run('unset -f halsa');
    expect(sh.functions.halsa).toBeUndefined();
  });

  test('rekursion', () => {
    const { run } = shell();
    run('fak() { if [ $1 -le 1 ]; then echo 1; else echo $(( $1 * $(fak $(( $1 - 1 ))) )); fi; }');
    expect(run('fak 5').out).toBe('120\n');
  });
});

describe('skriptfiler', () => {
  test('flerradigt skript med argument, exit och funktioner', () => {
    const { run } = shell();
    const script = [
      '#!/bin/bash',
      '# Räknar filer',
      'rakna() {',
      '  ls "$1" | wc -l',
      '}',
      'if [ $# -eq 0 ]; then',
      '  echo "Användning: $0 KATALOG"',
      '  exit 1',
      'fi',
      'for k in "$@"; do',
      '  echo "$k: $(rakna $k) filer"',
      'done',
    ].join('\n');
    run(`printf '%s\\n' '${script.replace(/'/g, "'\\''")}' > raknare.sh`);
    run('chmod +x raknare.sh');
    expect(run('./raknare.sh').out).toBe('Användning: ./raknare.sh KATALOG\n');
    expect(run('./raknare.sh; echo $?').out).toContain('\n1\n');
    expect(run('./raknare.sh dokument gammalt').out).toBe('dokument: 2 filer\ngammalt: 3 filer\n');
  });

  test('skript körs i ett underskal men source påverkar skalet', () => {
    const { run, sh } = shell();
    run("echo 'cd /tmp; X=1; f() { echo f; }' > s.sh");
    run('bash s.sh');
    expect(sh.cwd).toBe('/home/elev');
    expect(sh.env.X).toBeUndefined();
    run('source s.sh');
    expect(sh.cwd).toBe('/tmp');
    expect(sh.env.X).toBe('1');
    expect(run('f').out).toBe('f\n');
  });
});

describe('interaktivt', () => {
  test('flerradig inmatning med > -prompt', () => {
    const { run, sh } = shell();
    expect(run('for i in 1 2').incomplete).toBe(true);
    expect(sh.prompt()).toBe('> ');
    expect(run('do').incomplete).toBe(true);
    expect(run('echo $i').incomplete).toBe(true);
    const r = run('done');
    expect(r.out).toBe('1\n2\n');
    expect(r.line).toBe('for i in 1 2; do echo $i; done');
    expect(sh.history.at(-1)).toBe('for i in 1 2; do echo $i; done');
  });

  test('Ctrl+C avbryter påbörjad kod', () => {
    const { run, sh } = shell();
    run('if true; then');
    sh.cancel();
    expect(sh.prompt()).not.toBe('> ');
    expect(run('echo ok').out).toBe('ok\n');
  });

  test('read frågar användaren och fortsätter sedan raden', () => {
    const { run, sh } = shell();
    run('read -p "Vad heter du? " namn; echo "Hej $namn!"');
    expect(sh.prompt()).toBe('Vad heter du? ');
    expect(run('Kim').out).toBe('Hej Kim!\n');
  });

  test('read i skript utan indata ger ett tydligt fel', () => {
    const { run } = shell();
    run("echo 'read x; echo \"[$x]\"' > r.sh");
    expect(run('bash r.sh').out).toContain('ingen indata');
    expect(run('echo hej | bash r.sh').out).toBe('[hej]\n');
  });
});

describe('here-dokument', () => {
  test('skapa ett skript med cat << EOF, rad för rad som i terminalen', () => {
    const { run } = shell();
    expect(run("cat > hej.sh << 'SLUT'").incomplete).toBe(true);
    run('#!/bin/bash');
    run('echo "Hej $1"');
    const r = run('SLUT');
    expect(r.incomplete).toBe(false);
    expect(run('cat hej.sh').out).toBe('#!/bin/bash\necho "Hej $1"\n');
    expect(run('bash hej.sh Kim').out).toBe('Hej Kim\n');
  });

  test('variabler expanderas bara utan citattecken runt slutordet', () => {
    const { run } = shell();
    expect(run('cat << EOF\nJag är $USER\nEOF').out).toBe('Jag är elev\n');
    expect(run("cat << 'EOF'\nJag är $USER\nEOF").out).toBe('Jag är $USER\n');
    expect(run('wc -w <<< "ett två tre"').out).toBe('3\n');
  });
});

describe('printf', () => {
  test('format', () => {
    const { run } = shell();
    expect(run('printf "%-6s|%4d|%.2f\\n" ab 42 3.14159').out).toBe('ab    |  42|3.14\n');
    expect(run('printf "%s\\n" a b c').out).toBe('a\nb\nc\n');
    expect(run('printf "100%%\\n"').out).toBe('100%\n');
  });
});
