import { useState } from 'react';
import { taskKey } from '../content/chapters';
import type { Completed } from '../content/progress';
import { renderInline } from '../content/render';
import { resolve, type Chapter, type Task } from '../content/types';
import { FAMILIES, type Distro, type Family } from '../shell/distros';

interface Props {
  chapter: Chapter;
  distro: Distro;
  completed: Completed;
  justCompleted: string[];
  next?: Chapter;
  onNavigate(id: string): void;
  onCommand(text: string): void;
}

const FAMILY_SHORT: Record<Family, string> = { debian: 'Debian', arch: 'Arch', redhat: 'Red Hat' };

function TaskItem({ task, chapter, distro, completed, fresh, onCommand }: {
  task: Task;
  chapter: Chapter;
  distro: Distro;
  completed: Completed;
  fresh: boolean;
  onCommand(text: string): void;
}) {
  const [open, setOpen] = useState<'hint' | 'solution' | null>(null);
  const done = !!completed[taskKey(chapter.id, task.id, task.perFamily, distro.family)];
  const hint = task.hint ? resolve(task.hint, distro) : null;
  const solution = resolve(task.solution, distro);
  return (
    <li className={`task${done ? ' done' : ''}${fresh ? ' fresh' : ''}`}>
      <span className="task-check" aria-label={done ? 'Klar' : 'Inte klar'}>
        {done ? '✓' : ''}
      </span>
      <div className="task-main">
        <div className="task-text" dangerouslySetInnerHTML={{ __html: renderInline(resolve(task.text, distro), distro) }} />
        {task.perFamily && (
          <div className="task-families" title="Den här uppgiften räknas separat för varje distributionsfamilj">
            {(Object.keys(FAMILIES) as Family[]).map((f) => (
              <span key={f} className={`family-chip${completed[taskKey(chapter.id, task.id, true, f)] ? ' on' : ''}`}>
                {FAMILY_SHORT[f]}
              </span>
            ))}
          </div>
        )}
        <div className="task-actions">
          {hint && (
            <button className="link-button" onClick={() => setOpen(open === 'hint' ? null : 'hint')}>
              {open === 'hint' ? 'Dölj tips' : 'Tips'}
            </button>
          )}
          <button className="link-button" onClick={() => setOpen(open === 'solution' ? null : 'solution')}>
            {open === 'solution' ? 'Dölj lösning' : 'Visa lösning'}
          </button>
        </div>
        {open === 'hint' && hint && <div className="task-hint" dangerouslySetInnerHTML={{ __html: renderInline(hint, distro) }} />}
        {open === 'solution' && (
          <div className="task-solution">
            {solution.map((cmd, i) => (
              <button key={i} className="solution-cmd" onClick={() => onCommand(cmd)} title="Lägg in i terminalen">
                {cmd}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export function TaskPanel({ chapter, distro, completed, justCompleted, next, onNavigate, onCommand }: Props) {
  const done = chapter.tasks.filter((t) => completed[taskKey(chapter.id, t.id, t.perFamily, distro.family)]).length;
  const all = done === chapter.tasks.length;
  return (
    <section className="tasks" aria-label="Uppgifter">
      <header className="tasks-header">
        <h2>Uppgifter</h2>
        <span className="tasks-count">
          {done} av {chapter.tasks.length}
        </span>
      </header>
      <ol className="task-list">
        {chapter.tasks.map((t) => (
          <TaskItem
            key={`${chapter.id}/${t.id}`}
            task={t}
            chapter={chapter}
            distro={distro}
            completed={completed}
            fresh={justCompleted.includes(taskKey(chapter.id, t.id, t.perFamily, distro.family))}
            onCommand={onCommand}
          />
        ))}
      </ol>
      {all && (
        <div className="tasks-done">
          <strong>Snyggt – kapitlet är klart!</strong>
          {next ? (
            <button className="primary-button" onClick={() => onNavigate(next.id)}>
              Nästa: {next.title} →
            </button>
          ) : (
            <span>Du har gjort alla kapitel som finns hittills. Prova att byta distribution och gör distro-kapitlen igen!</span>
          )}
        </div>
      )}
    </section>
  );
}
