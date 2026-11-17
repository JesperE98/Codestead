import { format3 } from "../internal/dotnet.js";
import type { MapIterator } from "./MapIterator.js";
import { SortedMap } from "./SortedMap.js";

/** The init-only properties of a ShaderValue (C#'s object initializer `new ShaderValue { V = …, Cols = … }`). */
export interface ShaderValueInit {
  v?: number[] | null;
  cols?: number;
  items?: ShaderValue[] | null;
  fields?: Map<string, ShaderValue> | null;
  text?: string | null;
  offset?: number;
  map?: SortedMap<ShaderValue> | null;
  iterator?: MapIterator | null;
  int?: boolean;
  shared?: boolean;
  packedInt?: boolean;
}

/**
 * A value in a running shader: a scalar or vector (`v`, 1–4 components), a square matrix (`v` with `cols` × `cols`
 * components, column by column), an array, a struct or a string. (Numbers are C# doubles: JavaScript numbers.)
 */
export class ShaderValue {
  v: number[] | null = null;
  /** 0 for scalars and vectors; 2, 3 or 4 for a matrix. */
  cols = 0;
  private itemsField: ShaderValue[] | null = null;
  private grow: ShaderValue[] | null = null;
  private packedField: number[] | null = null;
  packedInt = false;
  fields: Map<string, ShaderValue> | null = null;
  text: string | null = null;
  /** A pointer into the bytes a handle names (data + (j + width * i) * bytePerPixel): bytes past its start. */
  offset = 0;
  /** A C++ std::map with number keys (learnopengl sorts its windows by distance with one). */
  map: SortedMap<ShaderValue> | null = null;
  /** An iterator into a std::map: begin()/rbegin() …, ++it, it->first / it->second. */
  iterator: MapIterator | null = null;
  /**
   * A scalar of an integer type (int, uint; an integer literal): dividing two of them gives a whole number, as in
   * GLSL, HLSL and C++. Vectors and matrices never carry it.
   */
  int = false;
  /**
   * An object the API owns that the program only reads (learnopengl's Model: its meshes and vertices): a copy of a
   * struct that points at it (Entity's Model* pModel) points at the same one, it is not copied.
   */
  shared = false;

  constructor(init?: ShaderValueInit) {
    if (init) {
      if (init.v !== undefined) this.v = init.v;
      if (init.cols !== undefined) this.cols = init.cols;
      if (init.items !== undefined) this.itemsField = init.items;
      if (init.fields !== undefined) this.fields = init.fields;
      if (init.text !== undefined) this.text = init.text;
      if (init.offset !== undefined) this.offset = init.offset;
      if (init.map !== undefined) this.map = init.map;
      if (init.iterator !== undefined) this.iterator = init.iterator;
      if (init.int !== undefined) this.int = init.int;
      if (init.shared !== undefined) this.shared = init.shared;
      if (init.packedInt !== undefined) this.packedInt = init.packedInt;
    }
  }

  /** The elements of an array (made from a packed vector or from what push_back appended, the first time they are read). */
  get items(): ShaderValue[] | null {
    // A packed vector of numbers read element by element as values: it becomes an array of them now.
    const numbers = this.packedField;
    if (numbers !== null) {
      const made = new Array<ShaderValue>(numbers.length);
      for (let i = 0; i < numbers.length; i++) made[i] = this.packedInt ? ShaderValue.integer(numbers[i]!) : ShaderValue.scalar(numbers[i]!);
      this.itemsField = made;
      this.packedField = null;
      return made;
    }
    // Elements appended since the last read (push_back in a loop of 65,536 pixels) become the array now.
    const g = this.grow;
    if (g !== null) {
      const arr = g.slice();
      this.itemsField = arr;
      this.grow = null;
      return arr;
    }
    return this.itemsField;
  }

  set items(value: ShaderValue[] | null) {
    this.itemsField = value;
  }

  /**
   * A large std::vector of numbers (std::vector&lt;float&gt; pixels(800 * 600 * 4)) kept as plain numbers: read and
   * written element by element (and flattened) without a value per element. Null once it was read as `items`.
   */
  get packed(): number[] | null {
    return this.packedField;
  }

  static packedArray(numbers: number[], integers = false): ShaderValue {
    const v = new ShaderValue();
    v.packedField = numbers;
    v.packedInt = integers;
    return v;
  }

  /** An array (a std::vector), without making its elements an array first. */
  get isArray(): boolean {
    return this.itemsField !== null || this.grow !== null || this.packedField !== null;
  }

  /** The number of elements of an array, without making them an array first. */
  get count(): number {
    return this.packedField?.length ?? this.grow?.length ?? this.itemsField?.length ?? 0;
  }

  /**
   * std::vector::push_back: the element is added to this array in place, in amortised constant time (the array the
   * other readers see is made when it is next read).
   */
  append(item: ShaderValue): void {
    if (this.packedField !== null) void this.items;
    if (this.grow === null) {
      this.grow = this.itemsField !== null ? this.itemsField.slice() : [];
      this.itemsField = null;
    }
    this.grow.push(item);
  }

