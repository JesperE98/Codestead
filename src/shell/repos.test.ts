import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { preprocess } from '../content/render';
import { moonAge } from './commands/repos';
import { stripAnsi } from './commands/util';
import { DISTROS } from './distros';
import { Shell } from './shell';

function shell(distro: string) {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  return { sh, run };
}

const PPA_FILE = '/etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources';
const COPR_FILE = '/etc/yum.repos.d/_copr:copr.fedorainfracloud.org:lunatool:moonphase.repo';

describe('PPA (Ubuntu/Debian)', () => {
  test('add-apt-repository finns i Ubuntu men inte i Debian', () => {
    expect(shell('ubuntu').run('which add-apt-repository').exitCode).toBe(0);
    const { run } = shell('debian');
    expect(run('add-apt-repository ppa:lunatool/moonphase').exitCode).toBe(127);
    run('sudo apt update');
    run('sudo apt install software-properties-common');
    expect(run('which add-apt-repository').exitCode).toBe(0);
  });

  test('kräver root, och okända PPA:er finns inte', () => {
    const { run } = shell('ubuntu');
    expect(run('add-apt-repository ppa:lunatool/moonphase').out).toContain('must run as root');
    const r = run('sudo add-apt-repository -y ppa:nobody/nothing');
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain("ppa 'nobody/nothing' not found");
  });

  test('paketet syns först när PPA:t lagts till, och apt update körs automatiskt', () => {
    const { sh, run } = shell('ubuntu');
    run('sudo apt update');
    expect(run('sudo apt install moonphase').out).toContain('Unable to locate package moonphase');
    expect(run('apt search moonphase').out).not.toContain('moonphase/');

    const add = run('sudo add-apt-repository ppa:lunatool/moonphase');
    expect(add.pending).toBe(true);
    expect(add.out).toContain('URIs: https://ppa.launchpadcontent.net/lunatool/moonphase/ubuntu/');
    const enter = run('');
    expect(enter.out).toMatch(/Get:\d+ https:\/\/ppa\.launchpadcontent\.net\/lunatool\/moonphase\/ubuntu noble InRelease/);
    expect(sh.vfs.tryLookup(PPA_FILE, sh.rootUser())?.content).toContain('Suites: noble');

    const inst = run('sudo apt install moonphase');
    expect(inst.exitCode).toBe(0);
    expect(inst.out).toContain('https://ppa.launchpadcontent.net/lunatool/moonphase/ubuntu noble/main amd64 moonphase');
    expect(run('moonphase').out).toMatch(/illuminated/);
    expect(run('apt policy moonphase').out).toMatch(/\*\*\* 1\.4\.2-1~ppa1~noble1 500\n\s+500 https:\/\/ppa\.launchpadcontent\.net/);
  });

  test('en källa som läggs till för hand syns först efter apt update', () => {
    const { sh, run } = shell('ubuntu');
    run('sudo apt update');
    run('sudo add-apt-repository -y -n ppa:lunatool/moonphase');
    expect(sh.vfs.tryLookup(PPA_FILE, sh.rootUser())).not.toBeNull();
    expect(run('sudo apt install moonphase').exitCode).toBe(100);
    expect(run('sudo apt update').out).toContain('ppa.launchpadcontent.net');
    expect(run('sudo apt install moonphase').exitCode).toBe(0);
  });

  test('--remove tar bort källan; paketet blir kvar men kan inte installeras igen', () => {
    const { sh, run } = shell('ubuntu');
    run('sudo add-apt-repository -y ppa:lunatool/moonphase');
    run('sudo apt install moonphase');
    expect(run('sudo add-apt-repository -y --remove ppa:lunatool/moonphase').exitCode).toBe(0);
    expect(sh.vfs.tryLookup(PPA_FILE, sh.rootUser())).toBeNull();
    expect('moonphase' in sh.installed).toBe(true);
    expect(run('apt policy moonphase').out).toMatch(/\*\*\* .* 100\n\s+100 \/var\/lib\/dpkg\/status/);
    run('sudo apt remove -y moonphase');
    expect(run('sudo apt install moonphase').exitCode).toBe(100);
  });

  test('i Debian varnar simulatorn för PPA:er', () => {
    const { run } = shell('debian');
    run('sudo apt update');
    run('sudo apt install software-properties-common');
    const r = run('sudo add-apt-repository -y ppa:lunatool/moonphase');
    expect(r.out).toContain('Debian 13');
    expect(run('sudo apt install moonphase').exitCode).toBe(0);
  });
});

