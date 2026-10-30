import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { chapterMarkdown, chapterTitle, languagesWithMarkdown } from '../content/i18n';
import { renderMarkdown } from '../content/render';
import type { Chapter } from '../content/types';
import { fallbackChain, LANGUAGES, type Lang } from '../i18n/languages';
import type { Translate } from '../i18n/ui';
import type { Distro } from '../shell/distros';

interface Props {
  t: Translate;
  lang: Lang;
  chapter: Chapter;
  number: number;
  total: number;
  distro: Distro;
  prev?: Chapter;
  next?: Chapter;
  onNavigate(id: string): void;
  onCommand(text: string): void;
}

export function Lesson({ t, lang, chapter, number, total, distro, prev, next, onNavigate, onCommand }: Props) {
  const html = useMemo(() => renderMarkdown(chapterMarkdown(chapter, lang), distro, lang), [chapter, distro, lang]);
  const available = languagesWithMarkdown(chapter);
  const fallback = !available.includes(lang);
  // Språket som texten faktiskt visas på (kan vara reservspråket) styr skrivriktningen.
  const shownLang = fallbackChain(lang).find((l) => available.includes(l)) ?? 'sv';
  const shownDir = LANGUAGES.find((l) => l.code === shownLang)?.dir ?? 'ltr';
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [chapter]);

  // Gör varje rad i ```sh-block klickbar: klick lägger in kommandot i terminalen.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const code of root.querySelectorAll<HTMLElement>('pre > code.language-sh')) {
      const lines = (code.textContent ?? '').replace(/\n$/, '').split('\n');
      code.textContent = '';
      for (const line of lines) {
        const span = document.createElement('span');
        span.className = 'cmd-line';
        span.textContent = line;
        span.title = t('lesson.cmdTitle');
        span.dataset.cmd = line;
        span.dataset.hint = t('lesson.cmdHint');
        code.append(span, '\n');
      }
      code.parentElement?.classList.add('runnable');
      code.parentElement?.setAttribute('dir', 'ltr');
    }
    for (const pre of root.querySelectorAll('pre')) pre.setAttribute('dir', 'ltr');
  }, [html, t]);

  const onClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.cmd-line');
    if (target?.dataset.cmd) onCommand(target.dataset.cmd);
  };

  return (
    <article className="lesson" ref={ref} onClick={onClick}>
      <div className="lesson-chapter-no">{t('lesson.chapter', { n: number, total })}</div>
      {fallback && (
        <p className="lesson-fallback" role="note">
          {t('lesson.fallback')}
        </p>
      )}
      <div className="lesson-body" lang={shownLang} dir={shownDir} dangerouslySetInnerHTML={{ __html: html }} />
      <nav className="lesson-nav" aria-label={t('nav.chapters')}>
        {prev ? (
          <button className="nav-button" onClick={() => onNavigate(prev.id)}>
            <span className="nav-dir">← {t('lesson.prev')}</span>
            <span>{chapterTitle(prev, lang)}</span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button className="nav-button next" onClick={() => onNavigate(next.id)}>
            <span className="nav-dir">{t('lesson.next')} →</span>
            <span>{chapterTitle(next, lang)}</span>
          </button>
        )}
      </nav>
    </article>
  );
}