  static scalar(x: number): ShaderValue {
    const v = new ShaderValue();
    v.v = [x];
    return v;
  }

  // std::map keys are numbers in the runner (SortedDictionary<double, …>); a string key (std::map<std::string, Shader>)
  // gets a number of its own, far below any key a program uses, so it can be turned back into its text (it->first).
  private static readonly textKeyBase = -1e15;
  private static readonly textKeys = new Map<string, number>();
  private static readonly keyTexts = new Map<number, string>();

  /** A value as a std::map key: its number, or a string's own key. */
  static mapKey(key: ShaderValue): number {
    const text = key.text;
    if (text === null) return key.x;
    let k = ShaderValue.textKeys.get(text);
    if (k === undefined) {
      k = ShaderValue.textKeyBase - ShaderValue.keyTexts.size;
      ShaderValue.keyTexts.set(k, text);
      ShaderValue.textKeys.set(text, k);
    }
    return k;
  }

  /** A std::map key back as a value (it->first): a string key's text, else the number. */
  static fromMapKey(key: number): ShaderValue {
    const text = ShaderValue.keyTexts.get(key);
    return text !== undefined ? ShaderValue.str(text) : ShaderValue.scalar(key);
  }

  static integer(x: number): ShaderValue {
    const v = new ShaderValue();
    v.v = [x];
    v.int = true;
    return v;
  }

  /** True for the names of the integer types of GLSL, HLSL and the C++ the simulator reads. */
  static isIntType(type: string): boolean {
    return intTypes.has(type);
  }

  static vec(...v: number[]): ShaderValue {
    const r = new ShaderValue();
    r.v = v;
    return r;
  }

  /** ShaderValue.Vec(array): the array itself becomes the components (C#'s params double[] given an array). */
  static vecOf(v: number[]): ShaderValue {
    const r = new ShaderValue();
    r.v = v;
    return r;
  }

  static str(s: string): ShaderValue {
    const v = new ShaderValue();
    v.text = s;
    return v;
  }

  static struct(fields: Map<string, ShaderValue>): ShaderValue {
    const v = new ShaderValue();
    v.fields = fields;
    return v;
  }

  static array(items: ShaderValue[]): ShaderValue {
    const v = new ShaderValue();
    v.itemsField = items;
    return v;
  }

  static matrix(cols: number, v: number[]): ShaderValue {
    const r = new ShaderValue();
    r.v = v;
    r.cols = cols;
    return r;
  }

  static identity(n: number): ShaderValue {
    const v = new Array<number>(n * n).fill(0);
    for (let i = 0; i < n; i++) v[i * n + i] = 1;
    return ShaderValue.matrix(n, v);
  }

  get isNumeric(): boolean {
    return this.v !== null;
  }

  get isMatrix(): boolean {
    return this.cols > 0;
  }

  get size(): number {
    return this.v?.length ?? 0;
  }

  get x(): number {
    const v = this.v;
    return v !== null && v.length > 0 ? v[0]! : 0;
  }

  /** The first `n` components, padded with `pad` (and 1 for w). */
  padded(n: number, pad = 0): number[] {
    const r = new Array<number>(n);
    const v = this.v;
    for (let i = 0; i < n; i++) r[i] = v !== null && i < v.length ? v[i]! : i === 3 ? 1 : pad;
    return r;
  }

  clone(): ShaderValue {
    if (this.shared) return this;
    if (this.packedField !== null) return ShaderValue.packedArray(this.packedField.slice(), this.packedInt);
    const c = new ShaderValue();
    c.v = this.v !== null ? this.v.slice() : null;
    c.int = this.int;
    c.cols = this.cols;
    const items = this.items;
    c.itemsField = items !== null ? items.map((i) => i.clone()) : null;
    if (this.fields !== null) {
      const f = new Map<string, ShaderValue>();
      for (const [k, v] of this.fields) f.set(k, v.clone());
      c.fields = f;
    }
    c.text = this.text;
    c.offset = this.offset;
    c.map = this.map !== null ? new SortedMap(this.map) : null;
    c.iterator = this.iterator;
    return c;
  }

  toString(): string {
    if (this.text !== null) return this.text;
    const v = this.v;
    if (v !== null) return v.length === 1 ? format3(v[0]!) : `(${v.map(format3).join(", ")})`;
    const items = this.items;
    if (items !== null) return `[${items.map((i) => i.toString()).join(", ")}]`;
    if (this.fields !== null) return "{" + [...this.fields].map(([k, f]) => `${k}: ${f.toString()}`).join(", ") + "}";
    return "?";
  }
}

const intTypes = new Set([
  "int", "uint", "INT", "UINT", "GLint", "GLuint", "GLsizei", "unsigned", "uint32_t", "int32_t",
  "uint16_t", "uint64_t", "int64_t", "size_t", "dword", "DWORD", "long", "short", "unsignedint", "UINT32", "UINT64", "UINT16",
  "char", "uchar", "uint8_t", "int8_t", "BYTE", "UINT8", "INT8", "stbi_uc", "GLubyte", "GLchar", "GLenum", "GLbitfield",
]);
