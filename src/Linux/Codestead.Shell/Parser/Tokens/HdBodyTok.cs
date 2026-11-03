namespace Codestead.Shell;

// Lexer token: the body of a here-document.

public sealed partial class HdBodyTok(string body, bool quoted) : Tok
{
    public override string T => "hdbody";
    public string Body { get; } = body;
    public bool Quoted { get; } = quoted;
}
