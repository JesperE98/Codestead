import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lesson } from './components/Lesson';
import { Sidebar } from './components/Sidebar';
import { TaskPanel } from './components/TaskPanel';
import { Terminal } from './components/Terminal';
import { CHAPTERS } from './content/chapters';
import { evaluateTasks, totalProgress, type Completed } from './content/progress';
import { DISTROS, FAMILIES, getDistro, type Family } from './shell/distros';
import { Shell, type ExecResult } from './shell/shell';
import { load, remove, save } from './storage';

function chapterFromHash(): string | null {
  const m = /^#\/kapitel\/([\w-]+)/.exec(window.location.hash);
  return m && CHAPTERS.some((c) => c.id === m[1]) ? m[1] : null;
}

function loadShell(distroId: string): Shell {
  return Shell.restore(load<unknown>(`shell.${distroId}`, null)) ?? Shell.create(distroId);
}

type Theme = 'light' | 'dark';

export function App() {
  const [distroId, setDistroId] = useState(() => getDistro(load('distro', 'ubuntu')).id);
  const [shell, setShell] = useState(() => loadShell(distroId));
  const [terminalKey, setTerminalKey] = useState(0);
  const [completed, setCompleted] = useState<Completed>(() => load('progress', {}));
  const [justCompleted, setJustCompleted] = useState<string[]>([]);
  const [chapterId, setChapterId] = useState(() => chapterFromHash() ?? load('chapter', CHAPTERS[0].id));
  const [inject, setInject] = useState<{ text: string; nonce: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(() => load<Theme | null>('theme', null));
  const freshTimer = useRef<number | undefined>(undefined);

  const distro = getDistro(distroId);
  const index = Math.max(0, CHAPTERS.findIndex((c) => c.id === chapterId));
  const chapter = CHAPTERS[index];
  const prev = CHAPTERS[index - 1];
  const next = CHAPTERS[index + 1];
  const total = useMemo(() => totalProgress(completed, distro), [completed, distro]);

  useEffect(() => {
    const onHash = () => {
      const id = chapterFromHash();
      if (id) setChapterId(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    save('chapter', chapter.id);
    const hash = `#/kapitel/${chapter.id}`;
    if (window.location.hash !== hash) history.replaceState(null, '', hash);
    document.title = `${chapter.title} – LinuxLearningTool`;
  }, [chapter]);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    save('theme', theme);
  }, [theme]);

  const navigate = useCallback((id: string) => {
    setChapterId(id);
    setMenuOpen(false);
  }, []);

  const onResult = useCallback(
    (result: ExecResult) => {
      save(`shell.${shell.distro.id}`, shell.snapshot());
      const newly = evaluateTasks(chapter, shell, result, completed);
      if (!newly.length) return;
      setCompleted((c) => {
        const updated = { ...c };
        for (const k of newly) updated[k] = true;
        save('progress', updated);
        return updated;
      });
      setJustCompleted(newly);
      window.clearTimeout(freshTimer.current);
      freshTimer.current = window.setTimeout(() => setJustCompleted([]), 2000);
    },
    [chapter, shell, completed],
  );

  const changeDistro = (id: string) => {
    save(`shell.${shell.distro.id}`, shell.snapshot());
    setDistroId(id);
    save('distro', id);
    setShell(loadShell(id));
    setTerminalKey((k) => k + 1);
  };

  const resetTerminal = () => {
    if (!confirm(`Återställa terminalen? Alla filer du skapat i ${distro.name} försvinner. Dina framsteg i kapitlen finns kvar.`)) return;
    remove(`shell.${distroId}`);
    setShell(Shell.create(distroId));
    setTerminalKey((k) => k + 1);
  };

  const resetProgress = () => {
    if (!confirm('Nollställa alla framsteg? Alla avbockade uppgifter försvinner.')) return;
    setCompleted({});
    save('progress', {});
  };

  const onCommand = useCallback((text: string) => setInject({ text, nonce: Date.now() }), []);

  const familyOrder: Family[] = ['debian', 'arch', 'redhat'];

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-button menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label="Visa kapitel" aria-expanded={menuOpen}>
          ☰
        </button>
        <a className="brand" href="#/kapitel/valkommen" onClick={() => navigate(CHAPTERS[0].id)}>
          <span className="brand-mark">&gt;_</span>
          <span className="brand-name">LinuxLearningTool</span>
        </a>
        <div className="progress" title={`${total.done} av ${total.total} uppgifter klara i ${FAMILIES[distro.family].name}`}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(total.done / total.total) * 100}%` }} />
          </div>
          <span className="progress-text">
            {total.done}/{total.total}
          </span>
        </div>
        <label className="distro-picker">
          <span className="distro-dot" style={{ background: distro.accent }} />
          <span className="visually-hidden">Distribution</span>
          <select value={distroId} onChange={(e) => changeDistro(e.target.value)}>
            {familyOrder.map((f) => (
              <optgroup key={f} label={`${FAMILIES[f].name} (${FAMILIES[f].packageManager})`}>
                {DISTROS.filter((d) => d.family === f).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          className="icon-button"
          onClick={() => setTheme(document.documentElement.matches('[data-theme="dark"]') || (!theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark')}
          aria-label="Byt mellan ljust och mörkt tema"
          title="Ljust/mörkt tema"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
          </svg>
        </button>
      </header>

      <div className={`layout${menuOpen ? ' menu-open' : ''}`}>
        <Sidebar current={chapter.id} distro={distro} completed={completed} onNavigate={navigate} onResetProgress={resetProgress} />
        <main className="content">
          <Lesson chapter={chapter} number={index + 1} distro={distro} prev={prev} next={next} onNavigate={navigate} onCommand={onCommand} />
        </main>
        <aside className="workbench">
          <TaskPanel
            chapter={chapter}
            distro={distro}
            completed={completed}
            justCompleted={justCompleted}
            next={next}
            onNavigate={navigate}
            onCommand={onCommand}
          />
          <div className="terminal-frame">
            <div className="terminal-titlebar">
              <span className="terminal-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="terminal-title">
                elev@{distro.hostname} — {distro.name}
              </span>
              <button className="terminal-reset" onClick={resetTerminal} title="Återställ filsystem och paket">
                Återställ
              </button>
            </div>
            <Terminal key={`${distroId}-${terminalKey}`} shell={shell} onResult={onResult} inject={inject} />
          </div>
        </aside>
      </div>
    </div>
  );
}
