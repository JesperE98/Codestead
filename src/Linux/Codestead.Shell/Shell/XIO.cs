namespace Codestead.Shell;

// The internal IO object used while the shell runs code (stdin is a shared reader).

/// <summary>Internal IO object while code runs: stdin is a shared reader.</summary>
internal sealed class XIO : Sink
{
    public Reader? Stdin { get; set; }
    public bool Tty { get; set; }

    public XIO(Action<string> @out, Action<string> err, Reader? stdin, bool tty) : base(@out, err)
    {
        Stdin = stdin;
        Tty = tty;
    }
}