describe('COPR (Fedora)', () => {
  test('dnf hittar inte paketet förrän förrådet aktiverats', () => {
    const { run } = shell('fedora');
    expect(run('sudo dnf install -y moonphase').out).toContain('No match for argument: moonphase');
    expect(run('dnf copr enable lunatool/moonphase').out).toContain('superuser privileges');
  });

  test('enable frågar med Nej som standard och skapar en .repo-fil', () => {
    const { sh, run } = shell('fedora');
    expect(run('sudo dnf copr enable lunatool/moonphase').pending).toBe(true);
    expect(run('').out).toContain('Operation aborted');
    expect(sh.vfs.tryLookup(COPR_FILE, sh.rootUser())).toBeNull();

    run('sudo dnf copr enable lunatool/moonphase');
    run('y');
    expect(sh.vfs.tryLookup(COPR_FILE, sh.rootUser())?.content).toContain('enabled=1');
    expect(run('dnf copr list').out).toBe('copr.fedorainfracloud.org/lunatool/moonphase\n');
    expect(run('dnf repolist').out).toContain('copr:copr.fedorainfracloud.org:lunatool:moonphase');

    const inst = run('sudo dnf install -y moonphase');
    expect(inst.out).toContain('copr:copr.fedorainfracloud.org:lunatool:moonphase');
    expect(run('dnf info moonphase').out).toContain('From repository : copr:copr.fedorainfracloud.org:lunatool:moonphase');

    run('sudo dnf copr disable lunatool/moonphase');
    expect(run('dnf copr list').out).toContain('(disabled)');
    expect(run('dnf repolist').out).not.toContain('copr:');
    run('sudo dnf remove -y moonphase');
    expect(run('sudo dnf install -y moonphase').exitCode).toBe(1);
    run('sudo dnf copr remove lunatool/moonphase');
    expect(run('dnf copr list').out).toBe('');
  });

  test('okända projekt', () => {
    const { run } = shell('fedora');
    expect(run('sudo dnf copr enable -y someone/nothing').exitCode).toBe(1);
  });
});

describe('AUR (Arch)', () => {
  function prepared() {
    const s = shell('arch');
    s.run('sudo pacman -S --needed --noconfirm git base-devel');
    s.run('cd ~');
    return s;
  }

  test('pacman känner inte till AUR', () => {
    const { run } = shell('arch');
    expect(run('sudo pacman -S moonphase').out).toContain('target not found: moonphase');
    expect(run('sudo pacman -S yay').out).toContain('bara i AUR');
    expect(run('pacman -Ss moonphase').exitCode).toBe(1);
  });

  test('git clone hämtar PKGBUILD; fel namn ger ett tomt förråd', () => {
    const { sh, run } = prepared();
    const r = run('git clone https://aur.archlinux.org/moonphase.git');
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("Cloning into 'moonphase'...");
    expect(sh.vfs.readFile('/home/elev/moonphase/PKGBUILD', sh.rootUser())).toContain('pkgname=moonphase');
    expect(run('git clone https://aur.archlinux.org/moonphase.git').exitCode).toBe(128);

    expect(run('git clone https://aur.archlinux.org/moonfase.git').out).toContain('cloned an empty repository');
    run('cd moonfase');
    expect(run('makepkg -si').out).toContain('PKGBUILD does not exist');
  });

  test('makepkg vägrar root och behöver base-devel', () => {
    const { run } = shell('arch');
    run('sudo pacman -S --noconfirm git');
    run('cd ~');
    run('git clone https://aur.archlinux.org/moonphase.git');
    run('cd moonphase');
    const root = run('sudo makepkg -si');
    expect(root.exitCode).toBe(10);
    expect(root.out).toContain('Running makepkg as root is not allowed');
    expect(run('makepkg -si').out).toContain('Cannot find the fakeroot binary');
  });

  test('makepkg -si bygger, frågar och installerar – paketet blir "foreign"', () => {
    const { sh, run } = prepared();
    run('git clone https://aur.archlinux.org/moonphase.git');
    run('cd moonphase');
    const build = run('makepkg -si');
    expect(build.out).toContain('==> Finished making: moonphase 1.4.2-1');
    expect(build.pending).toBe(true);
    run('y');
    expect(sh.installed.moonphase).toBe('1.4.2-1');
    expect(run('ls').out).toContain('moonphase-1.4.2-1-x86_64.pkg.tar.zst');
    expect(run('moonphase --version').out).toBe('moonphase 1.4.2\n');
    expect(run('pacman -Qm').out).toBe('moonphase 1.4.2-1\n');
    expect(run('pacman -Qn').out).not.toContain('moonphase');
    expect(run('makepkg').out).toContain('A package has already been built');
    expect(run('sudo pacman -R --noconfirm moonphase').exitCode).toBe(0);
    expect(run('pacman -Qm').exitCode).toBe(1);
  });

  test('makepkg -s installerar byggberoenden (go för yay) innan bygget', () => {
    const { sh, run } = prepared();
    run('git clone https://aur.archlinux.org/yay.git');
    run('cd yay');
    expect(run('makepkg -i').out).toContain('Missing dependencies:\n  -> go>=1.24');
    expect(run('makepkg -si').out).toContain('Packages (1) go-');
    const built = run('y');
    expect(built.out).toContain('==> Finished making: yay');
    expect(built.pending).toBe(true);
    run('y');
    expect('go' in sh.installed && 'yay' in sh.installed).toBe(true);
  });

  test('yay söker i AUR och installerar därifrån, men inte som root', () => {
    const { sh, run } = prepared();
    run('git clone https://aur.archlinux.org/yay-bin.git');
    run('cd yay-bin');
    run('makepkg -si --noconfirm');
    expect(run('yay --version').out).toContain('yay v12.5.2');
    expect(run('yay -Ss snow').out).toContain('aur/snowfall 2.0.1-1');
    expect(run('sudo yay -S snowfall').out).toContain('Refusing to install AUR packages as root');
    run('yay -S snowfall');
    run('y');
    expect('snowfall' in sh.installed).toBe(true);
    expect(sh.vfs.tryLookup('/home/elev/.cache/yay/snowfall/PKGBUILD', sh.rootUser())).not.toBeNull();
    expect(run('pacman -Qm').out).toBe('snowfall 2.0.1-1\nyay-bin 12.5.2-1\n');
    // Vanliga paket installeras med pacman.
    run('yay -S --noconfirm tree');
    expect('tree' in sh.installed).toBe(true);
  });
});

