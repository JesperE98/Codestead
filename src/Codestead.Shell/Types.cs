namespace Codestead.Shell;

// Port of src/shell/types.ts

/// <summary>Where a command writes: standard output and standard error.</summary>
public partial class Sink
{
    public Action<string> OutFn { get; set; }
    public Action<string> ErrFn { get; set; }

    public Sink(Action<string> @out, Action<string> err)
    {
        OutFn = @out;
        ErrFn = err;
    }

    public void Out(string s) => OutFn(s);
    public void Err(string s) => ErrFn(s);

    /// <summary>A sink that throws everything away ({ out: () => {}, err: () => {} }).</summary>
    public static Sink Null() => new(_ => { }, _ => { });
}

/// <summary>Input read piece by piece (used by `read` in `while read line; do ...; done &lt; file`).</summary>
public partial class Reader
{
    public string Data { get; set; } = "";
    public int Pos { get; set; }

    public Reader() { }
    public Reader(string data, int pos = 0)
    {
        Data = data;
        Pos = pos;
    }
}

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

public partial class CmdCtx : IO
{
    public Shell Sh { get; set; }
    public string Name { get; set; }
    public List<string> Args { get; set; }

    /// <summary>{ ...io, sh, name, args }</summary>
    public CmdCtx(IO io, Shell sh, string name, List<string> args) : base(io)
    {
        Sh = sh;
        Name = name;
        Args = args;
    }
}

public partial class CommandDef
{
    public required string Name { get; init; }
    /// <summary>One line in Swedish shown by `help`.</summary>
    public required string Summary { get; init; }
    /// <summary>Simplified man page in Swedish shown by `man`.</summary>
    public string? Man { get; init; }
    /// <summary>Summary in English (shown for every language except Swedish).</summary>
    public string? SummaryEn { get; init; }
    /// <summary>Man page in English (shown for every language except Swedish).</summary>
    public string? ManEn { get; init; }
    /// <summary>Built into the shell (cd, export ...) instead of a file in /usr/bin.</summary>
    public bool Builtin { get; init; }
    public required Func<CmdCtx, int> Run { get; init; }

    /// <summary>{ ...def, overrides } – a copy with some fields replaced.</summary>
    public CommandDef With(string? name = null, string? summary = null, string? man = null, string? summaryEn = null,
        string? manEn = null, bool? builtin = null, Func<CmdCtx, int>? run = null) => new()
    {
        Name = name ?? Name,
        Summary = summary ?? Summary,
        Man = man ?? Man,
        SummaryEn = summaryEn ?? SummaryEn,
        ManEn = manEn ?? ManEn,
        Builtin = builtin ?? Builtin,
        Run = run ?? Run,
    };
}
