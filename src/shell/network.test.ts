import { describe, expect, test } from 'vitest';
import { stripAnsi } from './commands/util';
import { findPackage } from './packages';
import { Shell } from './shell';

function shell(distro = 'arch') {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  const file = (p: string) => sh.vfs.tryLookup(p.replace(/^~/, '/home/elev'), sh.rootUser());
  return { sh, run, file };
}

describe('ip och hostname', () => {
  test('ip a, ip -br a och hostname -I visar adresserna', () => {
    const { run } = shell();
    const a = run('ip a');
    expect(a.exitCode).toBe(0);
    expect(a.out).toContain('inet 127.0.0.1/8 scope host lo');
    expect(a.out).toContain('inet 192.168.1.42/24 brd 192.168.1.255');
    expect(a.out).toContain('state UP');
    expect(run('ip addr show dev lo').out).not.toContain('enp0s3');
    expect(run('ip -br a').out).toMatch(/^enp0s3\s+UP\s+192\.168\.1\.42\/24/m);
    expect(run('hostname -I').out).toBe('192.168.1.42 \n');
    expect(run('ip x').exitCode).not.toBe(0);
  });

  test('ip route visar gatewayen', () => {
    const { run } = shell();
    expect(run('ip r').out).toContain('default via 192.168.1.1 dev enp0s3');
    expect(run('ip route get 1.1.1.1').out).toContain('via 192.168.1.1');
    expect(run('ip neigh').out).toContain('192.168.1.1 dev enp0s3');
  });

  test('ip link set kräver root, och ett avstängt kort stänger nätet', () => {
    const { run } = shell();
    const denied = run('ip link set enp0s3 down');
    expect(denied.out).toContain('Operation not permitted');
    expect(run('sudo ip link set enp0s3 down').exitCode).toBe(0);
    expect(run('ip link').out).toContain('state DOWN');
    expect(run('ip route').out).toBe('');
    expect(run('ping -c 1 192.168.1.1').out).toContain('Network is unreachable');
    expect(run('ping -c 1 example.com').out).toContain('Temporary failure in name resolution');
    // localhost fungerar fortfarande
    expect(run('ping -c 1 localhost').exitCode).toBe(0);
    run('sudo ip link set dev enp0s3 up');
    expect(run('ping -c 1 example.com').exitCode).toBe(0);
  });
});

describe('ping', () => {
  test('-c räknar paketen och visar statistik', () => {
    const { run } = shell();
    const r = run('ping -c 3 192.168.1.1');
    expect(r.exitCode).toBe(0);
    expect(r.out.match(/^64 bytes from 192\.168\.1\.1: icmp_seq=\d ttl=64 time=[\d.]+ ms$/gm)).toHaveLength(3);
    expect(r.out).toContain('3 packets transmitted, 3 received, 0% packet loss');
    expect(r.out).toMatch(/rtt min\/avg\/max\/mdev = [\d.]+\/[\d.]+\/[\d.]+\/[\d.]+ ms/);
  });

  test('utan -c "trycker" simulatorn Ctrl+C efter några svar', () => {
    const { run } = shell();
    const r = run('ping example.com');
    expect(r.out).toContain('PING example.com (203.0.113.10) 56(84) bytes of data.');
    expect(r.out).toContain('64 bytes from example.com (203.0.113.10)');
    expect(r.out).toContain('^C');
    expect(r.out).toContain('Ctrl+C');
  });

  test('okända namn och adresser som inte svarar', () => {
    const { run } = shell();
    const unknown = run('ping -c 1 finns-inte.example');
    expect(unknown.exitCode).toBe(2);
    expect(unknown.out).toContain('Name or service not known');
    const lan = run('ping -c 2 192.168.1.77');
    expect(lan.exitCode).toBe(1);
    expect(lan.out).toContain('Destination Host Unreachable');
    expect(run('ping -c 2 10.9.8.7').out).toContain('100% packet loss');
    expect(run('ping').out).toContain('Destination address required');
  });
});

