// Generates src/Codestead.Content/i18n/ui/<lang>.json from src/i18n/ui.ts (the TypeScript source of the UI strings).
// Usage (from the repository root): node build/gen-ui-strings.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/i18n/ui.ts'), 'utf8');

const start = src.indexOf('const sv = {');
const end = src.indexOf('export const UI');
const langs = /export const UI: Record<Lang, Dict> = \{ ([^}]+) \};/
  .exec(src)[1]
  .split(',')
  .map((s) => s.trim());
const code = src
  .slice(start, end)
  .replace(/^export type .*$/gm, '')
  .replace(/^type .*$/gm, '')
  .replace(/: Dict = \{/g, ' = {');
const UI = new Function(`${code}\nreturn { ${langs.join(', ')} };`)();

const outDir = join(root, 'src/Codestead.Content/i18n/ui');
mkdirSync(outDir, { recursive: true });
for (const lang of langs) {
  writeFileSync(join(outDir, `${lang}.json`), JSON.stringify(UI[lang], null, 2) + '\n');
}
console.log(`wrote ${langs.length} files: ${langs.join(', ')}`);
