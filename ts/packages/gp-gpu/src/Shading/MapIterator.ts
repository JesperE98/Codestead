import type { ShaderValue } from "./ShaderValue.js";
import type { SortedMap } from "./SortedMap.js";

/** A position in a std::map, forwards (begin) or backwards (rbegin); Position == Count is end()/rend(). (A C# record.) */
export class MapIterator {
  constructor(readonly map: SortedMap<ShaderValue>, readonly position: number, readonly reverse: boolean) {}

  /** The entry at the position, or null at the end. */
  get current(): [number, ShaderValue] | null {
    return this.position >= 0 && this.position < this.map.count
      ? this.map.elementAt(this.reverse ? this.map.count - 1 - this.position : this.position)
      : null;
  }

  /** The record's `with { Position = … }`. */
  withPosition(position: number): MapIterator {
    return new MapIterator(this.map, position, this.reverse);
  }
}