describe('namnuppslag', () => {
  test('/etc/hosts används av ping och getent men inte av dig', () => {
    const { run } = shell('debian');
    expect(run('ping -c 1 server.lan').exitCode).toBe(2);
    run("echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts");
    const ping = run('ping -c 2 server.lan');
    expect(ping.exitCode).toBe(0);
    expect(ping.out).toContain('64 bytes from server.lan (192.168.1.10)');
    expect(run('getent hosts server.lan').out).toBe('192.168.1.10    server.lan\n');
    run('sudo apt update');
    run('sudo apt install dnsutils');
    expect(run('dig +short server.lan').out).toBe('');
    expect(run('dig server.lan').out).toContain('status: NXDOMAIN');
  });

  test('dig, host och nslookup måste installeras och frågar DNS', () => {
    const { run } = shell('fedora');
    expect(run('dig example.com').exitCode).toBe(127);
    run('sudo dnf install bind-utils');
    run('y');
    expect(run('dig +short example.com').out).toBe('203.0.113.10\n');
    const full = run('dig example.com');
    expect(full.out).toContain(';; ANSWER SECTION:');
    expect(full.out).toContain('SERVER: 127.0.0.53#53');
    expect(run('dig @1.1.1.1 example.com').out).toContain('SERVER: 1.1.1.1#53');
    expect(run('dig +short example.com AAAA').out).toBe('2001:db8::10\n');
    expect(run('host example.com').out).toContain('example.com has address 203.0.113.10');
    expect(run('host 1.1.1.1').out).toContain('domain name pointer one.one.one.one.');
    expect(run('host nope.invalid').out).toContain('not found: 3(NXDOMAIN)');
    expect(run('nslookup archlinux.org').out).toContain('Address: 203.0.113.30');
  });

  test('paketnamnen skiljer sig mellan familjerna', () => {
    expect(findPackage('debian', 'dnsutils')?.provides).toContain('dig');
    expect(findPackage('arch', 'bind')?.provides).toContain('dig');
    expect(findPackage('redhat', 'bind-utils')?.provides).toContain('dig');
    expect(findPackage('redhat', 'iproute')?.provides).toContain('ss');
    expect(findPackage('debian', 'iputils-ping')?.provides).toContain('ping');
  });

  test('en trasig /etc/resolv.conf stoppar namn men inte adresser', () => {
    const { run } = shell('debian');
    expect(run('cat /etc/resolv.conf').out).toContain('nameserver 192.168.1.1');
    run("echo 'nameserver 10.0.0.99' | sudo tee /etc/resolv.conf");
    expect(run('ping -c 1 example.com').out).toContain('Temporary failure in name resolution');
    expect(run('ping -c 1 1.1.1.1').exitCode).toBe(0);
  });
});

describe('ss och minserver', () => {
  test('ss -tulpn visar lyssnande portar, processerna bara med sudo', () => {
    const { run } = shell();
    const r = run('ss -tulpn');
    expect(r.out).toMatch(/tcp\s+LISTEN.*0\.0\.0\.0:22\b/);
    expect(r.out).toMatch(/0\.0\.0\.0:8080\b/);
    expect(r.out).not.toContain('users:');
    const root = run('sudo ss -tulpn');
    expect(root.out).toContain('users:(("sshd",pid=733');
    expect(root.out).toContain('users:(("minserver",pid=812');
    expect(run('ss -tl').out).toContain('0.0.0.0:ssh');
  });

  test('minserver kan stoppas och startas igen', () => {
    const { run } = shell();
    expect(run('minserver').out).toContain('Address already in use');
    run('sudo pkill minserver');
    expect(run('ss -tln').out).not.toContain(':8080');
    expect(run('curl http://localhost:8080').exitCode).toBe(7);
    expect(run('minserver --port 80').out).toContain('Permission denied');
    expect(run('minserver').exitCode).toBe(0);
    expect(run('ss -tlpn').out).toContain('users:(("minserver"');
    expect(run('curl -s localhost:8080').out).toContain('Hello from minserver!');
  });
});

