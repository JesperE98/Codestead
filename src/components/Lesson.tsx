import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { chapterMarkdown } from '../content/i18n';
import { renderMarkdown } from '../content/render';
import type { Chapter } from '../content/types';
import type { Distro } from '../shell/distros';

interface Props {
  chapter: Chapter;
  number: number;
  distro: Distro;
  prev?: Chapter;
  next?: Chapter;
  onNavigate(id: string): void;
  onCommand(text: string): void;
}

export function Lesson({ chapter, number, distro, prev, next, onNavigate, onCommand }: Props) {
  const html = useMemo(() => renderMarkdown(chapterMarkdown(chapter, 'sv'), distro), [chapter, distro]);
  const ref = useRef<HTMLElement>(null);

  // Gör varje rad i ```sh-block klickbar: klick lägger in kommandot i terminalen.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.scrollTop = 0;
    for (const code of root.querySelectorAll<HTMLElement>('pre > code.language-sh')) {
      const lines = (code.textContent ?? '').replace(/\n$/, '').split('\n');
      code.textContent = '';
      for (const line of lines) {
        const span = document.createElement('span');
        span.className = 'cmd-line';
        span.textContent = line;
        span.title = 'Klicka för att lägga in kommandot i terminalen';
        span.dataset.cmd = line;
        code.append(span, '\n');
      }
      code.parentElement?.classList.add('runnable');
    }
  }, [html]);

  const onClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.cmd-line');
    if (target?.dataset.cmd) onCommand(target.dataset.cmd);
  };

  return (
    <article className="lesson" ref={ref} onClick={onClick}>
      <div className="lesson-chapter-no">Kapitel {number}</div>
      <div className="lesson-body" dangerouslySetInnerHTML={{ __html: html }} />
      <nav className="lesson-nav" aria-label="Kapitelnavigering">
        {prev ? (
          <button className="nav-button" onClick={() => onNavigate(prev.id)}>
            <span className="nav-dir">← Föregående</span>
            <span>{prev.title}</span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button className="nav-button next" onClick={() => onNavigate(next.id)}>
            <span className="nav-dir">Nästa →</span>
            <span>{next.title}</span>
          </button>
        )}
      </nav>
    </article>
  );
}
