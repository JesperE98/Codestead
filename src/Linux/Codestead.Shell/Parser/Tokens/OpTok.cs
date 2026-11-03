namespace Codestead.Shell;

// Lexer token: an operator (| && ; > ...) or a newline.

public sealed partial class OpTok(string v) : Tok
{
    public override string T => "op";
    public string V { get; } = v;
}