describe('curl och wget', () => {
  test('curl hämtar sidor och visar headers', () => {
    const { run } = shell();
    expect(run('curl http://localhost:8080').out).toContain('<h1>Hello from minserver!</h1>');
    const head = run('curl -I https://example.com');
    expect(head.out).toMatch(/^HTTP\/2 200\n/);
    expect(head.out).toContain('content-type: text/html');
    expect(head.out).not.toContain('<html>');
    expect(run('curl -s https://example.com | grep title').out).toContain('<title>Example Domain</title>');
    expect(run('curl -i http://localhost:8080/om.html').out).toMatch(/^HTTP\/1\.0 200 OK\n[\s\S]*Server: minserver\/1\.0[\s\S]*About minserver/);
  });

  test('omdirigeringar följs bara med -L', () => {
    const { run } = shell();
    const plain = run('curl http://linux.org');
    expect(plain.out).toContain('301 Moved Permanently');
    expect(plain.out).toContain('-L');
    expect(run('curl -I http://linux.org').out).toContain('Location: https://linux.org/');
    expect(run('curl -L http://linux.org').out).toContain('<h1>Linux.org</h1>');
  });

  test('curl -o, -O och felkoder', () => {
    const { run, file } = shell();
    run('cd ~');
    expect(run('curl -o sida.html https://example.com').exitCode).toBe(0);
    expect(file('~/sida.html')?.content).toContain('Example Domain');
    expect(run('curl -O https://example.com/cheatsheet.txt').exitCode).toBe(0);
    expect(file('~/cheatsheet.txt')?.content).toContain('ss -tulpn');
    expect(run('curl -o /etc/x.html https://example.com').exitCode).toBe(23);
    expect(run('curl -f http://localhost:8080/finns-inte').exitCode).toBe(22);
    expect(run('curl http://localhost:8080/finns-inte').out).toContain('404 Not Found');
    expect(run('curl https://finns-inte.example').out).toContain('curl: (6) Could not resolve host: finns-inte.example');
    expect(run('curl http://192.168.1.10:8080').exitCode).toBe(7);
    expect(run('curl ftp://example.com').exitCode).toBe(1);
  });

  test('curl saknas i Debian, wget saknas i Arch och Fedora', () => {
    expect(shell('debian').run('curl https://example.com').exitCode).toBe(127);
    expect(shell('arch').run('wget https://example.com').exitCode).toBe(127);
    expect(shell('fedora').run('wget https://example.com').exitCode).toBe(127);
  });

  test('wget sparar filer, följer omdirigeringar och numrerar dubbletter', () => {
    const { run, file } = shell('ubuntu');
    run('cd ~');
    const r = run('wget https://example.com/cheatsheet.txt');
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("Connecting to example.com (example.com)|203.0.113.10|:443... connected.");
    expect(r.out).toContain('‘cheatsheet.txt’ saved');
    run('wget -q https://example.com/cheatsheet.txt');
    expect(file('~/cheatsheet.txt.1')).not.toBeNull();
    expect(run('wget http://linux.org').out).toContain('Location: https://linux.org/ [following]');
    expect(file('~/index.html')?.content).toContain('Linux.org');
    expect(run('wget -O exempel.html https://example.com').exitCode).toBe(0);
    expect(file('~/exempel.html')?.content).toContain('Example Domain');
    expect(run('wget https://example.com/saknas').exitCode).toBe(8);
    expect(run('wget http://finns-inte.example').exitCode).toBe(4);
    expect(run('wget -O - http://localhost:8080').out).toContain('Hello from minserver!');
  });
});

