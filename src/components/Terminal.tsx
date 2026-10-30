import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ExecResult, Shell } from '../shell/shell';
import { Ansi } from './Ansi';

interface Entry {
  prompt?: string;
  input?: string;
  output: string;
}

interface Props {
  shell: Shell;
  onResult(result: ExecResult): void;
  /** Text som ska läggas in på kommandoraden (t.ex. när man klickar på ett kodexempel). */
  inject: { text: string; nonce: number } | null;
  /** Etikett för kommandoraden (för skärmläsare), på valt språk. */
  inputLabel: string;
}

export function Terminal({ shell, onResult, inject, inputLabel }: Props) {
  const [entries, setEntries] = useState<Entry[]>(() => [{ output: shell.welcome() }]);
  const [input, setInput] = useState('');
  const [, force] = useState(0);
  const historyIndex = useRef<number | null>(null);
  const draft = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inject) return;
    setInput(inject.text);
    inputRef.current?.focus();
  }, [inject]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, input]);

  const prompt = shell.prompt();
  // Lösenord (t.ex. för passwd och su) syns inte när man skriver – precis som i en riktig terminal.
  const secret = !!shell.pending?.secret;

  const run = () => {
    const line = input;
    const shownPrompt = prompt;
    const shownInput = secret ? '' : line;
    const result = shell.execute(line);
    historyIndex.current = null;
    setInput('');
    if (result.clear) setEntries([]);
    else setEntries((e) => [...e, { prompt: shownPrompt, input: shownInput, output: result.output }]);
    onResult(result);
  };

  const browseHistory = (dir: -1 | 1) => {
    const h = shell.history;
    if (!h.length) return;
    if (historyIndex.current === null) {
      if (dir === 1) return;
      draft.current = input;
      historyIndex.current = h.length;
    }
    const next = historyIndex.current + dir;
    if (next < 0) return;
    if (next >= h.length) {
      historyIndex.current = null;
      setInput(draft.current);
      return;
    }
    historyIndex.current = next;
    setInput(h[next]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run();
    } else if (e.key === 'ArrowUp' && !shell.pending) {
      e.preventDefault();
      browseHistory(-1);
    } else if (e.key === 'ArrowDown' && !shell.pending) {
      e.preventDefault();
      browseHistory(1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (shell.pending) return;
      const { line, options } = shell.complete(input);
      setInput(line);
      if (options.length) setEntries((en) => [...en, { prompt, input, output: options.join('  ') + '\n' }]);
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      // Låt Ctrl+C kopiera om text är markerad.
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      const wasPending = !!shell.pending || shell.prompt() === '> ';
      shell.cancel();
      setEntries((en) => [...en, { prompt, input: (secret ? '' : input) + '^C', output: '' }]);
      setInput('');
      historyIndex.current = null;
      if (wasPending) force((n) => n + 1);
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      setEntries([]);
    }
  };

  const focus = () => {
    if (!window.getSelection()?.toString()) inputRef.current?.focus();
  };

  return (
    <div className="terminal" onClick={focus} dir="ltr">
      <div className="terminal-scroll" ref={scrollRef} role="log" aria-live="polite">
        {entries.map((entry, i) => (
          <div key={i} className="terminal-entry">
            {entry.prompt !== undefined && (
              <div>
                <Ansi text={entry.prompt} />
                {entry.input}
              </div>
            )}
            {entry.output && <Ansi text={entry.output} />}
          </div>
        ))}
        <div className="terminal-input-line">
          <span className="terminal-prompt">
            <Ansi text={prompt} />
          </span>
          <input
            ref={inputRef}
            className="terminal-input"
            style={secret ? { color: 'transparent', caretColor: 'var(--term-text)' } : undefined}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={inputLabel}
          />
        </div>
      </div>
    </div>
  );
}