describe('Flatpak', () => {
  test('förinstallerat i Fedora med fedora-källan', () => {
    const { run } = shell('fedora');
    expect(run('flatpak --version').out).toBe('Flatpak 1.16.1\n');
    expect(run('flatpak remotes').out).toContain('fedora');
    expect(shell('ubuntu').run('flatpak --version').exitCode).toBe(127);
  });

  test('Flathub, installation, körning och avinstallation', () => {
    const { sh, run } = shell('arch');
    run('sudo pacman -S --noconfirm flatpak');
    const noRemote = run('flatpak install flathub org.gimp.GIMP');
    expect(noRemote.exitCode).toBe(1);
    expect(noRemote.out).toContain('No remote refs found');

    const add = 'flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo';
    expect(run(add).exitCode).toBe(0);
    expect(run(add).exitCode).toBe(0);
    expect(run(add.replace('--if-not-exists ', '')).out).toContain('Remote flathub already exists');

    expect(run('flatpak search gimp').out).toContain('org.gimp.GIMP');
    const inst = run('flatpak install flathub org.gimp.GIMP');
    expect(inst.out).toContain('org.gnome.Platform');
    expect(inst.pending).toBe(true);
    expect(run('y').out).toContain('Installation complete.');
    expect(sh.vfs.tryLookup('/var/lib/flatpak/app/org.gimp.GIMP', sh.rootUser())).not.toBeNull();
    expect(run('flatpak list --app').out).toContain('org.gimp.GIMP');
    expect(run('flatpak run org.gimp.GIMP').out).toContain('GNU Image Manipulation Program');
    expect(run('flatpak run org.videolan.VLC').exitCode).toBe(1);

    run('flatpak uninstall -y org.gimp.GIMP');
    expect(run('flatpak list --runtime').out).toContain('org.gnome.Platform');
    run('flatpak uninstall -y --unused');
    expect(run('flatpak list').out).toBe('');
  });

  test('--user har egna källor och hamnar i hemkatalogen', () => {
    const { sh, run } = shell('fedora');
    expect(run('flatpak install --user -y flathub org.videolan.VLC').exitCode).toBe(1);
    run('flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo');
    expect(run('flatpak install --user -y flathub org.videolan.VLC').exitCode).toBe(0);
    expect(sh.vfs.tryLookup('/home/elev/.local/share/flatpak/app/org.videolan.VLC', sh.currentUser())?.owner).toBe('elev');
    expect(run('flatpak list').out).toMatch(/org\.videolan\.VLC.*user/);
  });
});

describe('Snap', () => {
  test('Ubuntu har snaps från början, Debian inte', () => {
    expect(shell('ubuntu').run('snap list').out).toMatch(/firefox\s+144/);
    expect(shell('debian').run('snap list').exitCode).toBe(127);
  });

  test('installera kräver root; hello-world körs från /snap/bin', () => {
    const { sh, run } = shell('fedora');
    run('sudo dnf install -y snapd');
    expect(run('snap list').out).toContain('No snaps are installed yet');
    expect(run('snap install hello-world').out).toContain('access denied (try with sudo)');
    expect(run('sudo snap install hello-world').out).toContain('hello-world 6.4 from canonical✓ installed');
    expect(run('hello-world').out).toBe('Hello World!\n');
    expect(run('/snap/bin/hello-world').out).toBe('Hello World!\n');
    expect(run('snap run hello-world').out).toBe('Hello World!\n');
    expect(run('snap list').out).toMatch(/core22\s+.*base/);
    run('sudo snap remove hello-world');
    expect(run('snap run hello-world').exitCode).toBe(1);
    expect(sh.vfs.tryLookup('/snap/bin/hello-world', sh.rootUser())).toBeNull();
  });

  test('classic confinement måste godkännas', () => {
    const { run } = shell('ubuntu');
    const r = run('sudo snap install code');
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain('classic confinement');
    expect(run('sudo snap install code --classic').exitCode).toBe(0);
    expect(run('snap list').out).toMatch(/code\s+.*classic/);
  });
});