describe('ssh', () => {
  function withHosts(distro = 'fedora') {
    const s = shell(distro);
    s.run("echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts");
    return s;
  }

  test('första gången frågar ssh om värdnyckeln', () => {
    const { run, file } = withHosts();
    const first = run('ssh elev@server.lan hostname');
    expect(first.pending).toBe(true);
    expect(first.out).toContain("The authenticity of host 'server.lan (192.168.1.10)' can't be established.");
    expect(run('y').pending).toBe(true); // "yes" måste skrivas ut
    const r = run('yes');
    expect(r.line).toBe('ssh elev@server.lan hostname');
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("Warning: Permanently added 'server.lan' (ED25519)");
    expect(r.out.split('\n')).toContain('server');
    expect(file('~/.ssh/known_hosts')?.content).toMatch(/^server\.lan ssh-ed25519 /);
    expect(file('~/.ssh')?.mode).toBe(0o700);
    // Andra gången: ingen fråga.
    const again = run("ssh elev@server.lan 'whoami; cat välkommen.txt'");
    expect(again.pending).toBe(false);
    expect(again.out).toContain('elev\nVälkommen till servern!');
  });

  test('nej, fel användare, fel port och okänd värd', () => {
    const { run } = withHosts();
    run('ssh elev@server.lan true');
    expect(run('no').out).toContain('Host key verification failed.');
    run('ssh elev@192.168.1.10 true');
    run('yes');
    expect(run('ssh root@192.168.1.10 ls').out).toContain('Permission denied (publickey,password)');
    expect(run('ssh -p 2222 elev@server.lan ls').out).toContain('port 2222: Connection refused');
    expect(run('ssh elev@okand.lan ls').out).toContain('Could not resolve hostname okand.lan');
    expect(run('ssh 192.168.1.1').out).toContain('Connection refused');
  });

  test('kommandon körs på servern, inte lokalt', () => {
    const { run, sh } = withHosts();
    run('ssh elev@server.lan touch pa-servern.txt');
    run('yes');
    expect(sh.vfs.tryLookup('/home/elev/pa-servern.txt', sh.rootUser())).toBeNull();
    expect(run('ssh elev@server.lan ls').out).toContain('pa-servern.txt');
    expect(run('ssh elev@server.lan hostname -I').out).toContain('192.168.1.10');
    expect(run('ssh elev@server.lan ls | wc -l').exitCode).toBe(0);
  });

  test('interaktiv inloggning förklaras', () => {
    const { run } = withHosts();
    run('ssh server.lan');
    const r = run('yes');
    expect(r.out).toContain('Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY');
    expect(r.out).toContain('Connection to server.lan closed.');
  });

  test('ssh-keygen och ssh-copy-id ger inloggning utan lösenord', () => {
    const { run, file } = withHosts('ubuntu');
    expect(run('ssh-copy-id elev@server.lan').out).toContain('No identities found');
    const k = run("ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519");
    expect(k.exitCode).toBe(0);
    expect(k.out).toContain('Your public key has been saved in /home/elev/.ssh/id_ed25519.pub');
    expect(k.out).toContain('+----[SHA256]-----+');
    expect(file('~/.ssh/id_ed25519')?.mode).toBe(0o600);
    expect(file('~/.ssh/id_ed25519.pub')?.content).toMatch(/^ssh-ed25519 AAAA\S+ elev@ubuntu\n$/);
    run('ssh-copy-id elev@server.lan');
    const copied = run('yes');
    expect(copied.out).toContain('Number of key(s) added: 1');
    const login = run('ssh elev@server.lan cat .ssh/authorized_keys');
    expect(login.out).not.toContain('password');
    expect(login.out).toContain(file('~/.ssh/id_ed25519.pub')!.content!.trim());
    expect(run('ssh-copy-id elev@server.lan').out).toContain('All keys were skipped');
  });

  test('interaktiv ssh-keygen frågar efter fil och lösenfras', () => {
    const { run, file } = shell('fedora');
    expect(run('ssh-keygen').pending).toBe(true);
    expect(run('').pending).toBe(true);
    expect(run('hemlig').pending).toBe(true);
    expect(run('annan').out).toContain('Passphrases do not match');
    run('ssh-keygen');
    run('');
    run('');
    expect(run('').out).toContain('The key fingerprint is:');
    expect(file('~/.ssh/id_ed25519.pub')).not.toBeNull();
    run('ssh-keygen');
    run('');
    expect(run('n').exitCode).toBe(1);
  });

  test('ssh saknas i Arch tills openssh installeras', () => {
    const { run } = withHosts('arch');
    expect(run('ssh elev@server.lan hostname').exitCode).toBe(127);
    run('sudo pacman -S openssh');
    run('y');
    expect(run('ssh elev@server.lan hostname').pending).toBe(true);
  });
});

describe('traceroute och getent', () => {
  test('traceroute visar vägen via gatewayen', () => {
    const { run } = shell();
    run('sudo pacman -S traceroute');
    run('y');
    const r = run('traceroute example.com');
    expect(r.out).toMatch(/^ 1 {2}192\.168\.1\.1 \(192\.168\.1\.1\)/m);
    expect(r.out).toMatch(/example\.com \(203\.0\.113\.10\)/);
  });

  test('getent slår upp i hosts, passwd och group', () => {
    const { run } = shell();
    expect(run('getent hosts localhost').out).toContain('127.0.0.1');
    expect(run('getent hosts example.com').out).toBe('203.0.113.10    example.com\n');
    expect(run('getent passwd elev').out).toMatch(/^elev:x:1000:/);
    expect(run('getent hosts finns.inte').exitCode).toBe(2);
  });
});

describe('sparade terminaler', () => {
  test('resolv.conf och minserver läggs till i gamla sparade tillstånd', () => {
    const sh = Shell.create('ubuntu');
    const root = sh.rootUser();
    sh.vfs.remove('/etc/resolv.conf', root);
    sh.vfs.remove('/usr/local/bin/minserver', root);
    const snap = JSON.parse(JSON.stringify(sh.snapshot()));
    delete snap.flags['default:file:/etc/resolv.conf'];
    delete snap.flags['default:file:/usr/local/bin/minserver'];
    const restored = Shell.restore(snap)!;
    expect(restored.vfs.tryLookup('/etc/resolv.conf', root)?.content).toContain('127.0.0.53');
    expect(stripAnsi(restored.execute('which minserver').output)).toBe('/usr/local/bin/minserver\n');
  });
});
