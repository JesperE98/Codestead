// Heltalsaritmetik som i bash: $(( 1 + 2 )), (( i++ )), (( x > 3 )) osv.

export class ArithError extends Error {}

export interface ArithVars {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
}

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

const OPS = [
  '**=', '<<=', '>>=', '&&', '||', '**', '++', '--', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '<<', '>>',
  '=', '+', '-', '*', '/', '%', '<', '>', '!', '(', ')', '?', ':', ',', '~', '&', '|', '^',
];

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  outer: while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(0[xX][0-9a-fA-F]+|\d+)/.exec(src.slice(i));
    if (num) {
      toks.push({ k: 'num', v: Number(num[1]) });
      i += num[1].length;
      continue;
    }
    const id = /^[A-Za-z_]\w*/.exec(src.slice(i));
    if (id) {
      toks.push({ k: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    for (const op of OPS) {
      if (src.startsWith(op, i)) {
        toks.push({ k: 'op', v: op });
        i += op.length;
        continue outer;
      }
    }
    throw new ArithError(`syntax error: invalid arithmetic operator (error token is "${src.slice(i)}")`);
  }
  return toks;
}

const BINARY: Record<string, [number, 'left' | 'right']> = {
  ',': [1, 'left'],
  '||': [4, 'left'],
  '&&': [5, 'left'],
  '|': [6, 'left'],
  '^': [7, 'left'],
  '&': [8, 'left'],
  '==': [9, 'left'],
  '!=': [9, 'left'],
  '<': [10, 'left'],
  '>': [10, 'left'],
  '<=': [10, 'left'],
  '>=': [10, 'left'],
  '<<': [11, 'left'],
  '>>': [11, 'left'],
  '+': [12, 'left'],
  '-': [12, 'left'],
  '*': [13, 'left'],
  '/': [13, 'left'],
  '%': [13, 'left'],
  '**': [14, 'right'],
};

const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=']);

function applyBinary(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
    case '%':
      if (b === 0) throw new ArithError('division by 0 (error token is "0")');
      return op === '/' ? Math.trunc(a / b) : a % b;
    case '**': return a ** b;
    case '<<': return a << b;
    case '>>': return a >> b;
    case '<': return +(a < b);
    case '>': return +(a > b);
    case '<=': return +(a <= b);
    case '>=': return +(a >= b);
    case '==': return +(a === b);
    case '!=': return +(a !== b);
    case '&': return a & b;
    case '|': return a | b;
    case '^': return a ^ b;
    case '&&': return +(a !== 0 && b !== 0);
    case '||': return +(a !== 0 || b !== 0);
    case ',': return b;
  }
  throw new ArithError(`okänd operator ${op}`);
}

export function evalArith(src: string, vars: ArithVars): number {
  const toks = lex(src);
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => toks[i]?.k === 'op' && toks[i].v === v;

  const varValue = (name: string): number => {
    const raw = (vars.get(name) ?? '').trim();
    if (raw === '') return 0;
    if (/^-?\d+$/.test(raw)) return Number(raw);
    if (/^[A-Za-z_]\w*$/.test(raw)) return varValue(raw);
    return evalArith(raw, vars);
  };

  const parseExpr = (minPrec: number): number => {
    // Tilldelning: namn = uttryck
    const t = peek();
    if (t?.k === 'id' && toks[i + 1]?.k === 'op' && ASSIGN.has(String(toks[i + 1].v))) {
      i += 2;
      const op = (toks[i - 1] as { v: string }).v;
      const right = parseExpr(2);
      const value = op === '=' ? right : applyBinary(op.slice(0, -1), varValue(t.v as string), right);
      vars.set(t.v, String(value));
      return value;
    }
    let left = parseUnary();
    for (;;) {
      const op = peek();
      if (!op || op.k !== 'op') break;
      if (op.v === '?' && minPrec <= 3) {
        i++;
        const a = parseExpr(1);
        if (!isOp(':')) throw new ArithError('`:\' expected for conditional expression');
        i++;
        const b = parseExpr(3);
        left = left !== 0 ? a : b;
        continue;
      }
      const info = BINARY[op.v];
      if (!info || info[0] < minPrec) break;
      i++;
      const right = parseExpr(info[1] === 'left' ? info[0] + 1 : info[0]);
      left = applyBinary(op.v, left, right);
    }
    return left;
  };

  const parseUnary = (): number => {
    const t = peek();
    if (!t) throw new ArithError('syntax error: operand expected');
    if (t.k === 'op') {
      if (t.v === '(') {
        i++;
        const v = parseExpr(1);
        if (!isOp(')')) throw new ArithError("missing `)'");
        i++;
        return v;
      }
      if (t.v === '++' || t.v === '--') {
        i++;
        const id = peek();
        if (id?.k !== 'id') throw new ArithError('syntax error: operand expected');
        i++;
        const v = varValue(id.v) + (t.v === '++' ? 1 : -1);
        vars.set(id.v, String(v));
        return v;
      }
      i++;
      const v = parseUnary();
      if (t.v === '-') return -v;
      if (t.v === '+') return v;
      if (t.v === '!') return +(v === 0);
      if (t.v === '~') return ~v;
      throw new ArithError(`syntax error: operand expected (error token is "${t.v}")`);
    }
    i++;
    if (t.k === 'num') return t.v;
    // Variabel, ev. med efterföljande ++/--
    const v = varValue(t.v);
    if (isOp('++') || isOp('--')) {
      vars.set(t.v, String(v + (isOp('++') ? 1 : -1)));
      i++;
    }
    return v;
  };

  if (!toks.length) return 0;
  const result = parseExpr(1);
  if (i < toks.length) {
    const t = toks[i];
    throw new ArithError(`syntax error in expression (error token is "${t.k === 'num' ? t.v : t.v}")`);
  }
  return result;
}
