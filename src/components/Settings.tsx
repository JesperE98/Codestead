import { LANGUAGES, type Lang } from '../i18n/languages';
import type { Translate } from '../i18n/ui';
import { DISTROS, type Distro, type Family } from '../shell/distros';
import { Dialog } from './Dialog';

export type Theme = 'light' | 'dark' | null;

interface Props {
  t: Translate;
  lang: Lang;
  theme: Theme;
  distro: Distro;
  onLang(lang: Lang): void;
  onTheme(theme: Theme): void;
  onDistro(id: string): void;
  onResetTerminal(): void;
  onResetProgress(): void;
  onClose(): void;
}

const FAMILY_ORDER: Family[] = ['debian', 'arch', 'redhat'];

export function Settings({ t, lang, theme, distro, onLang, onTheme, onDistro, onResetTerminal, onResetProgress, onClose }: Props) {
  return (
    <Dialog title={t('settings.title')} onClose={onClose} size="large" closeLabel={t('dialog.close')} footer={<button className="primary-button" onClick={onClose}>{t('dialog.close')}</button>}>
      <section className="settings-section">
        <h3>{t('settings.language')}</h3>
        <div className="lang-grid" role="radiogroup" aria-label={t('settings.language')}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={l.code === lang}
              className={`choice${l.code === lang ? ' selected' : ''}`}
              onClick={() => onLang(l.code)}
              lang={l.code}
              dir={l.dir}
            >
              {l.name}
            </button>
          ))}
        </div>
        {lang !== 'sv' && lang !== 'en' && <p className="settings-note">{t('settings.languageNote')}</p>}
      </section>

      <section className="settings-section">
        <h3>{t('settings.theme')}</h3>
        <div className="segmented" role="radiogroup" aria-label={t('settings.theme')}>
          {([null, 'light', 'dark'] as Theme[]).map((v) => (
            <button key={String(v)} role="radio" aria-checked={theme === v} className={`choice${theme === v ? ' selected' : ''}`} onClick={() => onTheme(v)}>
              {v === null ? t('theme.system') : v === 'light' ? t('theme.light') : t('theme.dark')}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.distro')}</h3>
        <select className="settings-select" value={distro.id} onChange={(e) => onDistro(e.target.value)} aria-label={t('settings.distro')}>
          {FAMILY_ORDER.map((f) => (
            <optgroup key={f} label={t(`family.${f}`)}>
              {DISTROS.filter((d) => d.family === f).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="settings-note">{t('settings.distroNote')}</p>
      </section>

      <section className="settings-section danger-zone">
        <h3>{t('settings.reset')}</h3>
        <div className="reset-row">
          <div>
            <strong>{t('reset.terminal.title')}</strong>
            <p>{t('reset.terminal.desc', { distro: distro.name })}</p>
          </div>
          <button className="danger-outline-button" onClick={onResetTerminal}>
            {t('reset.terminal.button')}
          </button>
        </div>
        <div className="reset-row">
          <div>
            <strong>{t('reset.progress.title')}</strong>
            <p>{t('reset.progress.desc')}</p>
          </div>
          <button className="danger-outline-button" onClick={onResetProgress}>
            {t('reset.progress.button')}
          </button>
        </div>
      </section>
    </Dialog>
  );
}
