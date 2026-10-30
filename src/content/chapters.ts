// Alla kapitel och deras uppgifter.
// Texten finns i chapters/*.md, uppgifterna och deras kontroller här.

import { gunzipString, readArchive } from '../shell/commands/archive';
import type { Distro, Family } from '../shell/distros';
import type { Chapter, CheckCtx, Part } from './types';

import { RUNAWAY_PID, SERVER_PID } from '../shell/procs';
import { findGroup, findUser, shadowHash } from '../shell/users';

const HOME = '/home/elev';

// ---------- Hjälpfunktioner för kontrollerna ----------

const node = (c: CheckCtx, p: string) => c.sh.vfs.tryLookup(p.replace(/^~/, HOME), c.sh.rootUser());
const isFile = (c: CheckCtx, p: string) => node(c, p)?.type === 'file';
const isDir = (c: CheckCtx, p: string) => node(c, p)?.type === 'dir';
const exists = (c: CheckCtx, p: string) => node(c, p) !== null;
const content = (c: CheckCtx, p: string) => node(c, p)?.content ?? '';
/** Raden matchar och kommandot lyckades. */
const ran = (c: CheckCtx, re: RegExp) => c.exitCode === 0 && re.test(c.line);
const outLines = (c: CheckCtx) => c.output.split('\n').filter((l) => l.trim() !== '');
/** Raden utan ett inledande "sudo". */
const unsudo = (line: string) => line.replace(/^sudo\s+(-\S+\s+)*/, '');

const byFamily = <T,>(map: Record<Family, T>) => (d: Distro) => map[d.family];

/** Sant om filen är ett arkiv (tar, tar.gz eller zip) av rätt sort som innehåller en fil vars sökväg slutar på `suffix`. */
const archiveHas = (c: CheckCtx, p: string, format: 'tar' | 'tar.gz' | 'zip', suffix: string) => {
  const a = readArchive(content(c, p));
  return a?.format === format && a.entries.some((e) => e.path === suffix || e.path.endsWith('/' + suffix));
};
/** Vilka tar-operationer (c, x, t) kommandoraden innehåller, t.ex. "x" för `cd ~ && tar -xzf a.tgz`. */
const tarOps = (line: string) =>
  line
    .split(/&&|\|\||[;|]/)
    .map((part) => unsudo(part.trim()).split(/\s+/))
    .filter((words) => words[0] === 'tar')
    .flatMap((words) =>
      words.slice(1).map((w, i) => {
        if (w.startsWith('--')) return { '--create': 'c', '--extract': 'x', '--get': 'x', '--list': 't' }[w] ?? '';
        return w.startsWith('-') || i === 0 ? w.replace(/[^cxt]/g, '') : '';
      }),
    )
    .join('');

export const PARTS: Part[] = [
  { id: 'start', title: 'Kom igång' },
  { id: 'grunder', title: 'Grunderna' },
  { id: 'system', title: 'Systemet' },
  { id: 'admin', title: 'Systemadministration' },
  { id: 'natverk', title: 'Nätverk' },
  { id: 'distro', title: 'Distributioner och paket' },
  { id: 'skript', title: 'Skript och automatisering' },
  { id: 'verktyg', title: 'Fler verktyg' },
];

