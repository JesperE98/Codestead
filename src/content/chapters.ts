// Alla kapitel och deras uppgifter.
// Texten finns i chapters/*.md, uppgifterna och deras kontroller här.

import type { Distro, Family } from '../shell/distros';
import type { Chapter, CheckCtx, Part } from './types';

import ch01 from './chapters/01-valkommen.md?raw';
import ch02 from './chapters/02-navigera.md?raw';
import ch03 from './chapters/03-filer.md?raw';
import ch04 from './chapters/04-lasa-text.md?raw';
import ch05 from './chapters/05-pipes.md?raw';
import ch06 from './chapters/06-miljo.md?raw';
import ch07 from './chapters/07-rattigheter.md?raw';
import ch08 from './chapters/08-distributioner.md?raw';
import ch09 from './chapters/09-pakethantering.md?raw';
import chSkript from './chapters/skript.md?raw';
import chProcesser from './chapters/processer.md?raw';
import { RUNAWAY_PID, SERVER_PID } from '../shell/procs';

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

export const PARTS: Part[] = [
  { id: 'start', title: 'Kom igång' },
  { id: 'grunder', title: 'Grunderna' },
  { id: 'system', title: 'Systemet' },
  { id: 'distro', title: 'Distributioner' },
  { id: 'skript', title: 'Skript och automatisering' },
];

export const CHAPTERS: Chapter[] = [
  {
    id: 'valkommen',
    part: 'start',
    title: 'Välkommen till Linux-shell',
    content: ch01,
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
    content: ch02,
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
    content: ch03,
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
    content: ch04,
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
    content: ch05,
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
    id: 'miljo',
    part: 'system',
    title: 'Variabler, PATH och alias',
    content: ch06,
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
    content: ch07,
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
    content: chProcesser,
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
    id: 'distributioner',
    part: 'distro',
    title: 'Distributioner och familjer',
    content: ch08,
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
    content: ch09,
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
    content: chSkript,
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
];

/** Kapitel som planeras – visas i menyn som "kommer snart". */
export const UPCOMING: string[] = [
  'Textbearbetning med sed, awk och tr',
  'Arkiv och komprimering (tar, gzip, zip)',
  'Nätverk (ip, ping, curl, ssh)',
  'Tjänster och loggar med systemd',
  'Diskar och filsystem (df, du, mount)',
  'Användarhantering (useradd, passwd)',
  'Andra skal: zsh och fish',
  'AUR, PPA och COPR',
  'Flatpak, Snap och AppImage',
  'Git i terminalen',
];

export function taskKey(chapterId: string, taskId: string, perFamily: boolean | undefined, family: Family): string {
  return perFamily ? `${chapterId}/${taskId}@${family}` : `${chapterId}/${taskId}`;
}
