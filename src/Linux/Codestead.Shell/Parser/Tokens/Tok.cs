namespace Codestead.Shell;

// Lexer token: the base class of the tokens the tokenizer produces.

/// <summary>A token: "word", "op", "arith" or "hdbody" (see the T property).</summary>
public abstract partial class Tok
{
    public abstract string T { get; }
}
