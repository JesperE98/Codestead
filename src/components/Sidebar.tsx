import { CHAPTERS, PARTS, UPCOMING } from '../content/chapters';
import { chapterProgress, type Completed } from '../content/progress';
import type { Distro } from '../shell/distros';

interface Props {
  current: string;
  distro: Distro;
  completed: Completed;
  onNavigate(id: string): void;
  onResetProgress(): void;
}

export function Sidebar({ current, distro, completed, onNavigate, onResetProgress }: Props) {
  let n = 0;
  return (
    <nav className="sidebar" aria-label="Kapitel">
      {PARTS.map((part) => (
        <div key={part.id} className="sidebar-part">
          <h3>{part.title}</h3>
          <ul>
            {CHAPTERS.filter((c) => c.part === part.id).map((c) => {
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
                    <span className="sidebar-title">{c.title}</span>
                    <span className="sidebar-status">{done ? '✓' : `${p.done}/${p.total}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="sidebar-part upcoming">
        <h3>Kommer snart</h3>
        <ul>
          {UPCOMING.map((t) => (
            <li key={t} className="sidebar-upcoming">
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="sidebar-footer">
        <button className="link-button" onClick={onResetProgress}>
          Nollställ framsteg
        </button>
        <a href="https://github.com/jesper-e98/LinuxLearningTool" target="_blank" rel="noreferrer">
          Källkod på GitHub
        </a>
      </div>
    </nav>
  );
}
