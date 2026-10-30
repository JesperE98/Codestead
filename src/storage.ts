// Små hjälpfunktioner runt localStorage. Allt är inslaget i try/catch eftersom
// lagringen kan vara avstängd (t.ex. i privat läge).

const PREFIX = 'llt.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Full eller avstängd lagring – appen fungerar ändå, men sparar inget.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignoreras */
  }
}
