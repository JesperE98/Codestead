namespace Codestead.Shell;

// Syntax tree: a shell word made of quoted and unquoted parts.

public partial class Word
{
    public List<Part> Parts { get; set; } = new();
    public string Raw { get; set; } = "";

    public Word() { }
    public Word(List<Part> parts, string raw)
    {
        Parts = parts;
        Raw = raw;
    }
}
