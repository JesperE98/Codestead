import { Fragment, useMemo } from 'react';

interface Segment {
  text: string;
  cls: string;
}

/** Delar upp text med ANSI-färgkoder (\x1b[...m) i segment med CSS-klasser. */
export function parseAnsi(text: string): Segment[] {
  const out: Segment[] = [];
  let fg = 0;
  let bg = 0;
  let bold = false;
  let dim = false;
  // eslint-disable-next-line no-control-regex
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  const cls = () => [bold && 'a-b', dim && 'a-d', fg && `a-f${fg}`, bg && `a-g${bg}`].filter(Boolean).join(' ');
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), cls: cls() });
    last = re.lastIndex;
    for (const code of (m[1] || '0').split(';').map(Number)) {
      if (code === 0) [fg, bg, bold, dim] = [0, 0, false, false];
      else if (code === 1) bold = true;
      else if (code === 2) dim = true;
      else if (code === 22) [bold, dim] = [false, false];
      else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) fg = code;
      else if (code === 39) fg = 0;
      else if (code >= 40 && code <= 47) bg = code;
      else if (code === 49) bg = 0;
    }
  }
  if (last < text.length) out.push({ text: text.slice(last), cls: cls() });
  return out;
}

export function Ansi({ text }: { text: string }) {
  const parts = useMemo(() => parseAnsi(text), [text]);
  return (
    <>
      {parts.map((p, i) =>
        p.cls ? (
          <span key={i} className={p.cls}>
            {p.text}
          </span>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
