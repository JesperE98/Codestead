import { describe, expect, test } from 'vitest';
import { parseSince } from './commands/systemd';
import { stripAnsi } from './commands/util';
import { SERVER_PID } from './procs';
import { Shell } from './shell';

function shell(distro = 'ubuntu') {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  const procs = (name: string) => sh.proc.procs.filter((p) => p.cmd.includes(name));
  return { sh, run, procs };
}

describe('systemctl status', () => {
  test('ssh heter olika i olika familjer', () => {
    for (const [distro, name] of [['ubuntu', 'ssh'], ['debian', 'ssh'], ['arch', 'sshd'], ['fedora', 'sshd']]) {
      const { run } = shell(distro);
      const r = run(`systemctl status ${name}`);
      expect(r.exitCode, distro).toBe(0);
      expect(r.out).toContain(`● ${name}.service - `);
      expect(r.out).toContain('Active: active (running)');
      expect(r.out).toContain('Main PID: 733 (sshd)');
      expect(r.out).toContain('Server listening on 0.0.0.0 port 22.');
    }
    // Debian har aliaset sshd.service, Fedora har inget ssh.service.
    expect(shell('debian').run('systemctl status sshd').out).toContain('● ssh.service');
    const fedora = shell('fedora').run('systemctl status ssh');
    expect(fedora.exitCode).toBe(4);
    expect(fedora.out).toContain('Unit ssh.service could not be found.');
  });

  test('statiska tjänster och översikten', () => {
    const { run } = shell('arch');
    expect(run('systemctl status systemd-journald').out).toContain('systemd-journald.service; static)');
    const overview = run('systemctl status').out;
    expect(overview).toContain('State: degraded');
    expect(overview).toContain('Failed: 1 units');
    expect(run('systemctl is-system-running').out).toBe('degraded\n');
  });

  test('cron finns i Debian och Fedora men inte i Arch', () => {
    expect(shell('ubuntu').run('systemctl is-active cron').out).toBe('active\n');
    expect(shell('fedora').run('systemctl is-active crond').out).toBe('active\n');
    expect(shell('fedora').sh.proc.procs.some((p) => p.cmd === '/usr/sbin/crond -n')).toBe(true);
    const arch = shell('arch').run('systemctl is-active cronie');
    expect(arch.out).toBe('inactive\n');
    expect(arch.exitCode).toBe(4);
  });
});

describe('den trasiga tjänsten rapportd', () => {
  test('syns i --failed och journalen förklarar felet', () => {
    const { run } = shell();
    const failed = run('systemctl --failed');
    expect(failed.out).toMatch(/● rapportd\.service\s+loaded failed failed/);
    expect(failed.out).toContain('1 loaded units listed.');
    const status = run('systemctl status rapportd');
    expect(status.exitCode).toBe(3);
    expect(status.out).toContain('× rapportd.service');
    expect(status.out).toContain('Active: failed (Result: exit-code)');
    expect(status.out).toContain('status=1/FAILURE');
    const log = run('journalctl -u rapportd -b');
    expect(log.out).toContain('error: cannot open config file /etc/rapportd.conf: No such file or directory');
    expect(log.out).not.toContain('Report scheduler ready');
    // I går fungerade den.
    expect(run('journalctl -u rapportd -b -1').out).toContain('Report scheduler ready');
  });

  test('-xeu ger förklaringar', () => {
    const { run } = shell('debian');
    const r = run('journalctl -xeu rapportd');
    expect(r.out).toContain('░░ Subject: Unit failed');
    expect(r.out).toContain("░░ The unit rapportd.service has entered the 'failed' state with result 'exit-code'.");
    expect(r.out).toContain('░░ Support: https://www.debian.org/support');
  });

  test('omstart kräver root, misslyckas utan konfiguration och lyckas efter rättningen', () => {
    const { sh, run, procs } = shell('fedora');
    const noRoot = run('systemctl restart rapportd');
    expect(noRoot.exitCode).toBe(1);
    expect(noRoot.out).toContain('Failed to restart rapportd.service: Interactive authentication required.');
    const again = run('sudo systemctl restart rapportd');
    expect(again.exitCode).toBe(1);
    expect(again.out).toContain('Job for rapportd.service failed because the control process exited with error code.');
    expect(again.out).toContain('journalctl -xeu rapportd.service');
    expect(procs('rapportd')).toHaveLength(0);

    expect(run('sudo cp /etc/rapportd.conf.example /etc/rapportd.conf').exitCode).toBe(0);
    const ok = run('sudo systemctl restart rapportd');
    expect(ok.exitCode).toBe(0);
    expect(sh.services.units['rapportd.service'].active).toBe('active');
    expect(procs('rapportd')).toHaveLength(1);
    expect(run('systemctl is-active rapportd').out).toBe('active\n');
    expect(run('systemctl --failed').out).toContain('0 loaded units listed.');
    const status = run('systemctl status rapportd').out;
    expect(status).toContain('Active: active (running)');
    expect(status).toContain('Report scheduler ready (interval 1h)');
    expect(status).not.toContain('cannot open config file');
  });
});

