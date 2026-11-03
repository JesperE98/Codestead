namespace Codestead.Shell;

// Input read piece by piece (shared stdin for loops and `read`).

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