describe('AppImage', () => {
  const APP = '/home/elev/Nedladdningar/Kalkylator.AppImage';

  test('måste göras körbar och behöver FUSE 2', () => {
    for (const [distro, pkgCmd] of [
      ['ubuntu', 'sudo apt update && sudo apt install libfuse2t64'],
      ['arch', 'sudo pacman -S --noconfirm fuse2'],
      ['fedora', 'sudo dnf install -y fuse-libs'],
    ]) {
      const { run } = shell(distro);
      expect(run(APP).out).toContain('Permission denied');
      run(`chmod +x ${APP}`);
      const fuse = run(APP);
      expect(fuse.exitCode).toBe(127);
      expect(fuse.out).toContain('AppImages require FUSE to run');
      run(pkgCmd);
      const ok = run(APP);
      expect(ok.exitCode, distro).toBe(0);
      expect(ok.out).toContain('Kalkylator');
    }
  });

  test('--appimage-extract och omdöpt fil', () => {
    const { sh, run } = shell('debian');
    run('cd ~/Nedladdningar');
    run('chmod +x Kalkylator.AppImage');
    expect(run('./Kalkylator.AppImage --appimage-extract').out).toContain('squashfs-root/AppRun');
    expect(sh.vfs.tryLookup('/home/elev/Nedladdningar/squashfs-root/kalkylator.desktop', sh.rootUser())).not.toBeNull();
    expect(run('./squashfs-root/AppRun').exitCode).toBe(0);
    expect(run('./Kalkylator.AppImage --appimage-extract-and-run').exitCode).toBe(0);
    run('mv Kalkylator.AppImage kalk');
    expect(run('./kalk').out).toContain('AppImages require FUSE');
  });
});

describe('övrigt', () => {
  test('gamla sparade terminaler får makepkg och ~/Nedladdningar', () => {
    const { sh } = shell('arch');
    const snap = JSON.parse(JSON.stringify(sh.snapshot()));
    delete snap.fs.children.usr.children.bin.children.makepkg;
    delete snap.fs.children.home.children.elev.children.Nedladdningar;
    for (const k of Object.keys(snap.flags)) if (k === 'default:cmd:makepkg' || k.includes('Nedladdningar')) delete snap.flags[k];
    const restored = Shell.restore(snap)!;
    expect(restored.vfs.tryLookup('/usr/bin/makepkg', restored.rootUser())).not.toBeNull();
    expect(restored.vfs.tryLookup('/home/elev/Nedladdningar/Kalkylator.AppImage', restored.rootUser())).not.toBeNull();
  });

  test('moonphase räknar månens ålder', () => {
    expect(moonAge(Date.UTC(2000, 0, 6, 18, 14))).toBeCloseTo(0);
    // En halv synodisk månad efter en nymåne är det fullmåne.
    expect(moonAge(Date.UTC(2000, 0, 6, 18, 14) + (29.530588853 / 2) * 86_400_000)).toBeCloseTo(29.530588853 / 2);
    expect(moonAge(Date.UTC(1999, 11, 1))).toBeGreaterThan(0);
  });

  test('alla klickbara kommandon i kapiteltexterna fungerar', () => {
    // Avsiktliga fel: "snap install code" utan --classic och en AppImage innan FUSE finns.
    const expectedFailures = [/^sudo snap install code$/, /^\.\/Kalkylator\.AppImage$/];
    for (const lang of ['sv', 'en']) {
      for (const d of DISTROS) {
        const { run } = shell(d.id);
        for (const id of ['extra-repon', 'universella-paket']) {
          const md = preprocess(readFileSync(`src/content/chapters/${lang}/${id}.md`, 'utf8'), d);
          const lines = [...md.matchAll(/```sh\n([\s\S]*?)```/g)].flatMap((m) => m[1].split('\n').filter(Boolean));
          for (const line of lines) {
            let r = run(line);
            for (let i = 0; r.pending && i < 5; i++) r = run('y');
            if (r.exitCode !== 0 && !expectedFailures.some((re) => re.test(line))) {
              throw new Error(`${lang}/${id} i ${d.id}: "${line}" gav ${r.exitCode}\n${r.out}`);
            }
          }
        }
      }
    }
  });
});
