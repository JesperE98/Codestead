namespace Codestead.Shell;

// Syntax tree: one part of a word (unquoted, 'single' or "double" quoted text).

public partial class Part
{
    /// <summary>Raw text. Unquoted and "double-quoted" parts still contain $VAR, $(...) etc.</summary>
    public string Text { get; set; } = "";
    /// <summary>"none", "single" or "double".</summary>
    public string Quoted { get; set; } = "none";

    public Part() { }
    public Part(string text, string quoted)
    {
        Text = text;
        Quoted = quoted;
    }
}
