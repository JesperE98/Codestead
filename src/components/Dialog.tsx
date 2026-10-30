import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Knappar längst ner. */
  footer?: ReactNode;
  size?: 'small' | 'large';
  /** Etikett för stängknappen (skärmläsare). */
  closeLabel?: string;
}

/** En modal dialog: stängs med Esc eller klick utanför, fokus hamnar i dialogen. */
export function Dialog({ title, onClose, children, footer, size = 'small', closeLabel = 'Close' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], button, select, input');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog dialog-${size}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <header className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <button className="icon-button dialog-x" onClick={onClose} aria-label={closeLabel}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      closeLabel={cancelLabel}
      footer={
        <>
          <button className="secondary-button" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </button>
          <button className={danger ? 'danger-button' : 'primary-button'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="dialog-message">{message}</p>
    </Dialog>
  );
}
