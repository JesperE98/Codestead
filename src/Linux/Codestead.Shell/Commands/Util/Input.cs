namespace Codestead.Shell.Commands;

// A file (or stdin) read by a command.

public partial class Input
{
    public string Label { get; set; } = "";
    public string Content { get; set; } = "";
}
