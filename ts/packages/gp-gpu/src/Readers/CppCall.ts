/**
 * A call found in C++ source: the function (or method) name, its arguments as written, where it is. `target`: for a
 * method call (obj->Method(…) or obj.Method(…)), the object expression, else null. (A C# record.)
 */
export class CppCall {
  constructor(
    readonly name: string,
    readonly args: readonly string[],
    readonly offset: number,
    readonly end: number,
    readonly line: number,
    readonly target: string | null,
  ) {}

  arg(i: number): string {
    return i < this.args.length ? this.args[i]! : "";
  }
}
