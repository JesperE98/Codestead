namespace Codestead.Shell;

// Lexer token: an arithmetic command (( ... )).

public sealed partial class ArithTok(string expr) : Tok
{
    public override string T => "arith";
    public string Expr { get; } = expr;
}
