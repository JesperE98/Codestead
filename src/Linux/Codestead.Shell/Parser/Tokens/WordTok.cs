namespace Codestead.Shell;

// Lexer token: a word.

public sealed partial class WordTok(Word w) : Tok
{
    public override string T => "word";
    public Word W { get; } = w;
}
