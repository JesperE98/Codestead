import { Wrap } from "./Wrap.js";

/** How a texture is read: wrapping per axis, linear or nearest filtering, and the border colour. (A C# record.) */
export class SamplerState {
  constructor(readonly wrapS: Wrap, readonly wrapT: Wrap, readonly linear: boolean, readonly border: number[] | null = null) {}

  static readonly Default = new SamplerState(Wrap.Repeat, Wrap.Repeat, true);

  /** The record's `with { … }`. */
  with(changes: { wrapS?: Wrap; wrapT?: Wrap; linear?: boolean; border?: number[] | null }): SamplerState {
    return new SamplerState(changes.wrapS ?? this.wrapS, changes.wrapT ?? this.wrapT, changes.linear ?? this.linear, changes.border !== undefined ? changes.border : this.border);
  }

  /** Record value equality (the border compared by reference, as a C# record compares an array). */
  equals(o: SamplerState | null | undefined): boolean {
    return !!o && o.wrapS === this.wrapS && o.wrapT === this.wrapT && o.linear === this.linear && o.border === this.border;
  }
}
