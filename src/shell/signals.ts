// Undantag som används för att hoppa ur skript, funktioner och loopar.
// De fångas av skalet och får aldrig visas som "internt fel".

/** `exit` i ett skript. */
export class ExitSignal {
  constructor(public code: number) {}
}

/** `return` i en funktion eller ett inläst skript. */
export class ReturnSignal {
  constructor(public code: number) {}
}

/** `break` och `continue` (med antal nivåer). */
export class LoopSignal {
  constructor(
    public kind: 'break' | 'continue',
    public levels: number,
  ) {}
}

/** Skalet har kört för många kommandon i en och samma körning (t.ex. en oändlig loop). */
export class LimitError {
  constructor(public message: string) {}
}

export function isControlSignal(e: unknown): boolean {
  return e instanceof ExitSignal || e instanceof ReturnSignal || e instanceof LoopSignal || e instanceof LimitError;
}
