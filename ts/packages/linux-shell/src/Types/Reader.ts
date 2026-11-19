// Port of Types/Reader.cs – input read piece by piece (shared stdin for loops and `read`).

/** Input read piece by piece (used by `read` in `while read line; do ...; done < file`). */
export class Reader {
  constructor(
    public data = "",
    public pos = 0,
  ) {}
}