describe('minserver och processtabellen', () => {
  test('stop tar bort processen och start lägger tillbaka den med ny PID', () => {
    const { run, procs } = shell();
    expect(procs('minserver')[0].pid).toBe(SERVER_PID);
    expect(run('systemctl stop minserver').exitCode).toBe(1);
    expect(procs('minserver')).toHaveLength(1);
    expect(run('sudo systemctl stop minserver').exitCode).toBe(0);
    expect(procs('minserver')).toHaveLength(0);
    expect(run('systemctl status minserver').out).toContain('Active: inactive (dead)');
    expect(run('systemctl is-active minserver').exitCode).toBe(3);
    expect(run('sudo systemctl start minserver').exitCode).toBe(0);
    const [proc] = procs('minserver');
    expect(proc.pid).not.toBe(SERVER_PID);
    expect(run('pgrep minserver').out).toBe(`${proc.pid}\n`);
    expect(run('systemctl status minserver').out).toContain(`Main PID: ${proc.pid} (minserver)`);
  });

  test('systemd märker när processen dödas med kill', () => {
    const { run } = shell('arch');
    run('sudo pkill minserver');
    const r = run('systemctl status minserver');
    expect(r.out).toContain('○ minserver.service');
    expect(r.out).toContain('Active: inactive (dead)');
    expect(r.out).toContain('minserver.service: Deactivated successfully.');
  });

  test('enable, disable och is-enabled', () => {
    const { sh, run } = shell('debian');
    const wants = '/etc/systemd/system/multi-user.target.wants/minserver.service';
    expect(run('systemctl is-enabled minserver').out).toBe('disabled\n');
    expect(run('systemctl enable minserver').out).toContain('Failed to enable unit: Interactive authentication required.');
    const r = run('sudo systemctl enable minserver');
    expect(r.out).toContain(`Created symlink ${wants} → /etc/systemd/system/minserver.service.`);
    expect(sh.vfs.tryLookup(wants, sh.rootUser())).not.toBeNull();
    expect(run('systemctl is-enabled minserver').out).toBe('enabled\n');
    expect(run('sudo systemctl enable minserver').out).toBe('');
    expect(run('sudo systemctl disable --now minserver').out).toContain(`Removed "${wants}".`);
    expect(sh.services.units['minserver.service'].active).toBe('inactive');
    expect(run('systemctl is-enabled minserver').exitCode).toBe(1);
    expect(run('sudo systemctl enable --now minserver').exitCode).toBe(0);
    expect(sh.services.units['minserver.service'].active).toBe('active');
    expect(run('systemctl is-enabled sshd').out).toBe('alias\n');
    expect(run('sudo systemctl enable systemd-logind').out).toContain('no installation config');
  });

  test('reload kräver stöd och att tjänsten kör', () => {
    const { run } = shell();
    expect(run('sudo systemctl reload minserver').exitCode).toBe(0);
    expect(run('journalctl -u minserver -n 2').out).toContain('Reloaded minserver.service');
    expect(run('sudo systemctl reload cron').out).toContain('Job type reload is not applicable');
    run('sudo systemctl stop minserver');
    expect(run('sudo systemctl reload minserver').out).toContain('is not active');
  });
});