export const CHAPTERS: Chapter[] = [
  {
    id: 'valkommen',
    part: 'start',
    title: 'Välkommen till Linux-shell',
    tasks: [
      {
        id: 'echo',
        text: 'Skriv ut texten `Hej världen` med `echo`.',
        solution: ['echo Hej världen'],
        check: (c) => ran(c, /^echo\b/) && /hej,?\s+världen/i.test(c.output),
      },
      {
        id: 'whoami',
        text: 'Ta reda på vilken användare du är inloggad som, med `whoami`.',
        solution: ['whoami'],
        check: (c) => ran(c, /^whoami\s*$/),
      },
      {
        id: 'os-release',
        text: 'Visa vilken distribution du kör med `cat /etc/os-release`.',
        solution: ['cat /etc/os-release'],
        check: (c) => ran(c, /^cat\s+\/etc\/os-release\s*$/),
      },
      {
        id: 'help',
        text: 'Lista alla kommandon som finns i simulatorn med `help`.',
        solution: ['help'],
        check: (c) => ran(c, /^help\b/),
      },
    ],
  },
  {
    id: 'navigera',
    part: 'grunder',
    title: 'Navigera i filsystemet',
    tasks: [
      {
        id: 'etc',
        text: 'Gå till katalogen `/etc` och lista vad som finns där.',
        hint: 'Två kommandon: först `cd`, sedan `ls`. Du kan också skriva dem på samma rad: `cd /etc && ls`.',
        solution: ['cd /etc', 'ls'],
        check: (c) => ran(c, /(^|[;&|]\s*)ls(\s|$)/) && c.sh.cwd === '/etc',
      },
      {
        id: 'hidden',
        text: 'Visa de dolda filerna i din hemkatalog.',
        hint: 'Flaggan `-a` visar filer som börjar med punkt. Din hemkatalog är `~`.',
        solution: ['ls -a ~'],
        check: (c) => ran(c, /^ls\b.*\s-\w*[aA]/) && (c.sh.cwd === HOME || /\s(~\/?|\/home\/elev\/?)(\s|$)/.test(c.line)),
      },
      {
        id: 'relative',
        text: 'Ställ dig i roten (`/`) och gå sedan till `/var/log` med en **relativ** sökväg.',
        hint: 'En relativ sökväg börjar inte med `/`. Står du i `/` räcker `cd var/log`.',
        solution: ['cd /', 'cd var/log'],
        check: (c) => c.sh.cwd === '/var/log' && /(^|[;&]\s*)cd\s+(\.\/)?var\/log\/?\s*$/.test(c.line),
      },
      {
        id: 'up',
        text: 'Gå upp en nivå med `cd ..`.',
        solution: ['cd ..'],
        check: (c) => ran(c, /^cd\s+\.\.\/?\s*$/),
      },
      {
        id: 'home',
        text: 'Gå tillbaka till din hemkatalog med bara `cd`, utan argument.',
        solution: ['cd'],
        check: (c) => c.line === 'cd' && c.sh.cwd === HOME,
      },
    ],
  },
  {
    id: 'filer',
    part: 'grunder',
    title: 'Filer och kataloger',
    tasks: [
      {
        id: 'mkdir',
        text: 'Skapa katalogen `~/projekt/src` med **ett** kommando.',
        hint: '`mkdir` behöver flaggan `-p` för att skapa `projekt` och `src` på en gång.',
        solution: ['mkdir -p ~/projekt/src'],
        check: (c) => isDir(c, '~/projekt/src'),
      },
      {
        id: 'touch',
        text: 'Skapa en tom fil som heter `~/projekt/README.md`.',
        solution: ['touch ~/projekt/README.md'],
        check: (c) => isFile(c, '~/projekt/README.md'),
      },
      {
        id: 'cp',
        text: 'Kopiera `~/anteckningar.txt` till katalogen `~/projekt/`.',
        solution: ['cp ~/anteckningar.txt ~/projekt/'],
        check: (c) => isFile(c, '~/projekt/anteckningar.txt') && isFile(c, '~/anteckningar.txt'),
      },
      {
        id: 'mv',
        text: 'Byt namn på `~/projekt/anteckningar.txt` till `~/projekt/att-gora.txt`.',
        hint: 'Att byta namn är samma sak som att flytta – använd `mv`.',
        solution: ['mv ~/projekt/anteckningar.txt ~/projekt/att-gora.txt'],
        check: (c) => isFile(c, '~/projekt/att-gora.txt') && !exists(c, '~/projekt/anteckningar.txt'),
      },
      {
        id: 'rm',
        text: 'Ta bort katalogen `~/gammalt` och allt som finns i den.',
        hint: 'Katalogen är inte tom, så `rmdir` räcker inte. Använd `rm -r`.',
        solution: ['rm -r ~/gammalt'],
        check: (c) => !exists(c, '~/gammalt'),
      },
    ],
  },
  {
    id: 'lasa-text',
    part: 'grunder',
    title: 'Läsa och söka i text',
    tasks: [
      {
        id: 'head',
        text: 'Visa de **3 första** raderna i `~/dokument/server.log`.',
        solution: ['head -n 3 ~/dokument/server.log'],
        check: (c) => ran(c, /^head\b/) && outLines(c).length === 3 && c.output.includes('Servern startar'),
      },
      {
        id: 'tail',
        text: 'Visa de **2 sista** raderna i `~/dokument/server.log`.',
        solution: ['tail -n 2 ~/dokument/server.log'],
        check: (c) => ran(c, /^tail\b/) && outLines(c).length === 2 && c.output.includes('roteras'),
      },
      {
        id: 'grep',
        text: 'Visa alla rader som innehåller `ERROR` i `~/dokument/server.log`.',
        solution: ['grep ERROR ~/dokument/server.log'],
        check: (c) => ran(c, /^grep\b/) && outLines(c).length === 3 && outLines(c).every((l) => l.includes('ERROR')),
      },
      {
        id: 'grep-i',
        text: 'Sök efter `warn` i server.log **utan** att bry dig om stora eller små bokstäver.',
        hint: 'Flaggan `-i` gör sökningen skiftlägesokänslig. Det ska bli 3 träffar.',
        solution: ['grep -i warn ~/dokument/server.log'],
        check: (c) => ran(c, /^grep\b.*\s-\w*i/) && /warn/i.test(c.line) && (outLines(c).length === 3 || c.output.trim() === '3'),
      },
      {
        id: 'wc',
        text: 'Räkna hur många rader `~/dokument/frukter.txt` har.',
        solution: ['wc -l ~/dokument/frukter.txt'],
        check: (c) => ran(c, /\bwc\b.*-\w*l/) && /\b10\b/.test(c.output),
      },
      {
        id: 'sort',
        text: 'Visa frukterna i `~/dokument/frukter.txt` i bokstavsordning.',
        solution: ['sort ~/dokument/frukter.txt'],
        check: (c) => ran(c, /\bsort\b/) && /frukter/.test(c.line) && outLines(c)[0] === 'apelsin',
      },
    ],
  },
  {
    id: 'pipes',
    part: 'grunder',
    title: 'Omdirigering och pipes',
    tasks: [
      {
        id: 'redirect',
        text: 'Skriv texten `Hej från shell` till filen `~/hej.txt` med `echo` och `>`.',
        solution: ['echo "Hej från shell" > ~/hej.txt'],
        check: (c) => content(c, '~/hej.txt').includes('Hej från shell'),
      },
      {
        id: 'append',
        text: 'Lägg till en rad till i `~/hej.txt` – utan att skriva över den första.',
        hint: 'Använd `>>` i stället för `>`.',
        solution: ['echo "En rad till" >> ~/hej.txt'],
        check: (c) => {
          const lines = content(c, '~/hej.txt').split('\n').filter(Boolean);
          return lines.length >= 2 && lines[0].includes('Hej från shell');
        },
      },
      {
        id: 'count-errors',
        text: 'Räkna antalet rader med `ERROR` i server.log genom att skicka `grep` vidare till `wc -l` med en pipe.',
        solution: ['grep ERROR ~/dokument/server.log | wc -l'],
        check: (c) => ran(c, /grep.*\|\s*wc\s+-l/) && c.output.trim() === '3',
      },
      {
        id: 'uniq',
        text: 'Visa hur många gånger varje frukt förekommer i `frukter.txt`, med `sort` och `uniq -c`.',
        solution: ['sort ~/dokument/frukter.txt | uniq -c'],
        check: (c) => ran(c, /sort.*\|\s*uniq\s+-c/) && /3 äpple/.test(c.output),
      },
      {
        id: 'save-ls',
        text: 'Spara en lista över filerna i `/etc` i filen `~/etc-filer.txt`.',
        solution: ['ls /etc > ~/etc-filer.txt'],
        check: (c) => content(c, '~/etc-filer.txt').includes('os-release'),
      },
      {
        id: 'devnull',
        text: 'Kör `ls /finnsinte`, men skicka felmeddelandet till `/dev/null` så att inget syns.',
        solution: ['ls /finnsinte 2> /dev/null'],
        check: (c) => /^ls\s+\/finnsinte\b.*2>\s*\/dev\/null/.test(c.line) && c.output.trim() === '',
      },
    ],
  },
  {
    id: 'textbearbetning',
    part: 'grunder',
    title: 'Textbearbetning med sed, tr och awk',
    tasks: [
      {
        id: 'sed-s',
        text: 'Visa `~/dokument/server.log` med ordet `ERROR` utbytt mot `FEL` på alla rader, med `sed`.',
        hint: "Kommandot `s/gammalt/nytt/` byter ut text: `sed 's/ERROR/FEL/' fil`",
        solution: ["sed 's/ERROR/FEL/' ~/dokument/server.log"],
        check: (c) =>
          ran(c, /^sed\b/) && outLines(c).length === 15 && /FEL Kunde inte ansluta/.test(c.output) && !c.output.includes('ERROR'),
      },
      {
        id: 'sed-d',
        text: 'Visa server.log **utan** alla rader som innehåller `INFO`, med `sed`.',
        hint: "Adressen `/INFO/` väljer raderna och kommandot `d` tar bort dem: `sed '/INFO/d' fil`",
        solution: ["sed '/INFO/d' ~/dokument/server.log"],
        check: (c) => ran(c, /^sed\b/) && outLines(c).length === 6 && !c.output.includes('INFO'),
      },
      {
        id: 'tr-upper',
        text: 'Skriv ut alla användarnamn i `/etc/passwd` med **versaler**: plocka ut fält 1 med `cut` och skicka vidare till `tr`.',
        hint: '`cut -d: -f1 /etc/passwd` ger användarnamnen. Lägg till `| tr a-z A-Z`.',
        solution: ['cut -d: -f1 /etc/passwd | tr a-z A-Z'],
        check: (c) => ran(c, /\|\s*tr\b/) && outLines(c).includes('ROOT') && outLines(c).includes('ELEV'),
      },
      {
        id: 'tr-path',
        text: 'Visa katalogerna i `$PATH` på **varsin rad** genom att byta `:` mot radbrytning med `tr`.',
        hint: "Radbrytning skrivs `\\n`: `echo $PATH | tr ':' '\\n'`",
        solution: ["echo $PATH | tr ':' '\\n'"],
        check: (c) => ran(c, /\btr\b/) && outLines(c).length >= 2 && outLines(c).includes('/usr/bin'),
      },
      {
        id: 'awk-print',
        text: 'Skriv ut användarnamn och skal (fält 1 och 7) ur `/etc/passwd` med `awk`.',
        hint: "Fälten skiljs åt av kolon, så använd `-F:`. Programmet blir `'{print $1, $7}'`.",
        solution: ["awk -F: '{print $1, $7}' /etc/passwd"],
        check: (c) =>
          ran(c, /^awk\b/) && outLines(c).some((l) => /^elev\b.*\/bin\/bash$/.test(l) && !l.includes('1000')),
      },
      {
        id: 'awk-sum',
        text: 'Räkna ut **summan** av poängen (kolumn 3) i `~/dokument/betyg.csv` med `awk`.',
        hint: "Hoppa över rubrikraden med `NR > 1`, lägg ihop med `summa += $3` och skriv ut i `END { }`. Avgränsaren är komma: `-F,`.",
        solution: ["awk -F, 'NR > 1 {summa += $3} END {print summa}' ~/dokument/betyg.csv"],
        check: (c) => ran(c, /\bawk\b/) && /(^|\D)590(\D|$)/.test(c.output),
      },
      {
        id: 'sed-i',
        text: 'Byt ut `Linux` mot `GNU/Linux` **direkt i filen** `~/anteckningar.txt`.',
        hint: "Använd `sed -i`. Eftersom ersättningen innehåller `/` är det enklast att byta avgränsare: `s|Linux|GNU/Linux|`.",
        solution: ["sed -i 's|Linux|GNU/Linux|' ~/anteckningar.txt"],
        check: (c) =>
          c.exitCode === 0 && /^sed\b.*\s-\w*i/.test(unsudo(c.line)) && content(c, '~/anteckningar.txt').includes('GNU/Linux'),
      },
    ],
  },
  {
    id: 'miljo',
    part: 'system',
    title: 'Variabler, PATH och alias',
    tasks: [
      {
        id: 'path',
        text: 'Visa innehållet i variabeln `PATH`.',
        solution: ['echo $PATH'],
        check: (c) => ran(c, /^(echo|printenv)\b.*PATH/) && c.output.includes('/usr/bin'),
      },
      {
        id: 'export',
        text: 'Skapa miljövariabeln `FAVORIT` med värdet `linux`.',
        hint: 'Inga mellanslag runt likhetstecknet: `export NAMN=värde`.',
        solution: ['export FAVORIT=linux'],
        check: (c) => c.sh.env.FAVORIT === 'linux',
      },
      {
        id: 'which',
        text: 'Ta reda på i vilken katalog programmet `ls` ligger.',
        solution: ['which ls'],
        check: (c) => ran(c, /^(which|type)\s+ls\b/) && c.output.includes('/usr/bin/ls'),
      },
      {
        id: 'alias',
        text: 'Skapa aliaset `ll` som kör `ls -la`.',
        solution: ["alias ll='ls -la'"],
        check: (c) => /^ls\s+-(la|al)$/.test(c.sh.aliases.ll ?? ''),
      },
      {
        id: 'exitcode',
        text: 'Kör ett kommando som misslyckas, och visa sedan dess slutkod med `echo $?`.',
        hint: 'Prova `ls /finnsinte` följt av `echo $?`. Slutkoden ska inte vara 0.',
        solution: ['ls /finnsinte', 'echo $?'],
        check: (c) => /(^|[;&]\s*)echo\s+"?\$\?"?\s*$/.test(c.line) && /^[1-9]\d*$/.test(c.output.trim()),
      },
    ],
  },
  {
    id: 'rattigheter',
    part: 'system',
    title: 'Användare, rättigheter och sudo',
    tasks: [
      {
        id: 'groups',
        text: 'Ta reda på vilka grupper du tillhör.',
        solution: ['groups'],
        check: (c) => ran(c, /^(groups|id)\b/),
      },
      {
        id: 'shadow',
        text: 'Försök läsa `/etc/shadow` med `cat` – och gör det sedan med `sudo`.',
        solution: ['cat /etc/shadow', 'sudo cat /etc/shadow'],
        check: (c) => ran(c, /^sudo\s+(cat|less|head|tail)\s+\/etc\/shadow\s*$/),
      },
      {
        id: 'script',
        text: 'Skapa skriptet `~/hej.sh` som innehåller raden `echo Hej från mitt skript`.',
        hint: "Använd enkla citattecken: `echo 'echo Hej från mitt skript' > ~/hej.sh`",
        solution: ["echo 'echo Hej från mitt skript' > ~/hej.sh"],
        check: (c) => /echo\s+.*Hej från mitt skript/.test(content(c, '~/hej.sh')),
      },
      {
        id: 'chmod-x',
        text: 'Gör `~/hej.sh` körbart.',
        solution: ['chmod +x ~/hej.sh'],
        check: (c) => ((node(c, '~/hej.sh')?.mode ?? 0) & 0o100) !== 0,
      },
      {
        id: 'run-script',
        text: 'Kör skriptet med `./hej.sh` (stå i hemkatalogen).',
        solution: ['cd ~', './hej.sh'],
        check: (c) => ran(c, /(\.\/|~\/|\/home\/elev\/)hej\.sh\s*$/) && c.output.includes('Hej från mitt skript'),
      },
      {
        id: 'chmod-600',
        text: 'Gör `~/anteckningar.txt` läsbar och skrivbar **bara** för dig (`rw-------`).',
        hint: 'r = 4, w = 2, x = 1. Ägaren ska ha 4 + 2 och övriga 0.',
        solution: ['chmod 600 ~/anteckningar.txt'],
        check: (c) => ((node(c, '~/anteckningar.txt')?.mode ?? 0) & 0o777) === 0o600,
      },
    ],
  },
  {
    id: 'processer',
    part: 'system',
    title: 'Processer och jobb',
    tasks: [
      {
        id: 'ps',
        text: 'Visa processerna i din egen terminal med `ps`.',
        solution: ['ps'],
        check: (c) => ran(c, /^ps\s*$/),
      },
      {
        id: 'ps-aux',
        text: 'Lista **alla** processer på datorn.',
        hint: '`ps aux` (eller `ps -ef`).',
        solution: ['ps aux'],
        check: (c) => ran(c, /^ps\s+(-?aux|-ef|-e|-A)\b/) && c.output.includes('/sbin/init'),
      },
      {
        id: 'hitta',
        text: 'En process slukar nästan all CPU. Visa processerna sorterade efter CPU-användning så att du ser vad den heter.',
        hint: '`top`, `htop` eller `ps aux --sort=-%cpu`.',
        solution: ['ps aux --sort=-%cpu'],
        check: (c) => ran(c, /^(top|htop)\b|^ps\b.*--sort[= ]-?%?(cpu|pcpu)/) && c.output.includes(String(RUNAWAY_PID)),
      },
      {
        id: 'kill',
        text: `Stoppa den skenande processen (PID ${RUNAWAY_PID}) med \`kill\`.`,
        solution: [`kill ${RUNAWAY_PID}`],
        check: (c) => !c.sh.proc.procs.some((p) => p.pid === RUNAWAY_PID),
      },
      {
        id: 'bakgrund',
        text: 'Starta `sleep 300` i bakgrunden.',
        hint: 'Sätt `&` sist på raden.',
        solution: ['sleep 300 &'],
        check: (c) => c.sh.proc.jobs.some((j) => j.state === 'Running' && /^sleep\s+300\b/.test(j.cmd)),
      },
      {
        id: 'jobs',
        text: 'Visa dina bakgrundsjobb.',
        solution: ['jobs'],
        check: (c) => ran(c, /^jobs\b/) && c.output.includes('sleep'),
      },
      {
        id: 'kill-jobb',
        text: 'Avsluta bakgrundsjobbet med `kill` och jobbnumret (`%1`) eller dess PID.',
        solution: ['kill %1'],
        check: (c) => ran(c, /^kill\b/) && /Terminated|Killed/.test(c.output),
      },
      {
        id: 'server',
        text: 'Servern `minserver` körs som root. Stoppa den – med `pkill` eller `kill` och rätt behörighet.',
        hint: 'Som vanlig användare får du "Operation not permitted". Sätt `sudo` framför.',
        solution: ['sudo pkill minserver'],
        check: (c) => !c.sh.proc.procs.some((p) => p.pid === SERVER_PID),
      },
    ],
  },
  {
    id: 'arkiv',
    part: 'system',
    title: 'Arkiv och komprimering',
    tasks: [
      {
        id: 'tar-czf',
        text: 'Packa ihop katalogen `~/dokument` till det komprimerade arkivet `~/dokument.tar.gz`.',
        hint: 'Stå i hemkatalogen och använd *create zipped verbose file*: `tar -czvf dokument.tar.gz dokument`.',
        solution: ['cd ~', 'tar -czvf dokument.tar.gz dokument'],
        check: (c) => archiveHas(c, '~/dokument.tar.gz', 'tar.gz', 'dokument/frukter.txt'),
      },
      {
        id: 'tar-t',
        text: 'Lista innehållet i `~/dokument.tar.gz` – utan att packa upp det.',
        hint: '`t` betyder lista: `tar -tzvf ~/dokument.tar.gz`.',
        solution: ['tar -tzvf ~/dokument.tar.gz'],
        check: (c) => ran(c, /\btar\b/) && tarOps(c.line) === 't' && c.output.includes('dokument/server.log'),
      },
      {
        id: 'tar-x',
        text: 'Skapa katalogen `~/uppackat` och packa upp `~/dokument.tar.gz` i den.',
        hint: 'Med `-C` väljer du var tar packar upp: `tar -xzvf ~/dokument.tar.gz -C ~/uppackat`.',
        solution: ['mkdir ~/uppackat', 'tar -xzvf ~/dokument.tar.gz -C ~/uppackat'],
        check: (c) => tarOps(c.line).includes('x') && isFile(c, '~/uppackat/dokument/frukter.txt'),
      },
      {
        id: 'gzip',
        text: 'Kopiera `~/dokument/server.log` till din hemkatalog och komprimera kopian med `gzip`, så att du får `~/server.log.gz`.',
        hint: 'Först `cp ~/dokument/server.log ~`, sedan `gzip ~/server.log`.',
        solution: ['cp ~/dokument/server.log ~', 'gzip -v ~/server.log'],
        check: (c) => gunzipString(content(c, '~/server.log.gz'))?.d.includes('Servern startar') ?? false,
      },
      {
        id: 'zcat',
        text: 'Visa raderna med `ERROR` i `~/server.log.gz` – utan att packa upp filen.',
        hint: '`zcat` skriver ut innehållet i en .gz-fil. Skicka det vidare till `grep` med en pipe.',
        solution: ['zcat ~/server.log.gz | grep ERROR'],
        check: (c) =>
          ran(c, /\bzcat\b|\bgunzip\s+-\w*c|\bgzip\s+-\w*(d\w*c|c\w*d)/) &&
          isFile(c, '~/server.log.gz') &&
          ((outLines(c).length === 3 && outLines(c).every((l) => l.includes('ERROR'))) || c.output.trim() === '3'),
      },
      {
        id: 'zip',
        perFamily: true,
        text: 'Installera paketen `zip` och `unzip`, och packa sedan ihop `~/dokument` till `~/dokument.zip`.',
        hint: byFamily({
          debian: 'Kör `sudo apt update` och `sudo apt install zip unzip`. Glöm inte `-r` till zip: `zip -r dokument.zip dokument`.',
          arch: 'Installera med `sudo pacman -S zip unzip`. Glöm inte `-r` till zip: `zip -r dokument.zip dokument`.',
          redhat: 'Installera med `sudo dnf install zip unzip` och svara `y`. Glöm inte `-r` till zip: `zip -r dokument.zip dokument`.',
        }),
        solution: byFamily({
          debian: ['sudo apt update', 'sudo apt install zip unzip', 'cd ~', 'zip -r dokument.zip dokument'],
          arch: ['sudo pacman -S zip unzip', 'y', 'cd ~', 'zip -r dokument.zip dokument'],
          redhat: ['sudo dnf install zip unzip', 'y', 'cd ~', 'zip -r dokument.zip dokument'],
        }),
        check: (c) => archiveHas(c, '~/dokument.zip', 'zip', 'dokument/frukter.txt'),
      },
      {
        id: 'unzip',
        text: 'Packa upp `~/dokument.zip` i den nya katalogen `~/fran-zip` med `unzip`.',
        hint: '`-d` väljer katalog och skapar den om den saknas: `unzip ~/dokument.zip -d ~/fran-zip`.',
        solution: ['unzip ~/dokument.zip -d ~/fran-zip'],
        check: (c) =>
          /\bunzip\b/.test(c.line) &&
          (isFile(c, '~/fran-zip/dokument/frukter.txt') || isFile(c, '~/fran-zip/home/elev/dokument/frukter.txt')),
      },
    ],
  },
  {
    id: 'distributioner',
    part: 'distro',
    title: 'Distributioner och familjer',
    tasks: [
      {
        id: 'os-release',
        perFamily: true,
        text: 'Ta reda på namnet och versionen på distributionen du kör.',
        solution: ['cat /etc/os-release'],
        check: (c) => ran(c, /\/etc\/os-release/),
      },
      {
        id: 'kernel',
        perFamily: true,
        text: 'Visa vilken version av Linuxkärnan som körs.',
        solution: ['uname -r'],
        check: (c) => ran(c, /^uname\s+-\w*[ra]/),
      },
      {
        id: 'pm-config',
        perFamily: true,
        text: byFamily({
          debian: 'Titta på vilka förråd apt använder i `/etc/apt/sources.list.d/`.',
          arch: 'Titta på pacmans inställningar i `/etc/pacman.conf`.',
          redhat: 'Titta på vilka förråd dnf använder i `/etc/yum.repos.d/`.',
        }),
        solution: byFamily({
          debian: ['ls /etc/apt/sources.list.d'],
          arch: ['cat /etc/pacman.conf'],
          redhat: ['ls /etc/yum.repos.d'],
        }),
        check: (c) => {
          const re = { debian: /\/etc\/apt\b/, arch: /\/etc\/pacman/, redhat: /\/etc\/(yum\.repos\.d|dnf)\b/ }[c.distro.family];
          return ran(c, /^(ls|cat|less|head|tail|tree|find)\b/) && re.test(c.line);
        },
      },
    ],
  },
  {
    id: 'pakethantering',
    part: 'distro',
    title: 'Pakethantering',
    tasks: [
      {
        id: 'sync',
        perFamily: true,
        text: byFamily({
          debian: 'Hämta de senaste paketlistorna med `apt update`.',
          arch: 'Synkronisera paketdatabasen och uppgradera systemet med `pacman -Syu`.',
          redhat: 'Hämta ny paketinformation och se om det finns uppdateringar med `dnf check-update`.',
        }),
        hint: byFamily({
          debian: 'Kommandot ändrar systemet och kräver root: `sudo apt update`.',
          arch: 'Kommandot ändrar systemet och kräver root: `sudo pacman -Syu`.',
          redhat: '`dnf check-update` behöver inte root.',
        }),
        solution: byFamily({
          debian: ['sudo apt update'],
          arch: ['sudo pacman -Syu', 'y'],
          redhat: ['dnf check-update'],
        }),
        check: (c) => !!c.sh.flags.repoSynced,
      },
      {
        id: 'search',
        perFamily: true,
        text: 'Sök efter paketet `htop`.',
        hint: byFamily({
          debian: '`apt search htop`',
          arch: '`pacman -Ss htop`',
          redhat: '`dnf search htop`',
        }),
        solution: byFamily({
          debian: ['apt search htop'],
          arch: ['pacman -Ss htop'],
          redhat: ['dnf search htop'],
        }),
        check: (c) => {
          const re = {
            debian: /^apt(-cache)?\s+search\s+.*htop/,
            arch: /^pacman\s+-Ss\w*\s+.*htop/,
            redhat: /^dnf5?\s+search\s+.*htop/,
          }[c.distro.family];
          return c.exitCode === 0 && re.test(unsudo(c.line));
        },
      },
      {
        id: 'install',
        perFamily: true,
        text: 'Installera paketet `tree`.',
        hint: byFamily({
          debian: '`sudo apt install tree`',
          arch: '`sudo pacman -S tree` och svara ja på frågan.',
          redhat: '`sudo dnf install tree` – och svara `y`, eftersom Nej är standard!',
        }),
        solution: byFamily({
          debian: ['sudo apt install tree'],
          arch: ['sudo pacman -S tree', 'y'],
          redhat: ['sudo dnf install tree', 'y'],
        }),
        check: (c) => 'tree' in c.sh.installed,
      },
      {
        id: 'run-tree',
        perFamily: true,
        text: 'Kör `tree` i din hemkatalog.',
        solution: ['cd ~', 'tree'],
        check: (c) => ran(c, /^tree\b/) && 'tree' in c.sh.installed,
      },
      {
        id: 'remove',
        perFamily: true,
        text: 'Ta bort paketet `tree` igen.',
        hint: byFamily({
          debian: '`sudo apt remove tree`',
          arch: '`sudo pacman -R tree`',
          redhat: '`sudo dnf remove tree`',
        }),
        solution: byFamily({
          debian: ['sudo apt remove tree', 'y'],
          arch: ['sudo pacman -R tree', 'y'],
          redhat: ['sudo dnf remove tree', 'y'],
        }),
        check: (c) => {
          const re = {
            debian: /^apt(-get)?\s+(remove|purge)\b.*\btree\b/,
            arch: /^pacman\s+-R\w*\s+.*\btree\b/,
            redhat: /^dnf5?\s+(remove|rm|erase)\b.*\btree\b/,
          }[c.distro.family];
          return re.test(unsudo(c.line)) && !('tree' in c.sh.installed);
        },
      },
      {
        id: 'upgrade',
        perFamily: true,
        text: 'Uppgradera alla installerade paket.',
        hint: byFamily({
          debian: 'Efter `sudo apt update` kör du `sudo apt upgrade`.',
          arch: '`sudo pacman -Syu` gör allt på en gång.',
          redhat: '`sudo dnf upgrade`',
        }),
        solution: byFamily({
          debian: ['sudo apt update', 'sudo apt upgrade', 'y'],
          arch: ['sudo pacman -Syu', 'y'],
          redhat: ['sudo dnf upgrade', 'y'],
        }),
        check: (c) => !!c.sh.flags.upgraded,
      },
      {
        id: 'vim',
        perFamily: true,
        text: 'Bonus: installera texteditorn Vim. Tips: paketet heter inte likadant i alla familjer!',
        hint: byFamily({
          debian: 'Sök med `apt search vim`. Paketet heter `vim`.',
          arch: 'Sök med `pacman -Ss vim`. Paketet heter `vim`.',
          redhat: 'Sök med `dnf search vim`. Paketet heter `vim-enhanced`.',
        }),
        solution: byFamily({
          debian: ['sudo apt update', 'sudo apt install vim'],
          arch: ['sudo pacman -S vim', 'y'],
          redhat: ['sudo dnf install vim-enhanced', 'y'],
        }),
        check: (c) => 'vim' in c.sh.installed,
      },
    ],
  },
  {
    id: 'skript',
    part: 'skript',
    title: 'Shell-skript',
    tasks: [
      {
        id: 'variabel',
        text: 'Skapa variabeln `namn` med ditt namn, och skriv sedan ut `Hej` följt av namnet med `echo`.',
        hint: 'Inga mellanslag runt `=`: `namn=Kim`. Använd sedan `echo "Hej $namn"`.',
        solution: ['namn=Kim', 'echo "Hej $namn"'],
        check: (c) => ran(c, /^echo\b.*\$\{?namn\b/) && !!c.sh.env.namn && c.output.trim() === `Hej ${c.sh.env.namn}`,
      },
      {
        id: 'rakna',
        text: 'Räkna ut 17 × 23 med `$(( ))`.',
        solution: ['echo $(( 17 * 23 ))'],
        check: (c) => ran(c, /\$\(\(/) && c.output.trim() === '391',
      },
      {
        id: 'substitution',
        text: 'Spara antalet rader i `~/dokument/server.log` i variabeln `rader`, med `$(...)` och `wc -l`.',
        hint: '`wc -l < fil` skriver bara ut antalet, utan filnamnet: `rader=$(wc -l < ~/dokument/server.log)`',
        solution: ['rader=$(wc -l < ~/dokument/server.log)'],
        check: (c) => (c.sh.env.rader ?? '').trim() === '15',
      },
      {
        id: 'if',
        text: 'Skriv ett `if`-villkor som skriver ut `finns` om filen `~/.bashrc` finns.',
        hint: '`if [ -f ~/.bashrc ]; then echo finns; fi` – glöm inte mellanslagen innanför hakparenteserna.',
        solution: ['if [ -f ~/.bashrc ]; then echo finns; fi'],
        check: (c) => ran(c, /^if\b/) && /\[|\btest\b/.test(c.line) && c.output.trim() === 'finns',
      },
      {
        id: 'for',
        text: 'Skriv ut talen 1 till 5, ett per rad, med en `for`-loop.',
        hint: 'Antingen `for i in 1 2 3 4 5; do ...; done` eller `for i in $(seq 1 5); do ...; done`.',
        solution: ['for i in 1 2 3 4 5; do echo $i; done'],
        check: (c) => ran(c, /^for\b/) && outLines(c).join(',') === '1,2,3,4,5',
      },
      {
        id: 'while-read',
        text: 'Läs `~/dokument/frukter.txt` rad för rad med `while read` och skriv ut `Frukt: ` framför varje rad.',
        hint: '`while read rad; do echo "Frukt: $rad"; done < ~/dokument/frukter.txt`',
        solution: ['while read rad; do echo "Frukt: $rad"; done < ~/dokument/frukter.txt'],
        check: (c) => ran(c, /\bwhile\s+read\b/) && outLines(c).length === 10 && outLines(c)[0] === 'Frukt: äpple',
      },
      {
        id: 'funktion',
        text: 'Skapa funktionen `dubbla` som skriver ut sitt första argument gånger två. Testa med `dubbla 21`.',
        hint: '`dubbla() { echo $(( $1 * 2 )); }` – och sedan `dubbla 21`.',
        solution: ['dubbla() { echo $(( $1 * 2 )); }', 'dubbla 21'],
        check: (c) => ran(c, /^dubbla\s+21\s*$/) && !!c.sh.functions.dubbla && c.output.trim() === '42',
      },
      {
        id: 'backup',
        text: 'Skriv skriptet `~/backup.sh` som kopierar filen i första argumentet till samma namn med `.bak` på slutet. Gör det körbart och kör `./backup.sh anteckningar.txt` i hemkatalogen.',
        hint: 'Skapa filen med `cat > ~/backup.sh << \'SLUT\'`, skriv `#!/bin/bash` och `cp "$1" "$1.bak"` på varsin rad och avsluta med `SLUT`.',
        solution: ["cat > ~/backup.sh << 'SLUT'", '#!/bin/bash', 'cp "$1" "$1.bak"', 'SLUT', 'chmod +x ~/backup.sh', 'cd ~', './backup.sh anteckningar.txt'],
        check: (c) =>
          ran(c, /backup\.sh\s+anteckningar\.txt\s*$/) && content(c, '~/backup.sh').includes('$1') && isFile(c, '~/anteckningar.txt.bak'),
      },
    ],
  },
  {
    id: 'anvandare',
    part: 'admin',
    title: 'Användare och grupper',
    tasks: [
      {
        id: 'useradd',
        text: 'Skapa användaren `kim` med en hemkatalog och `/bin/bash` som skal.',
        hint: '`sudo useradd -m -s /bin/bash kim` – `-m` skapar hemkatalogen och `-s` väljer skalet.',
        solution: ['sudo useradd -m -s /bin/bash kim'],
        check: (c) => {
          const kim = findUser(c.sh, 'kim');
          return !!kim && /\/bash$/.test(kim.shell) && isDir(c, kim.home);
        },
      },
      {
        id: 'passwd-rad',
        text: 'Visa kims rad i `/etc/passwd`.',
        hint: '`grep kim /etc/passwd` – eller `getent passwd kim`.',
        solution: ['grep kim /etc/passwd'],
        check: (c) => c.exitCode === 0 && /passwd/.test(c.line) && outLines(c).some((l) => l.startsWith('kim:x:')),
      },
      {
        id: 'losenord',
        text: 'Ge `kim` ett lösenord med `passwd`.',
        hint: 'Bara root får sätta lösenord åt andra: `sudo passwd kim`. Skriv samma lösenord två gånger – det syns inte när du skriver.',
        solution: ['sudo passwd kim', 'hemligt123', 'hemligt123'],
        check: (c) => (shadowHash(c.sh, 'kim') ?? '').startsWith('$'),
      },
      {
        id: 'grupp',
        text: 'Skapa gruppen `utvecklare` och lägg till `kim` i den.',
        hint: 'Först `sudo groupadd utvecklare`, sedan `sudo usermod -aG utvecklare kim`.',
        solution: ['sudo groupadd utvecklare', 'sudo usermod -aG utvecklare kim'],
        check: (c) => !!findGroup(c.sh, 'utvecklare')?.members.includes('kim'),
      },
      {
        id: 'sudo-ratt',
        perFamily: true,
        text: byFamily({
          debian: 'Ge `kim` rätt att använda `sudo` genom att lägga till kontot i gruppen `sudo`.',
          arch: 'Ge `kim` rätt att använda `sudo` genom att lägga till kontot i gruppen `wheel`.',
          redhat: 'Ge `kim` rätt att använda `sudo` genom att lägga till kontot i gruppen `wheel`.',
        }),
        hint: byFamily({
          debian: '`sudo usermod -aG sudo kim` – glöm inte `-a`!',
          arch: '`sudo usermod -aG wheel kim` – glöm inte `-a`!',
          redhat: '`sudo usermod -aG wheel kim` – glöm inte `-a`!',
        }),
        solution: byFamily({
          debian: ['sudo usermod -aG sudo kim'],
          arch: ['sudo usermod -aG wheel kim'],
          redhat: ['sudo usermod -aG wheel kim'],
        }),
        check: (c) => !!findGroup(c.sh, c.distro.adminGroup)?.members.includes('kim'),
      },
      {
        id: 'sudo-u',
        text: 'Kör `whoami` som `kim` med `sudo -u`.',
        hint: '`sudo -u kim whoami`',
        solution: ['sudo -u kim whoami'],
        check: (c) => ran(c, /^sudo\s+(-\S+\s+)*-u\s*kim\s+whoami\s*$/) && outLines(c).at(-1) === 'kim',
      },
      {
        id: 'su',
        text: 'Logga in som `kim` med `su -` och kör `id`. Gå sedan tillbaka till `elev` med `exit`.',
        hint: 'Skriv `su - kim` och sedan kims lösenord – det du valde med `passwd`. Prompten visar att du är kim.',
        solution: ['su - kim', 'hemligt123', 'id', 'exit'],
        check: (c) => ran(c, /^id\s*$/) && c.sh.currentUser().name === 'kim',
      },
      {
        id: 'userdel',
        text: 'Skapa en tillfällig användare `vikarie` med hemkatalog – och ta sedan bort den igen, **inklusive** hemkatalogen.',
        hint: '`sudo useradd -m vikarie` och sedan `sudo userdel -r vikarie`.',
        solution: ['sudo useradd -m vikarie', 'sudo userdel -r vikarie'],
        check: (c) =>
          c.exitCode === 0 && /^(userdel|deluser)\b.*\bvikarie\b/.test(unsudo(c.line)) && !findUser(c.sh, 'vikarie') && !exists(c, '/home/vikarie'),
      },
    ],
  },
];

// Kapitlen visas i samma ordning som delarna i PARTS (stabil sortering behåller ordningen inom en del).
CHAPTERS.sort((a, b) => PARTS.findIndex((p) => p.id === a.part) - PARTS.findIndex((p) => p.id === b.part));

/** Kapitel som planeras – visas i menyn som "kommer snart". */
export const UPCOMING: string[] = [
  'Nätverk (ip, ping, curl, ssh)',
  'Tjänster och loggar med systemd',
  'Diskar och filsystem (df, du, mount)',
  'Andra skal: zsh och fish',
  'AUR, PPA och COPR',
  'Flatpak, Snap och AppImage',
  'Git i terminalen',
];

export function taskKey(chapterId: string, taskId: string, perFamily: boolean | undefined, family: Family): string {
  return perFamily ? `${chapterId}/${taskId}@${family}` : `${chapterId}/${taskId}`;
}
