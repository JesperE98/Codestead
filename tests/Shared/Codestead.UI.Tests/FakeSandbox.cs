using Avalonia.Controls;
using Avalonia.Input;
using Codestead.UI.Controls;

namespace Codestead.UI.Tests;

/// <summary>
/// A sandbox without any simulator: a text box that "runs" a few known commands. Shows that the lesson controls
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

    public ISandboxTerminal NewTerminal() => new FakeTerminal();

    public string OutputOf(string command) => Run(command);

    private sealed class FakeTerminal : ISandboxTerminal
    {
        private readonly TextBox input = new();

        public FakeTerminal()
        {
            input.KeyDown += (_, e) =>
            {
                if (e.Key != Key.Enter) return;
                var line = input.Text ?? "";
                input.Text = "";
                Ran?.Invoke(new SandboxRun(line, Run(line), 0, true));
            };
        }

        public Control View => input;

        public event Action<SandboxRun>? Ran;

        public void Focus() => input.Focus();
    }
}
