import { isDigit, isHexDigit, isLetter, isLetterOrDigit, isWhiteSpace } from "../internal/dotnet.js";
import { ShaderToken, ShaderTokenKind } from "./ShaderToken.js";

const Symbols = [
  "<<=", ">>=", "::", "+=", "-=", "*=", "/=", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "->",
  "+", "-", "*", "/", "%", "=", "<", ">", "!", "(", ")", "{", "}", "[", "]", ",", ";", ".", ":", "?", "&", "|", "^", "~",
];

/**
 * Splits GLSL, HLSL or a C++ expression into tokens. Comments and preprocessor lines (#version, #include …) are
 * skipped; "0.5f" is the number 0.5; "glm::vec4" and "DirectX::XMFLOAT4" become "vec4" and "XMFLOAT4".
 */
export const ShaderLexer = {
  tokenize(source: string): ShaderToken[] {
    const defines = new Map<string, string>();
    const tokens: ShaderToken[] = [];
    let i = 0, line = 1;
    let lineStart = true;
    while (i < source.length) {
      const c = source[i]!;
      if (c === "\n") {
        line++;
        i++;
        lineStart = true;
        continue;
      }
      if (isWhiteSpace(c) || c === "\0") {
        i++;
        continue;
      }
      if (c === "#" && lineStart) {
        // A preprocessor line: skip it (and its continuation lines); #define NAME value is remembered.
        const endOfLine = source.indexOf("\n", i);
        const directive = source.slice(i, endOfLine < 0 ? source.length : endOfLine);
        const define = /^#\s*define\s+([A-Za-z_]\w*)\s+([^\n]+)$/.exec(directive);
        if (define) defines.set(define[1]!, define[2]!.trim());
        while (i < source.length && source[i] !== "\n") {
          if (source[i] === "\\" && i + 1 < source.length && source[i + 1] === "\n") {
            line++;
            i++;
          }
          i++;
        }
        continue;
      }
      lineStart = false;
      if (c === "/" && i + 1 < source.length && source[i + 1] === "/") {
        while (i < source.length && source[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && i + 1 < source.length && source[i + 1] === "*") {
        i += 2;
        while (i + 1 < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
          if (source[i] === "\n") line++;
          i++;
        }
        i += 2;
        continue;
      }
      if (isDigit(c) || (c === "." && i + 1 < source.length && isDigit(source[i + 1]))) {
        const start = i;
        if (c === "0" && i + 1 < source.length && (source[i + 1] === "x" || source[i + 1] === "X")) {
          i += 2;
          while (i < source.length && isHexDigit(source[i])) i++;
          // Convert.ToInt64(hex, 16): the 64-bit two's complement value (and it throws for no digits or too many).
          const digits = source.slice(start + 2, i);
          if (digits.length === 0 || digits.length > 16) throw new Error("Could not find any recognizable digits.");
          const hex = BigInt.asIntN(64, BigInt("0x" + digits)).toString();
          while (i < source.length && isLetter(source[i])) i++;
          tokens.push(new ShaderToken(ShaderTokenKind.Number, hex, line));
          continue;
        }
        while (i < source.length && (isDigit(source[i]) || source[i] === ".")) i++;
        if (i < source.length && (source[i] === "e" || source[i] === "E") && i + 1 < source.length
          && (isDigit(source[i + 1]) || source[i + 1] === "-" || source[i + 1] === "+")) {
          i += 2;
          while (i < source.length && isDigit(source[i])) i++;
        }
        let text = source.slice(start, i);
        // Suffixes: 0.5f, 1u, 2.0lf, 10ull …
        let floatSuffix = false;
        while (i < source.length && "fFuUlLhH".includes(source[i]!)) {
          floatSuffix ||= "fFhH".includes(source[i]!);
          i++;
        }
        // 1f is a float: written with a fraction, so the parser does not take it for an integer.
        if (floatSuffix && [...text].every((ch) => isDigit(ch))) text += ".0";
        tokens.push(new ShaderToken(ShaderTokenKind.Number, text, line));
        continue;
      }
      if (isLetter(c) || c === "_") {
        const start = i;
        while (i < source.length && (isLetterOrDigit(source[i]) || source[i] === "_")) i++;
        const word = source.slice(start, i);
        // L"wide" and u8"utf-8" strings.
        if (i < source.length && source[i] === '"' && (word === "L" || word === "u8" || word === "u" || word === "U")) continue;
        const replacement = defines.get(word);
        if (replacement !== undefined) {
          // An object-like macro: its tokens instead of the name (on this line).
          for (const t of ShaderLexer.tokenize(replacement)) if (t.kind !== ShaderTokenKind.End) tokens.push(t.with({ line }));
          continue;
        }
        tokens.push(new ShaderToken(ShaderTokenKind.Identifier, word, line));
        continue;
      }
      if (c === '"' || c === "'") {
        let sb = "";
        i++;
        while (i < source.length && source[i] !== c) {
          if (source[i] === "\\" && i + 1 < source.length) {
            i++;
            const e = source[i]!;
            sb += e === "n" ? "\n" : e === "t" ? "\t" : e === "0" ? "\0" : e;
          } else {
            if (source[i] === "\n") line++;
            sb += source[i];
          }
          i++;
        }
        i++;
        // C++: a character literal ('H', '\n') is a number, its character code (a map of char keys, 'A' == 65).
        if (c === "'" && sb.length === 1) tokens.push(new ShaderToken(ShaderTokenKind.Number, String(sb.charCodeAt(0)), line));
        else tokens.push(new ShaderToken(ShaderTokenKind.String, sb, line));
        continue;
      }
      const symbol = Symbols.find((s) => source.startsWith(s, i)) ?? c;
      i += symbol.length;
      tokens.push(new ShaderToken(ShaderTokenKind.Symbol, symbol, line));
    }
    tokens.push(new ShaderToken(ShaderTokenKind.End, "", line));
    return dropNamespaces(tokens);
  },
};

const isStdScope = (t: string): boolean => t === "glm" || t === "std" || t === "DirectX";

/** glm::vec4 → vec4, std::sin → sin, DirectX::XMFLOAT4 → XMFLOAT4. */
function dropNamespaces(tokens: ShaderToken[]): ShaderToken[] {
  const result: ShaderToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.kind === ShaderTokenKind.Identifier && i + 2 < tokens.length && tokens[i + 1]!.is("::") && tokens[i + 2]!.kind === ShaderTokenKind.Identifier
      && isStdScope(t.text)) {
      i++;
      continue;
    }
    // Other scopes stay part of the name: CD3DX12_RESOURCE_DESC::Buffer(…), Assimp::Importer.
    if (t.kind === ShaderTokenKind.Identifier && i + 2 < tokens.length && tokens[i + 1]!.is("::") && tokens[i + 2]!.kind === ShaderTokenKind.Identifier
      && (result.length === 0 || !result[result.length - 1]!.is("::"))) {
      let joined = t.text;
      let j = i;
      while (j + 2 < tokens.length && tokens[j + 1]!.is("::") && tokens[j + 2]!.kind === ShaderTokenKind.Identifier && !isStdScope(tokens[j + 2]!.text)) {
        joined += "::" + tokens[j + 2]!.text;
        j += 2;
      }
      result.push(t.with({ text: joined }));
      i = j;
      continue;
    }
    result.push(t);
  }
  return result;
}
