// Språken som appen finns på. Svenska är originalspråket; engelska är reserv
// för allt som saknar översättning.

export type Lang = 'sv' | 'en' | 'es' | 'zh' | 'hi' | 'ar' | 'pt' | 'fr' | 'de' | 'ru' | 'ja';

export interface LanguageInfo {
  code: Lang;
  /** Språkets namn på språket självt. */
  name: string;
  /** Skrivriktning. */
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'sv', name: 'Svenska', dir: 'ltr' },
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'zh', name: '中文', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'pt', name: 'Português', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', dir: 'ltr' },
  { code: 'ru', name: 'Русский', dir: 'ltr' },
  { code: 'ja', name: '日本語', dir: 'ltr' },
];

export function isLang(code: string): code is Lang {
  return LANGUAGES.some((l) => l.code === code);
}

/** Språk att visa första gången: webbläsarens språk om vi har det, annars engelska. */
export function detectLang(): Lang {
  try {
    for (const l of navigator.languages ?? [navigator.language]) {
      const code = l.toLowerCase().split('-')[0];
      if (code === 'nb' || code === 'nn' || code === 'no' || code === 'da') return 'sv';
      if (isLang(code)) return code;
    }
  } catch {
    /* t.ex. i tester */
  }
  return 'en';
}

/** Ordningen vi letar i när en text saknas på valt språk. */
export function fallbackChain(lang: Lang): Lang[] {
  return [...new Set<Lang>([lang, 'en', 'sv'])];
}
