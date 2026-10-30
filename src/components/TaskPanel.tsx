import { useState } from 'react';
import { taskKey } from '../content/chapters';
import { chapterTitle, taskHint, taskText } from '../content/i18n';
import type { Completed } from '../content/progress';
import { renderInline } from '../content/render';
import { resolve, type Chapter, type Task } from '../content/types';
import type { Lang } from '../i18n/languages';
import type { Translate } from '../i18n/ui';
import type { Distro, Family } from '../shell/distros';

interface Props {
  t: Translate;
  lang: Lang;
  chapter: Chapter;
  distro: Distro;
  completed: Completed;
  justCompleted: string[];
  next?: Chapter;
  onNavigate(id: string): void;
  onCommand(text: string): void;
}

const FAMILY_SHORT: Record<Family, string> = { debian: 'Debian', arch: 'Arch', redhat: 'Red Hat' };

function TaskItem({
  t,
  lang,
  task,
  chapter,
  distro,
  completed,
  fresh,
  onCommand,
}: {
  t: Translate;
  lang: Lang;
  task: Task;
  chapter: Chapter;
  distro: Distro;
  completed: Completed;
  fresh: boolean;
  onCommand(text: string): void;
}) {
  const [open, setOpen] = useState<'hint' | 'solution' | null>(null);
  const done = !!completed[taskKey(chapter.id, task.id, task.perFamily, distro.family)];
  const hint = taskHint(chapter, task, lang, distro);
  const solution = resolve(task.solution, distro);
  return (
    <li className={`task${done ? ' done' : ''}${fresh ? ' fresh' : ''}`}>
      <span className="task-check" role="img" aria-label={done ? t('tasks.done') : t('tasks.notDone')}>
        {done ? '✓' : ''}
      </span>
      <div className="task-main">
        <div className="task-text" dir="auto" dangerouslySetInnerHTML={{ __html: renderInline(taskText(chapter, task, lang, distro), distro, lang) }} />
        {task.perFamily && (
          <div className="task-families" title={t('tasks.perFamily')}>
            {(['debian', 'arch', 'redhat'] as Family[]).map((f) => (
              <span key={f} className={`family-chip${completed[taskKey(chapter.id, task.id, true, f)] ? ' on' : ''}${f === distro.family ? ' current' : ''}`}>
                {completed[taskKey(chapter.id, task.id, true, f)] ? '✓ ' : ''}
                {FAMILY_SHORT[f]}
              </span>
            ))}
          </div>
        )}
        <div className="task-actions">
          {hint && (
            <button className={`task-button${open === 'hint' ? ' active' : ''}`} onClick={() => setOpen(open === 'hint' ? null : 'hint')} aria-expanded={open === 'hint'}>
              <BulbIcon />
              {open === 'hint' ? t('tasks.hideHint') : t('tasks.hint')}
            </button>
          )}
          <button className={`task-button${open === 'solution' ? ' active' : ''}`} onClick={() => setOpen(open === 'solution' ? null : 'solution')} aria-expanded={open === 'solution'}>
            <EyeIcon />
            {open === 'solution' ? t('tasks.hideSolution') : t('tasks.solution')}
          </button>
        </div>
        {open === 'hint' && hint && <div className="task-hint" dir="auto" dangerouslySetInnerHTML={{ __html: renderInline(hint, distro, lang) }} />}
        {open === 'solution' && (
          <div className="task-solution">
            <span className="task-solution-help">{t('tasks.solutionHelp')}</span>
            <div className="task-solution-cmds" dir="ltr">
              {solution.map((cmd, i) => (
                <button key={i} className="solution-cmd" onClick={() => onCommand(cmd)} title={t('lesson.cmdTitle')}>
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export function TaskPanel({ t, lang, chapter, distro, completed, justCompleted, next, onNavigate, onCommand }: Props) {
  const done = chapter.tasks.filter((task) => completed[taskKey(chapter.id, task.id, task.perFamily, distro.family)]).length;
  const all = done === chapter.tasks.length;
  return (
    <section className="tasks" aria-label={t('tasks.title')}>
      <header className="tasks-header">
        <h2>{t('tasks.title')}</h2>
        <span className="tasks-count">{t('tasks.count', { done, total: chapter.tasks.length })}</span>
      </header>
      <div className="tasks-progress" aria-hidden>
        <div style={{ width: `${(done / chapter.tasks.length) * 100}%` }} />
      </div>
      <ol className="task-list">
        {chapter.tasks.map((task) => (
          <TaskItem
            key={`${chapter.id}/${task.id}/${lang}`}
            t={t}
            lang={lang}
            task={task}
            chapter={chapter}
            distro={distro}
            completed={completed}
            fresh={justCompleted.includes(taskKey(chapter.id, task.id, task.perFamily, distro.family))}
            onCommand={onCommand}
          />
        ))}
      </ol>
      {all && (
        <div className="tasks-done">
          <strong>{t('tasks.chapterDone')}</strong>
          {next ? (
            <button className="primary-button" onClick={() => onNavigate(next.id)}>
              {t('tasks.next', { title: chapterTitle(next, lang) })} →
            </button>
          ) : (
            <span>{t('tasks.allDone')}</span>
          )}
        </div>
      )}
    </section>
  );
}

function BulbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
