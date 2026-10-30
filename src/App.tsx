import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './components/Dialog';
import { Lesson } from './components/Lesson';
import { Settings, type Theme } from './components/Settings';
import { GearIcon, Sidebar } from './components/Sidebar';
import { TaskPanel } from './components/TaskPanel';
import { Terminal } from './components/Terminal';
import { CHAPTERS } from './content/chapters';
import { chapterTitle } from './content/i18n';
import { evaluateTasks, totalProgress, type Completed } from './content/progress';
import { detectLang, isLang, LANGUAGES, type Lang } from './i18n/languages';
import { translate, type Translate } from './i18n/ui';
import { DISTROS, getDistro, type Family } from './shell/distros';
import { Shell, type ExecResult } from './shell/shell';
import { load, remove, save } from './storage';

function chapterFromHash(): string | null {
  const m = /^#\/kapitel\/([\w-]+)/.exec(window.location.hash);
  return m && CHAPTERS.some((c) => c.id === m[1]) ? m[1] : null;
}

function loadShell(distroId: string): Shell {
  return Shell.restore(load<unknown>(`shell.${distroId}`, null)) ?? Shell.create(distroId);
}

type Confirm = 'terminal' | 'progress' | null;

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = load<string | null>('lang', null);
    return saved && isLang(saved) ? saved : detectLang();
  });
  const [distroId, setDistroId] = useState(() => getDistro(load('distro', 'ubuntu')).id);
  const [shell, setShell] = useState(() => loadShell(distroId));
  const [terminalKey, setTerminalKey] = useState(0);
  const [completed, setCompleted] = useState<Completed>(() => load('progress', {}));
  const [justCompleted, setJustCompleted] = useState<string[]>([]);
  const [chapterId, setChapterId] = useState(() => chapterFromHash() ?? load('chapter', CHAPTERS[0].id));
  const [inject, setInject] = useState<{ text: string; nonce: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('theme', null));
  const freshTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  const t: Translate = useCallback((key, params) => translate(lang, key, params), [lang]);
  const distro = getDistro(distroId);
  const index = Math.max(0, CHAPTERS.findIndex((c) => c.id === chapterId));
  const chapter = CHAPTERS[index];
  const prev = CHAPTERS[index - 1];
  const next = CHAPTERS[index + 1];
  const total = useMemo(() => totalProgress(completed, distro), [completed, distro]);
  const langInfo = LANGUAGES.find((l) => l.code === lang)!;

  // Skalets egna meddelanden och manualsidor: svenska eller engelska.
  shell.lang = lang === 'sv' ? 'sv' : 'en';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = langInfo.dir;
    save('lang', lang);
  }, [lang, langInfo.dir]);

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
    document.title = `${chapterTitle(chapter, lang)} – LinuxLearningTool`;
  }, [chapter, lang]);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    save('theme', theme);
  }, [theme]);

  const showToast = (text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };

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

  const doResetTerminal = () => {
    remove(`shell.${distroId}`);
    setShell(Shell.create(distroId));
    setTerminalKey((k) => k + 1);
    setConfirm(null);
    setSettingsOpen(false);
    showToast(t('toast.terminalReset'));
  };

  const doResetProgress = () => {
    setCompleted({});
    save('progress', {});
    setConfirm(null);
    setSettingsOpen(false);
    showToast(t('toast.progressReset'));
  };

  const onCommand = useCallback((text: string) => setInject({ text, nonce: Date.now() }), []);
  const familyOrder: Family[] = ['debian', 'arch', 'redhat'];

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-button menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label={t('nav.showChapters')} aria-expanded={menuOpen}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <a className="brand" href={`#/kapitel/${CHAPTERS[0].id}`} onClick={() => navigate(CHAPTERS[0].id)}>
          <span className="brand-mark" dir="ltr">&gt;_</span>
          <span className="brand-name">LinuxLearningTool</span>
        </a>
        <div className="progress" title={t('progress.title', { done: total.done, total: total.total, family: t(`family.${distro.family}`) })}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(total.done / total.total) * 100}%` }} />
          </div>
          <span className="progress-text">{t('progress.short', { done: total.done, total: total.total })}</span>
        </div>
        <label className="picker" title={t('distro.label')}>
          <span className="distro-dot" style={{ background: distro.accent }} aria-hidden />
          <span className="visually-hidden">{t('distro.label')}</span>
          <select value={distroId} onChange={(e) => changeDistro(e.target.value)}>
            {familyOrder.map((f) => (
              <optgroup key={f} label={t(`family.${f}`)}>
                {DISTROS.filter((d) => d.family === f).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="picker lang-picker" title={t('lang.label')}>
          <GlobeIcon />
          <span className="visually-hidden">{t('lang.label')}</span>
          <select value={lang} onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label={t('settings.open')} title={t('settings.open')}>
          <GearIcon />
        </button>
      </header>

      <div className={`layout${menuOpen ? ' menu-open' : ''}`}>
        <Sidebar t={t} lang={lang} current={chapter.id} distro={distro} completed={completed} onNavigate={navigate} onOpenSettings={() => setSettingsOpen(true)} />
        <main className="content">
          <Lesson t={t} lang={lang} chapter={chapter} number={index + 1} total={CHAPTERS.length} distro={distro} prev={prev} next={next} onNavigate={navigate} onCommand={onCommand} />
        </main>
        <aside className="workbench">
          <TaskPanel t={t} lang={lang} chapter={chapter} distro={distro} completed={completed} justCompleted={justCompleted} next={next} onNavigate={navigate} onCommand={onCommand} />
          <div className="terminal-frame" dir="ltr">
            <div className="terminal-titlebar">
              <span className="terminal-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="terminal-title">
                {shell.currentUser().name}@{distro.hostname} — {distro.name}
              </span>
              <button className="terminal-reset" onClick={() => setConfirm('terminal')} title={t('terminal.resetTitle')}>
                <ResetIcon />
                {t('terminal.reset')}
              </button>
            </div>
            <Terminal key={`${distroId}-${terminalKey}`} shell={shell} onResult={onResult} inject={inject} inputLabel={t('terminal.input')} />
          </div>
        </aside>
      </div>

      {settingsOpen && !confirm && (
        <Settings
          t={t}
          lang={lang}
          theme={theme}
          distro={distro}
          onLang={setLang}
          onTheme={setTheme}
          onDistro={changeDistro}
          onResetTerminal={() => setConfirm('terminal')}
          onResetProgress={() => setConfirm('progress')}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {confirm === 'terminal' && (
        <ConfirmDialog
          title={t('reset.terminal.title')}
          message={t('reset.terminal.confirm', { distro: distro.name })}
          confirmLabel={t('reset.terminal.button')}
          cancelLabel={t('dialog.cancel')}
          danger
          onConfirm={doResetTerminal}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'progress' && (
        <ConfirmDialog
          title={t('reset.progress.title')}
          message={t('reset.progress.confirm')}
          confirmLabel={t('reset.progress.button')}
          cancelLabel={t('dialog.cancel')}
          danger
          onConfirm={doResetProgress}
          onCancel={() => setConfirm(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
