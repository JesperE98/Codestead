// The stylesheets of a scene's shadow roots: the visualizer's (main.css and every slide's), highlight.js's for the
// code, and the embedding's own (embed.css), in a dark and a light version (engine/css.ts); the light version also has
// light-only.css (what stays dark on purpose), as it is written.

import hljsDark from 'highlight.js/styles/github-dark.css?inline';
import hljsLight from 'highlight.js/styles/github.css?inline';
import mainCss from '../visualizer/styles/main.css?inline';
import { lightCss, scopeToScene, stripViewportMedia } from './css';
import embedCss from './embed.css?inline';
import lightOnlyCss from './light-only.css?inline';

const slideCss = Object.values(import.meta.glob<string>('../visualizer/styles/slides/*.css', { query: '?inline', import: 'default', eager: true }));

const visualizerCss = scopeToScene(stripViewportMedia([mainCss, ...slideCss, embedCss].join('\n')));

const sheets = new Map<string, CSSStyleSheet[]>();

function sheet(text: string): CSSStyleSheet {
  const s = new CSSStyleSheet();
  s.replaceSync(text);
  return s;
}

/** The stylesheets for a shadow root of a scene in the theme. */
export function sceneSheets(theme: 'light' | 'dark'): CSSStyleSheet[] {
  let list = sheets.get(theme);
  if (!list) {
    const light = theme === 'light';
    list = [sheet(light ? lightCss(visualizerCss) + '\n:host { color-scheme: light; }\n' + lightOnlyCss : visualizerCss), sheet(light ? hljsLight : hljsDark)];
    sheets.set(theme, list);
  }
  return list;
}
