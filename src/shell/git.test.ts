import { describe, expect, test } from 'vitest';
import { blobHash, gitRepoState, sha1 } from './commands/git';
import { stripAnsi } from './commands/util';
import { installPackage, PACKAGES } from './packages';
import { Shell } from './shell';

const WEB = '/home/elev/projekt-webb';

function shell(distro = 'arch', opts: { identity?: boolean; git?: boolean } = {}) {
  const sh = Shell.create(distro);
  sh.lang = 'en';
  if (opts.git !== false) installPackage(sh, PACKAGES.find((p) => p.id === 'git')!);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  if (opts.identity !== false) {
    run('git config --global user.name "Elev Elevsson"');
    run('git config --global user.email elev@example.com');
  }
  const node = (path: string) => sh.vfs.tryLookup(path.replace(/^~/, '/home/elev'), sh.rootUser());
  return { sh, run, node };
}

/** Ett repo i ~/projekt-webb med en första commit. */
function repo(distro = 'arch') {
  const s = shell(distro);
  s.run('cd ~/projekt-webb');
  s.run('git init -q');
  s.run('git add .');
  s.run('git commit -q -m "Första versionen"');
  return s;
}

describe('objekt', () => {
  test('blob-id blir samma som i riktiga git', () => {
    expect(blobHash('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    expect(blobHash('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
    expect(sha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    const { run } = shell();
    run('echo hello > ~/h.txt');
    expect(run('git hash-object ~/h.txt').out).toBe('ce013625030ba8dba906f756967f9e9ca394464a\n');
  });

  test('git finns inte förrän paketet installerats', () => {
    const { run } = shell('ubuntu', { git: false, identity: false });
    expect(run('git --version').out).toMatch(/not found/);
    run('sudo apt update');
    run('sudo apt install git');
    expect(run('git --version').out).toBe('git version 2.51.1\n');
  });
});

describe('init och config', () => {
  test('git init skapar .git med HEAD, refs och objects och tipsar om grennamnet', () => {
    const { run, node } = shell();
    run('cd ~/projekt-webb');
    const r = run('git init');
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("hint: Using 'main' as the name for the initial branch.");
    expect(r.out).toContain('git config --global init.defaultBranch <name>');
    expect(r.out).toContain('Initialized empty Git repository in /home/elev/projekt-webb/.git/\n');
    expect(node(`${WEB}/.git/HEAD`)?.content).toBe('ref: refs/heads/main\n');
    expect(node(`${WEB}/.git/refs/heads`)?.type).toBe('dir');
    expect(node(`${WEB}/.git/objects`)?.type).toBe('dir');
    expect(run('git init').out).toBe('Reinitialized existing Git repository in /home/elev/projekt-webb/.git/\n');
  });

  test('init.defaultBranch och -b väljer grennamn utan tips', () => {
    const { run, node } = shell();
    run('git config --global init.defaultBranch master');
    const r = run('git init ~/a');
    expect(r.out).toBe('Initialized empty Git repository in /home/elev/a/.git/\n');
    expect(node('~/a/.git/HEAD')?.content).toBe('ref: refs/heads/master\n');
    run('git init -b trunk ~/b');
    expect(node('~/b/.git/HEAD')?.content).toBe('ref: refs/heads/trunk\n');
  });

  test('config sparas i ~/.gitconfig och kan läsas, listas och tas bort', () => {
    const { run, node } = shell();
    expect(node('~/.gitconfig')?.content).toBe('[user]\n\tname = Elev Elevsson\n\temail = elev@example.com\n');
    expect(run('git config user.name').out).toBe('Elev Elevsson\n');
    expect(run('git config --global --list').out).toBe('user.name=Elev Elevsson\nuser.email=elev@example.com\n');
    expect(run('git config get user.email').out).toBe('elev@example.com\n');
    run('git config --global alias.st "status -s"');
    expect(node('~/.gitconfig')?.content).toContain('[alias]\n\tst = status -s\n');
    run('git config --global --unset user.email');
    expect(run('git config user.email').exitCode).toBe(1);
    expect(run('git config nyckelutansektion').exitCode).toBe(2);
    expect(run('git config --local user.name x').out).toBe('fatal: not in a git directory\n');
  });

  test('commit utan identitet ger gits riktiga fel', () => {
    const { run } = shell('debian', { identity: false });
    run('cd ~/projekt-webb && git init -q && git add .');
    const r = run('git commit -m "Första"');
    expect(r.exitCode).toBe(128);
    expect(r.out).toContain('*** Please tell me who you are.');
    expect(r.out).toContain('git config --global user.email "you@example.com"');
    expect(r.out).toContain("fatal: unable to auto-detect email address (got 'elev@debian.(none)')");
  });

  test('utanför ett repo och okända kommandon', () => {
    const { run } = shell();
    expect(run('git status')).toMatchObject({ exitCode: 128, out: 'fatal: not a git repository (or any of the parent directories): .git\n' });
    expect(run('git stauts').out).toBe("git: 'stauts' is not a git command. See 'git --help'.\n\nThe most similar command is\n\tstatus\n");
  });
});

describe('status, add och commit', () => {
  test('hela flödet från untracked till commit', () => {
    const { run } = shell();
    run('cd ~/projekt-webb');
    run('git init -q');
    expect(run('git status').out).toBe(
      'On branch main\n\nNo commits yet\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n\tREADME.md\n\tindex.html\n\tstyle.css\n\nnothing added to commit but untracked files present (use "git add" to track)\n',
    );
    run('git add index.html');
    expect(run('git status -s').out).toBe('A  index.html\n?? README.md\n?? style.css\n');
    expect(run('git add finnsinte.txt')).toMatchObject({ exitCode: 128, out: "fatal: pathspec 'finnsinte.txt' did not match any files\n" });
    run('git add .');
    const c = run('git commit -m "Första versionen"');
    expect(c.out).toMatch(/^\[main \(root-commit\) [0-9a-f]{7}\] Första versionen\n 3 files changed, 24 insertions\(\+\)\n create mode 100644 README\.md\n create mode 100644 index\.html\n create mode 100644 style\.css\n$/);
    expect(run('git status').out).toBe('On branch main\nnothing to commit, working tree clean\n');
    expect(run('git commit -m "Igen"')).toMatchObject({ exitCode: 1, out: 'On branch main\nnothing to commit, working tree clean\n' });
  });

  test('ändringar som inte är tillagda, -a och färger i terminalen', () => {
    const { run, sh } = repo();
    run("sed -i 's/navy/teal/' style.css");
    run('echo ny > ny.txt');
    run('rm README.md');
    expect(run('git status').out).toBe(
      'On branch main\nChanges not staged for commit:\n  (use "git add/rm <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)\n\tdeleted:    README.md\n\tmodified:   style.css\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n\tny.txt\n\nno changes added to commit (use "git add" and/or "git commit -a")\n',
    );
    expect(sh.execute('git status').output).toContain('\t\x1b[31mmodified:   style.css\x1b[m');
    expect(run('git status -s').out).toBe(' D README.md\n M style.css\n?? ny.txt\n');
    expect(run('git commit -am "Byt färg"').out).toMatch(/^\[main [0-9a-f]{7}\] Byt färg\n 2 files changed, 1 insertion\(\+\), 4 deletions\(-\)\n delete mode 100644 README\.md\n$/);
    expect(run('git status -s').out).toBe('?? ny.txt\n');
  });

  test('commit utan -m öppnar ingen editor', () => {
    const { run } = repo();
    run('echo x >> README.md && git add README.md');
    const r = run('git commit');
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain('Aborting commit due to empty commit message.');
  });

  test('status i en underkatalog visar sökvägar relativt den', () => {
    const { run } = repo();
    run('mkdir -p sidor/bilder && echo a > sidor/om.html && echo b > sidor/bilder/x.png');
    expect(run('git status -s').out).toBe('?? sidor/\n');
    run('cd sidor && git add om.html');
    expect(run('git status -s').out).toBe('A  om.html\n?? bilder/\n');
    run("cd .. && sed -i 's/navy/red/' style.css");
    run('cd sidor');
    // Sorterat efter sökvägen i repot (sidor/om.html före style.css), som i riktiga git.
    expect(run('git status -s').out).toBe('A  om.html\n M ../style.css\n?? bilder/\n');
    expect(run('git add .. && git status -s').out).toBe('A  bilder/x.png\nA  om.html\nM  ../style.css\n');
  });

  test('--amend byter meddelande på senaste commiten', () => {
    const { run } = repo();
    run('git commit --amend -m "Bättre meddelande"');
    expect(run('git log --oneline').out).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) Bättre meddelande\n$/);
  });
});

describe('.gitignore', () => {
  test('ignorerade filer syns inte i status och läggs inte till av git add .', () => {
    const { run } = repo();
    run('echo hemligt > hemligt.txt && echo fel > fel.log && mkdir build && echo x > build/app.js && mkdir -p sub && echo y > sub/a.log');
    run("printf 'hemligt.txt\\n*.log\\nbuild/\\n' > .gitignore");
    expect(run('git status -s').out).toBe('?? .gitignore\n');
    run('git add .');
    expect(run('git status -s').out).toBe('A  .gitignore\n');
    const r = run('git add hemligt.txt');
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain('The following paths are ignored by one of your .gitignore files:\nhemligt.txt\n');
    expect(r.out).toContain('hint: Use -f if you really want to add them.');
    run('git add -f hemligt.txt');
    expect(run('git status -s').out).toBe('A  .gitignore\nA  hemligt.txt\n');
    run("printf '!viktig.log\\n' >> .gitignore && echo v > viktig.log");
    expect(run('git status -s --untracked-files=all').out).toBe('AM .gitignore\nA  hemligt.txt\n?? viktig.log\n');
  });
});

describe('diff, restore, rm och mv', () => {
  test('git diff och git diff --staged', () => {
    const { run, sh } = repo();
    run("echo 'Byggd med HTML.' >> README.md");
    const diff = run('git diff').out;
    expect(diff).toMatch(
      /^diff --git a\/README\.md b\/README\.md\nindex 1100cf4\.\.[0-9a-f]{7} 100644\n--- a\/README\.md\n\+\+\+ b\/README\.md\n@@ -1,3 \+1,4 @@\n # Min webbplats\n \n En liten webbplats som jag versionshanterar med git\.\n\+Byggd med HTML\.\n$/,
    );
    expect(sh.execute('git diff').output).toContain('\x1b[32m+Byggd med HTML.\x1b[m');
    expect(run('git diff --staged').out).toBe('');
    run('git add README.md');
    expect(run('git diff').out).toBe('');
    expect(run('git diff --cached').out).toBe(diff);
    run("sed -i 's/navy/teal/' style.css");
    expect(run('git diff --stat').out).toBe(' style.css | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\n');
    expect(run('git diff HEAD --name-only').out).toBe('README.md\nstyle.css\n');
    run("printf 'utan radslut' > ny.txt && git add ny.txt");
    expect(run('git diff --staged ny.txt').out).toContain('new file mode 100644\nindex 0000000..');
    expect(run('git diff --staged ny.txt').out).toContain('@@ -0,0 +1 @@\n+utan radslut\n\\ No newline at end of file\n');
  });

  test('restore kastar ändringar och restore --staged plockar ur indexet', () => {
    const { run, node } = repo();
    const original = node(`${WEB}/index.html`)!.content;
    run('echo hoppsan > index.html');
    run('git restore index.html');
    expect(node(`${WEB}/index.html`)!.content).toBe(original);
    run('echo extra >> README.md && git add README.md');
    run('git restore --staged README.md');
    expect(run('git status -s').out).toBe(' M README.md\n');
    expect(node(`${WEB}/README.md`)!.content).toContain('extra');
    expect(run('git restore finns.inte')).toMatchObject({ exitCode: 1, out: "error: pathspec 'finns.inte' did not match any file(s) known to git\n" });
    run('git checkout -- README.md');
    expect(run('git status -s').out).toBe('');
  });

  test('git rm och git mv', () => {
    const { run, node } = repo();
    expect(run('git mv README.md LASMIG.md').exitCode).toBe(0);
    expect(node(`${WEB}/LASMIG.md`)?.type).toBe('file');
    expect(run('git status').out).toContain('\trenamed:    README.md -> LASMIG.md\n');
    expect(run('git rm style.css').out).toBe("rm 'style.css'\n");
    expect(node(`${WEB}/style.css`)).toBeNull();
    run('echo x >> index.html');
    expect(run('git rm index.html').out).toContain('error: the following file has local modifications:\n    index.html\n');
    run('git rm --cached index.html');
    expect(node(`${WEB}/index.html`)?.type).toBe('file');
    expect(run('git status -s').out).toBe('R  README.md -> LASMIG.md\nD  index.html\nD  style.css\n?? index.html\n');
    expect(run('git mv finns.inte x').out).toBe('fatal: bad source, source=finns.inte, destination=x\n');
  });

  test('reset --hard och reflog', () => {
    const { run } = repo();
    run('echo två >> README.md && git commit -qam "Två"');
    run('echo tre >> README.md');
    expect(run('git reset --hard HEAD~1').out).toMatch(/^HEAD is now at [0-9a-f]{7} Första versionen\n$/);
    expect(run('git status -s').out).toBe('');
    expect(run('git reflog').out).toMatch(/HEAD@\{0\}: reset: moving to HEAD~1\n[0-9a-f]{7} HEAD@\{1\}: commit: Två\n[0-9a-f]{7} HEAD@\{2\}: commit \(initial\): Första versionen\n$/);
  });
});

describe('grenar och merge', () => {
  test('switch byter arbetskatalog och git branch listar grenarna', () => {
    const { run, node } = repo();
    expect(run('git switch -c ny-design').out).toBe("Switched to a new branch 'ny-design'\n");
    run("echo 'h1 { color: purple; }' >> style.css && echo ny > ny.html && git add . && git commit -qm 'Lila'");
    expect(run('git branch').out).toBe('  main\n* ny-design\n');
    run('git switch main');
    expect(node(`${WEB}/style.css`)!.content).not.toContain('purple');
    expect(node(`${WEB}/ny.html`)).toBeNull();
    run('git checkout ny-design');
    expect(node(`${WEB}/ny.html`)?.content).toBe('ny\n');
    expect(run('git switch finns-inte')).toMatchObject({ exitCode: 128, out: 'fatal: invalid reference: finns-inte\n' });
    expect(run('git branch ny-design').out).toBe("fatal: a branch named 'ny-design' already exists\n");
  });

  test('lokala ändringar som skulle skrivas över stoppar bytet', () => {
    const { run } = repo();
    run('git switch -q -c b && echo b >> style.css && git commit -qam b && git switch -q main');
    run('echo lokal >> style.css');
    const r = run('git switch b');
    expect(r.exitCode).toBe(1);
    expect(r.out).toBe(
      'error: Your local changes to the following files would be overwritten by checkout:\n\tstyle.css\nPlease commit your changes or stash them before you switch branches.\nAborting\n',
    );
    run('echo annan >> README.md && git restore style.css');
    expect(run('git switch b').out).toBe("M\tREADME.md\nSwitched to branch 'b'\n");
  });

  test('fast-forward och git branch -d', () => {
    const { run } = repo();
    run('git switch -c ny-design && echo x >> style.css && git commit -qam "Lila rubriker"');
    run('git switch main');
    expect(run('git branch -d ny-design').out).toContain("error: the branch 'ny-design' is not fully merged");
    expect(run('git merge ny-design').out).toMatch(/^Updating [0-9a-f]{7}\.\.[0-9a-f]{7}\nFast-forward\n style\.css \| 1 \+\n 1 file changed, 1 insertion\(\+\)\n$/);
    expect(run('git merge ny-design').out).toBe('Already up to date.\n');
    expect(run('git branch -d ny-design').out).toMatch(/^Deleted branch ny-design \(was [0-9a-f]{7}\)\.\n$/);
  });

  test('trevägs-merge utan konflikt ger en merge-commit och en graf', () => {
    const { run, sh } = repo();
    run('git switch -c css && echo "p { margin: 0; }" >> style.css && git commit -qam "Marginaler"');
    run('git switch main && echo "Mer text." >> README.md && git commit -qam "Mer text"');
    const r = run('git merge css');
    expect(r.out).toBe("Merge made by the 'ort' strategy.\n style.css | 1 +\n 1 file changed, 1 insertion(+)\n");
    const s = gitRepoState(sh, WEB)!;
    expect(s.commits).toBe(4);
    expect(run('git log -n 1').out).toMatch(/^commit [0-9a-f]{40} \(HEAD -> main\)\nMerge: [0-9a-f]{7} [0-9a-f]{7}\nAuthor: Elev Elevsson <elev@example.com>\nDate: {3}.+\n\n {4}Merge branch 'css'\n$/);
    const graph = run('git log --oneline --graph --all').out.replace(/[0-9a-f]{7}/g, 'H');
    expect(graph).toBe("*   H (HEAD -> main) Merge branch 'css'\n|\\\n| * H (css) Marginaler\n* | H Mer text\n|/\n* H Första versionen\n");
  });

  test('konflikt: markeringar i filen, git add och git commit avslutar', () => {
    const { run, node } = repo();
    run("git switch -c rubrik && sed -i 's/Välkommen!/Hej!/' index.html && git commit -qam 'Hej'");
    run("git switch main && sed -i 's/Välkommen!/Tjena!/' index.html && git commit -qam 'Tjena'");
    const r = run('git merge rubrik');
    expect(r).toMatchObject({
      exitCode: 1,
      out: 'Auto-merging index.html\nCONFLICT (content): Merge conflict in index.html\nAutomatic merge failed; fix conflicts and then commit the result.\n',
    });
    expect(node(`${WEB}/index.html`)!.content).toContain('<body>\n<<<<<<< HEAD\n  <h1>Tjena!</h1>\n=======\n  <h1>Hej!</h1>\n>>>>>>> rubrik\n  <p>');
    expect(run('git status -s').out).toBe('UU index.html\n');
    expect(run('git status').out).toContain('You have unmerged paths.\n');
    expect(run('git status').out).toContain('\tboth modified:   index.html\n');
    expect(run('git commit -m x').out).toContain('error: Committing is not possible because you have unmerged files.');
    run("sed -i '/^<<<<<<<\\|^=======\\|^>>>>>>>/d' index.html");
    run('git add index.html');
    expect(run('git status').out).toContain('All conflicts fixed but you are still merging.');
    const c = run('git commit');
    expect(c.out).toMatch(/\[main [0-9a-f]{7}\] Merge branch 'rubrik'\n/);
    expect(run('git log -n 1 --oneline').out).toMatch(/Merge branch 'rubrik'\n$/);
    expect(node(`${WEB}/.git/MERGE_HEAD`)).toBeNull();
    expect(run('git status').out).toBe('On branch main\nnothing to commit, working tree clean\n');
  });

  test('merge --abort och checkout --theirs', () => {
    const { run, node } = repo();
    run("git switch -c a && sed -i 's/navy/red/' style.css && git commit -qam a");
    run("git switch main && sed -i 's/navy/blue/' style.css && git commit -qam b");
    const before = node(`${WEB}/style.css`)!.content;
    run('git merge a');
    run('git merge --abort');
    expect(node(`${WEB}/style.css`)!.content).toBe(before);
    expect(run('git status -s').out).toBe('');
    run('git merge a');
    run('git checkout --theirs style.css && git add style.css && git commit -q');
    expect(node(`${WEB}/style.css`)!.content).toContain('color: red;');
  });

  test('frikopplat HEAD och switch -', () => {
    const { run } = repo();
    run('echo 2 >> README.md && git commit -qam Två');
    const r = run('git checkout HEAD~1');
    expect(r.out).toContain("You are in 'detached HEAD' state.");
    expect(run('git status').out).toMatch(/^HEAD detached at [0-9a-f]{7}\n/);
    expect(run('git switch -').out).toContain("Switched to branch 'main'");
  });

  test('stash lägger undan och tar fram ändringar', () => {
    const { run } = repo();
    run('echo tillfälligt >> style.css');
    expect(run('git stash').out).toMatch(/^Saved working directory and index state WIP on main: [0-9a-f]{7} Första versionen\n$/);
    expect(run('git status -s').out).toBe('');
    expect(run('git stash list').out).toMatch(/^stash@\{0\}: WIP on main/);
    run('git stash pop');
    expect(run('git status -s').out).toBe(' M style.css\n');
  });
});

describe('fjärr-repon', () => {
  test('clone, push till ett bare-repo och pull', () => {
    const { run, node } = repo();
    run('cd ~');
    const c = run('git clone ~/projekt-webb ~/kopia');
    expect(c.out).toBe("Cloning into '/home/elev/kopia'...\ndone.\n");
    expect(node('~/kopia/index.html')?.content).toBe(node(`${WEB}/index.html`)?.content);
    run('cd ~/kopia');
    expect(run('git status').out).toBe("On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean\n");
    expect(run('git remote -v').out).toBe('origin\t/home/elev/projekt-webb (fetch)\norigin\t/home/elev/projekt-webb (push)\n');
    run('echo kopia >> README.md && git commit -qam "Från kopian"');
    expect(run('git status').out).toContain("Your branch is ahead of 'origin/main' by 1 commit.");
    expect(run('git push').out).toContain('! [remote rejected] main -> main (branch is currently checked out)');

    run('git init -q --bare ~/server.git');
    run('git remote add server ~/server.git');
    expect(run('git push -u server main').out).toBe("To /home/elev/server.git\n * [new branch]      main -> main\nbranch 'main' set up to track 'server/main'.\n");
    run('cd ~/projekt-webb && git remote add origin ~/server.git');
    const p = run('git pull origin main');
    expect(p.out).toContain('Fast-forward');
    expect(node(`${WEB}/README.md`)?.content).toContain('kopia');
  });

  test('nätverksadresser fungerar inte i simulatorn', () => {
    const { run } = shell();
    const r = run('git clone https://github.com/torvalds/linux.git');
    expect(r.exitCode).toBe(128);
    expect(r.out).toContain("fatal: unable to access 'https://github.com/torvalds/linux.git/': Could not resolve host: github.com");
    expect(r.out).toContain('git clone ~/projekt-webb ~/kopia');
  });
});

describe('sparat tillstånd', () => {
  test('repot överlever snapshot som JSON', () => {
    const { sh, run } = repo();
    run('git switch -q -c ny && echo x >> style.css && git commit -qam Ny && git switch -q main');
    run('echo osparat >> README.md && git add README.md');
    const log = run('git log --oneline --all').out;
    const restored = Shell.restore(JSON.parse(JSON.stringify(sh.snapshot())))!;
    restored.lang = 'en';
    const out = (l: string) => stripAnsi(restored.execute(l).output);
    expect(out('git log --oneline --all')).toBe(log);
    expect(out('git status -s')).toBe('M  README.md\n');
    expect(out('git merge -q ny && git log --oneline -n 1')).toContain('Ny');
  });

  test('gamla sparade terminaler får övningskatalogen', () => {
    const sh = Shell.create('fedora');
    const snap = JSON.parse(JSON.stringify(sh.snapshot()));
    delete snap.fs.children.home.children.elev.children['projekt-webb'];
    for (const k of Object.keys(snap.flags)) if (k.includes('projekt-webb')) delete snap.flags[k];
    const restored = Shell.restore(snap)!;
    expect(restored.vfs.tryLookup(`${WEB}/index.html`, restored.rootUser())?.type).toBe('file');
  });
});
