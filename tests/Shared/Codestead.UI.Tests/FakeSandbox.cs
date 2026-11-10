using Codestead.UI.Controls;

namespace Codestead.UI.Tests;

/// <summary>
/// A sandbox without any simulator: it "runs" a few known commands. Shows that the lesson controls
/// work for any tool, and keeps these tests independent of Codestead Linux.
/// </summary>
public sealed class FakeSandbox : ISandbox
{
    private static readonly Dictionary<string, string> Outputs = new()
    {
        ["echo $((2 + 3))"] = "5\n",
        ["pwd"] = "/home/elev\n",
        ["echo $PWD"] = "/home/elev\n",
        ["echo hej"] = "hej\n",
        ["ls"] = "a b\n",
    };

    public static string Run(string line) => Outputs.GetValueOrDefault(line.Trim(), "");

    public string OutputOf(string command) => Run(command);
}
