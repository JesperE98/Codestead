// ShaderRuntimeException.cs and ShaderSyntaxException.cs.

/** Something a shader did that the simulator cannot run (an unknown name, a type mismatch …). */
export class ShaderRuntimeException extends Error {
  constructor(message: string, readonly line: number) {
    super(message);
    this.name = "ShaderRuntimeException";
  }
}

/** A shader (or expression) the simulator cannot parse; `line` is 1-based. */
export class ShaderSyntaxException extends Error {
  constructor(message: string, readonly line: number) {
    super(message);
    this.name = "ShaderSyntaxException";
  }
}
