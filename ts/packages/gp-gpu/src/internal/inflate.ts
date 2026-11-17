// A zlib / DEFLATE decoder (RFC 1950, RFC 1951) in TypeScript, for the PNG decoder: .NET's ZLibStream in the C# code.
// Like ZLibStream, it reads one zlib stream and ignores what follows it; a stream that ends early gives the bytes
// decoded so far. Malformed data throws (the PNG decoder then reports no image).

class BitReader {
  private pos = 0;
  private bitBuf = 0;
  private bitCnt = 0;

  constructor(private readonly data: Uint8Array, start: number) {
    this.pos = start;
  }

  get atEnd(): boolean {
    return this.pos >= this.data.length && this.bitCnt === 0;
  }

  bits(n: number): number {
    while (this.bitCnt < n) {
      if (this.pos >= this.data.length) throw new TruncatedError();
      this.bitBuf |= this.data[this.pos++]! << this.bitCnt;
      this.bitCnt += 8;
    }
    const v = this.bitBuf & ((1 << n) - 1);
    this.bitBuf >>>= n;
    this.bitCnt -= n;
    return v;
  }

  alignToByte(): void {
    this.bitBuf = 0;
    this.bitCnt = 0;
  }

  byte(): number {
    if (this.pos >= this.data.length) throw new TruncatedError();
    return this.data[this.pos++]!;
  }
}

class TruncatedError extends Error {}

/** A canonical Huffman code: counts per length and the symbols in code order. */
interface Huffman {
  counts: Uint16Array;
  symbols: Uint16Array;
}

function huffman(lengths: ArrayLike<number>, n: number): Huffman {
  const counts = new Uint16Array(16);
  for (let i = 0; i < n; i++) counts[lengths[i]!]!++;
  counts[0] = 0;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1]! + counts[i - 1]!;
  const symbols = new Uint16Array(n);
  for (let i = 0; i < n; i++) if (lengths[i]! !== 0) symbols[offs[lengths[i]!]!++] = i;
  return { counts, symbols };
}

function decodeSymbol(r: BitReader, h: Huffman): number {
  let code = 0, first = 0, index = 0;
  for (let len = 1; len < 16; len++) {
    code |= r.bits(1);
    const count = h.counts[len]!;
    if (code - count < first) return h.symbols[index + (code - first)]!;
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  throw new Error("invalid Huffman code");
}

const LengthBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LengthExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DistBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DistExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CodeOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

let fixedLit: Huffman | null = null;
let fixedDist: Huffman | null = null;

class Output {
  buf = new Uint8Array(1 << 16);
  length = 0;

  push(b: number): void {
    if (this.length === this.buf.length) {
      const bigger = new Uint8Array(this.buf.length * 2);
      bigger.set(this.buf);
      this.buf = bigger;
    }
    this.buf[this.length++] = b;
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

/** Decompresses a zlib stream (a 2-byte header, DEFLATE blocks, an Adler-32 that is not checked). */
export function zlibInflate(data: Uint8Array): Uint8Array {
  if (data.length < 2) throw new Error("zlib stream too short");
  const cmf = data[0]!, flg = data[1]!;
  if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0) throw new Error("not a zlib stream");
  if (flg & 0x20) throw new Error("a preset dictionary is not supported");
  return inflateRaw(data, 2);
}

/** Decompresses raw DEFLATE data from an offset. */
export function inflateRaw(data: Uint8Array, start = 0): Uint8Array {
  const r = new BitReader(data, start);
  const out = new Output();
  try {
    let last = false;
    while (!last) {
      last = r.bits(1) === 1;
      const type = r.bits(2);
      if (type === 0) {
        r.alignToByte();
        const len = r.byte() | (r.byte() << 8);
        const nlen = r.byte() | (r.byte() << 8);
        if ((len ^ 0xffff) !== nlen) throw new Error("stored block length does not match");
        for (let i = 0; i < len; i++) out.push(r.byte());
      } else if (type === 1 || type === 2) {
        let lit: Huffman, dist: Huffman;
        if (type === 1) {
          if (fixedLit === null) {
            const l = new Uint8Array(288);
            for (let i = 0; i < 144; i++) l[i] = 8;
            for (let i = 144; i < 256; i++) l[i] = 9;
            for (let i = 256; i < 280; i++) l[i] = 7;
            for (let i = 280; i < 288; i++) l[i] = 8;
            fixedLit = huffman(l, 288);
            fixedDist = huffman(new Uint8Array(30).fill(5), 30);
          }
          lit = fixedLit;
          dist = fixedDist!;
        } else {
          const hlit = r.bits(5) + 257, hdist = r.bits(5) + 1, hclen = r.bits(4) + 4;
          const codeLengths = new Uint8Array(19);
          for (let i = 0; i < hclen; i++) codeLengths[CodeOrder[i]!] = r.bits(3);
          const codeHuff = huffman(codeLengths, 19);
          const lengths = new Uint8Array(hlit + hdist);
          for (let i = 0; i < hlit + hdist;) {
            const sym = decodeSymbol(r, codeHuff);
            if (sym < 16) lengths[i++] = sym;
            else {
              let repeat: number, value = 0;
              if (sym === 16) {
                if (i === 0) throw new Error("repeat with no previous length");
                value = lengths[i - 1]!;
                repeat = 3 + r.bits(2);
              } else if (sym === 17) repeat = 3 + r.bits(3);
              else repeat = 11 + r.bits(7);
              if (i + repeat > hlit + hdist) throw new Error("too many code lengths");
              while (repeat-- > 0) lengths[i++] = value;
            }
          }
          lit = huffman(lengths.subarray(0, hlit), hlit);
          dist = huffman(lengths.subarray(hlit), hdist);
        }
        while (true) {
          const sym = decodeSymbol(r, lit);
          if (sym < 256) out.push(sym);
          else if (sym === 256) break;
          else {
            const li = sym - 257;
            if (li >= 29) throw new Error("invalid length code");
            const len = LengthBase[li]! + r.bits(LengthExtra[li]!);
            const di = decodeSymbol(r, dist);
            if (di >= 30) throw new Error("invalid distance code");
            const d = DistBase[di]! + r.bits(DistExtra[di]!);
            if (d > out.length) throw new Error("distance too far back");
            for (let i = 0; i < len; i++) out.push(out.buf[out.length - d]!);
          }
        }
      } else throw new Error("invalid block type");
    }
  } catch (e) {
    // A stream that ends early: the bytes decoded so far (as ZLibStream gives them).
    if (!(e instanceof TruncatedError)) throw e;
  }
  return out.result();
}
