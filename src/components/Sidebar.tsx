import { CHAPTERS, PARTS, UPCOMING } from '../content/chapters';
import { chapterTitle } from '../content/i18n';
import { chapterProgress, type Completed } from '../content/progress';
import type { Lang } from '../i18n/languages';
import type { Translate } from '../i18n/ui';
import type { Distro } from '../shell/distros';

interface Props {
  t: Translate;
  lang: Lang;
  current: string;
  distro: Distro;
  completed: Completed;
  onNavigate(id: string): void;
  onOpenSettings(): void;
}

export function Sidebar({ t, lang, current, distro, completed, onNavigate, onOpenSettings }: Props) {
  let n = 0;
  return (
    <nav className="sidebar" aria-label={t('nav.chapters')}>
      <div className="sidebar-scroll">
        {PARTS.map((part) => {
          const chapters = CHAPTERS.filter((c) => c.part === part.id);
          if (!chapters.length) return null;
          return (
            <div key={part.id} className="sidebar-part">
              <h3>{t(`part.${part.id}` as Parameters<Translate>[0])}</h3>
              <ul>
                {chapters.map((c) => {
                  n++;
                  const p = chapterProgress(c, completed, distro);
                  const done = p.done === p.total;
                  return (
                    <li key={c.id}>
                      <button
                        className={`sidebar-item${c.id === current ? ' active' : ''}${done ? ' done' : ''}`}
                        onClick={() => onNavigate(c.id)}
                        aria-current={c.id === current ? 'page' : undefined}
                      >
                        <span className="sidebar-no">{n}</span>
                        <span className="sidebar-title">{chapterTitle(c, lang)}</span>
                        <span className="sidebar-status" aria-label={t('tasks.count', { done: p.done, total: p.total })}>
                          {done ? '✓' : `${p.done}/${p.total}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {UPCOMING.length > 0 && (
          <div className="sidebar-part upcoming">
            <h3>{t('menu.upcoming')}</h3>
            <ul>
              {UPCOMING.map((u) => (
                <li key={u} className="sidebar-upcoming">
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <button className="sidebar-settings" onClick={onOpenSettings}>
          <GearIcon />
          {t('settings.open')}
        </button>
      </div>
    </nav>
  );
}

export function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