describe('journalctl', () => {
  test('-p err visar bara fel', () => {
    const { sh, run } = shell();
    const r = run('journalctl -p err -b');
    const lines = r.out.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(r.out).toContain('ACPI BIOS Error');
    expect(r.out).toContain('rapportd');
    expect(r.out).not.toContain('Started');
    const cur = sh.services.boots.length - 1;
    const errs = sh.services.journal.filter((e) => e.boot === cur && e.prio <= 3);
    expect(lines).toHaveLength(errs.length);
    expect(run('journalctl -p warning..warning -b').out).toContain("Failed with result 'exit-code'");
  });

  test('-n, -r, -f, -k, -g och -o cat', () => {
    const { run } = shell();
    expect(run('journalctl -n 3').out.trim().split('\n')).toHaveLength(3);
    expect(run('journalctl -n').out.trim().split('\n')).toHaveLength(10);
    expect(run('journalctl -u ssh -n 1 -o cat').out).toBe('Started ssh.service - OpenBSD Secure Shell server.\n');
    const f = run('journalctl -f');
    expect(f.out.trim().split('\n')).toHaveLength(11);
    expect(f.out).toContain('Ctrl+C');
    expect(run('journalctl -k').out).toMatch(/kernel: Linux version/);
    expect(run('journalctl -k').out).not.toContain('systemd[1]');
    expect(run('journalctl -g listening -u ssh -b').out.trim().split('\n')).toHaveLength(2);
    const rev = run('journalctl -r -u ssh -b').out.trim().split('\n');
    expect(rev[0]).toContain('Started ssh.service');
  });

  test('uppstarter, tider och fel', () => {
    const { run } = shell();
    expect(run('journalctl --list-boots').out.trim().split('\n')).toHaveLength(3);
    expect(run('journalctl -b -5').exitCode).toBe(1);
    expect(run('journalctl --since today -u nisse').out).toBe('-- No entries --\n');
    expect(run('journalctl --since "1 hour ago" -u rapportd').out).toBe('-- No entries --\n');
    expect(run('journalctl --since igår').out).toContain('Failed to parse timestamp');
    expect(run('journalctl --nope').exitCode).toBe(1);
    expect(run('journalctl').out).toContain('-- Boot ');
  });

  test('parseSince', () => {
    const now = new Date(2026, 9, 30, 12, 30, 0).getTime();
    expect(parseSince('today', now)).toBe(new Date(2026, 9, 30).getTime());
    expect(parseSince('yesterday', now)).toBe(new Date(2026, 9, 29).getTime());
    expect(parseSince('10:15', now)).toBe(new Date(2026, 9, 30, 10, 15).getTime());
    expect(parseSince('2026-10-01 08:00', now)).toBe(new Date(2026, 9, 1, 8, 0).getTime());
    expect(parseSince('-2h', now)).toBe(now - 7_200_000);
    expect(parseSince('30 min ago', now)).toBe(now - 1_800_000);
    expect(parseSince('snart', now)).toBeNull();
  });
});

describe('unit-filer', () => {
  test('cat, list-unit-files och daemon-reload', () => {
    const { sh, run } = shell('fedora');
    const cat = run('systemctl cat sshd').out;
    expect(cat).toContain('# /usr/lib/systemd/system/sshd.service');
    expect(cat).toContain('ExecStart=/usr/sbin/sshd -D');
    expect(run('ls /etc/systemd/system').out).toContain('minserver.service');
    expect(run('systemctl list-unit-files').out).toMatch(/minserver\.service\s+disabled\s+disabled/);

    run('sudo sed -i "s/practice server/övning/" /etc/systemd/system/minserver.service');
    expect(run('systemctl status minserver').out).toContain("changed on disk. Run 'systemctl daemon-reload'");
    expect(run('systemctl daemon-reload').exitCode).toBe(1);
    run('sudo systemctl daemon-reload');
    const status = run('systemctl status minserver').out;
    expect(status).not.toContain('changed on disk');
    expect(status).toContain('minserver.service - Minserver web server (övning)');
    expect(sh.services.units['minserver.service'].loaded).toContain('(övning)');
  });

  test('egna tjänster: start och 203/EXEC', () => {
    const { sh, run } = shell();
    run(`echo '[Unit]' | sudo tee /etc/systemd/system/vila.service`);
    run(`echo 'Description=Sover länge' | sudo tee -a /etc/systemd/system/vila.service`);
    run(`echo '[Service]' | sudo tee -a /etc/systemd/system/vila.service`);
    run(`echo 'ExecStart=/usr/bin/sleep 1000' | sudo tee -a /etc/systemd/system/vila.service`);
    expect(run('sudo systemctl start vila').exitCode).toBe(0);
    expect(sh.proc.procs.some((p) => p.cmd === '/usr/bin/sleep 1000')).toBe(true);
    expect(run('systemctl status vila').out).toContain('● vila.service - Sover länge');

    run(`printf '[Service]\\nExecStart=/opt/finns-inte\\n' | sudo tee /etc/systemd/system/trasig.service`);
    expect(run('sudo systemctl start trasig').exitCode).toBe(1);
    const status = run('systemctl status trasig').out;
    expect(status).toContain('status=203/EXEC');
    expect(run('journalctl -u trasig').out).toContain('Failed to locate executable /opt/finns-inte');
    expect(run('sudo systemctl start finns-inte').out).toContain('Unit finns-inte.service not found.');
  });
});

