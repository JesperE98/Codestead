namespace Codestead.Shell;

// The streams of a command: output, error, stdin and whether it is a terminal.

public partial class IO : Sink
{
    /// <summary>Input from a pipe or file. null means "the keyboard" (nothing to read).</summary>
    public string? Stdin { get; set; }
    /// <summary>The same input as a reader with a position – shared between commands in a loop.</summary>
    public Reader? Reader { get; set; }
    /// <summary>True when output goes straight to the terminal (not to a pipe or file).</summary>
    public bool IsTTY { get; set; }

    public IO(Action<string> @out, Action<string> err, string? stdin = null, bool isTTY = false, Reader? reader = null)
        : base(@out, err)
    {
        Stdin = stdin;
        IsTTY = isTTY;
        Reader = reader;
    }

    /// <summary>{ ...io } – a copy with the same streams.</summary>
    public IO(IO io) : this(io.OutFn, io.ErrFn, io.Stdin, io.IsTTY, io.Reader) { }
}
