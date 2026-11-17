/**
 * A decoded image: RGBA bytes, top row first, and how many channels the file had (what stbi_load reports). A
 * floating-point image (a rendered HDR or depth target) also has `floats`: RGBA values that are not limited to 0–1 or
 * to 8 bits. (A C# record; `with` makes a new one, as `image with { … }` does.)
 */
export class Image {
  /**
   * The size in the program's own texels (0: width × height). A render target drawn smaller than the program made it
   * (the preview's scale) keeps the program's size here: texelFetch / Load address its texels in the program's units
   * (gl_FragCoord is in the program's pixels too).
   */
  readonly programWidth: number;
  readonly programHeight: number;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly channels: number,
    readonly rgba: Uint8Array,
    readonly floats: number[] | null = null,
    init?: { programWidth?: number; programHeight?: number },
  ) {
    this.programWidth = init?.programWidth ?? 0;
    this.programHeight = init?.programHeight ?? 0;
  }

  /** The size the program addresses the image's texels in (see programWidth). */
  get programSize(): [number, number] {
    return [this.programWidth > 0 ? this.programWidth : this.width, this.programHeight > 0 ? this.programHeight : this.height];
  }

  /** The record's `with { … }`. */
  with(changes: { width?: number; height?: number; channels?: number; rgba?: Uint8Array; floats?: number[] | null; programWidth?: number; programHeight?: number }): Image {
    return new Image(
      changes.width ?? this.width,
      changes.height ?? this.height,
      changes.channels ?? this.channels,
      changes.rgba ?? this.rgba,
      changes.floats !== undefined ? changes.floats : this.floats,
      { programWidth: changes.programWidth ?? this.programWidth, programHeight: changes.programHeight ?? this.programHeight },
    );
  }

  /** The rows in the opposite order (stbi_set_flip_vertically_on_load(true)). */
  flippedVertically(): Image {
    const flipped = new Uint8Array(this.rgba.length);
    const stride = this.width * 4;
    for (let y = 0; y < this.height; y++) flipped.set(this.rgba.subarray(y * stride, y * stride + stride), (this.height - 1 - y) * stride);
    let floats: number[] | null = null;
    if (this.floats !== null) {
      floats = new Array<number>(this.floats.length).fill(0);
      for (let y = 0; y < this.height; y++)
        for (let k = 0; k < stride; k++) floats[(this.height - 1 - y) * stride + k] = this.floats[y * stride + k]!;
    }
    return this.with({ rgba: flipped, floats });
  }
}