describe('omstart och sparat tillstånd', () => {
  test('bara aktiverade tjänster startar efter reboot', () => {
    const { sh, run, procs } = shell('arch');
    run('sudo pkill minserver');
    run('sleep 300 &');
    expect(run('reboot').exitCode).toBe(1);
    expect(run('sudo reboot').exitCode).toBe(0);
    expect(procs('minserver')).toHaveLength(0);
    expect(sh.proc.jobs).toHaveLength(0);
    expect(procs('/usr/sbin/sshd')).toHaveLength(1);
    expect(sh.services.units['rapportd.service'].active).toBe('failed');
    expect(sh.cwd).toBe('/home/elev');

    run('sudo systemctl enable minserver');
    run('sudo cp /etc/rapportd.conf.example /etc/rapportd.conf');
    run('sudo systemctl reboot');
    expect(procs('minserver')[0]?.pid).toBe(SERVER_PID);
    expect(sh.services.units['rapportd.service'].active).toBe('active');
    expect(run('journalctl --list-boots').out.trim().split('\n')).toHaveLength(5); // rubrik + 4 uppstarter
    expect(run('journalctl -b -1 -n 1').out).toContain('reboot: Restarting system');
  });

  test('tjänsterna sparas och gamla sparade terminaler får tjänster', () => {
    const { sh, run } = shell('debian');
    run('sudo systemctl stop ssh');
    const copy = Shell.restore(JSON.parse(JSON.stringify(sh.snapshot())))!;
    expect(copy.services.units['ssh.service'].active).toBe('inactive');
    expect(copy.execute('systemctl is-active ssh').output).toBe('inactive\n');

    // En terminal som sparades innan systemd fanns, där minserver redan dödats.
    const old = Shell.create('debian');
    old.execute('sudo pkill minserver');
    const snap = JSON.parse(JSON.stringify(old.snapshot()));
    delete snap.services;
    const restored = Shell.restore(snap)!;
    expect(restored.services.units['minserver.service'].active).toBe('inactive');
    expect(restored.services.units['ssh.service'].active).toBe('active');
    expect(restored.execute('systemctl status rapportd').exitCode).toBe(3);
  });
});

describe('hostnamectl och systemd-analyze', () => {
  test('hostnamectl visar och byter namn', () => {
    const { sh, run } = shell('fedora');
    const r = run('hostnamectl');
    expect(r.out).toContain('Static hostname: fedora');
    expect(r.out).toContain('Operating System: Fedora Linux 43 (Workstation Edition)');
    expect(run('hostnamectl set-hostname labb').exitCode).toBe(1);
    expect(run('sudo hostnamectl set-hostname labb').exitCode).toBe(0);
    expect(sh.vfs.readFile('/etc/hostname', sh.rootUser())).toBe('labb\n');
    expect(run('hostnamectl').out).toContain('Static hostname: labb');
  });

  test('systemd-analyze', () => {
    const { run } = shell();
    expect(run('systemd-analyze').out).toMatch(/^Startup finished in 2\.153s \(kernel\) \+ [\d.]+s \(userspace\)/);
    const blame = run('systemd-analyze blame').out;
    expect(blame).toContain('ssh.service');
    expect(blame).toContain('rapportd.service');
  });

  test('kommandona kommer från paketet systemd', () => {
    const { run } = shell('arch');
    expect(run('which systemctl journalctl').out).toBe('/usr/bin/systemctl\n/usr/bin/journalctl\n');
    expect(run('man journalctl').out).toContain('journalctl - läs systemd:s logg');
  });
});
