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
