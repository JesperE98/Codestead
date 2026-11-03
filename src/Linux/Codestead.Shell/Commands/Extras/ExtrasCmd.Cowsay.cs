namespace Codestead.Shell.Commands;

// The cowsay command: a cow that says something.

public static partial class ExtrasCmd
{
    private static readonly CommandDef Cowsay = new()
    {
        Name = "cowsay",
        Summary = "En ko som säger något",
        Man = """
NAMN
       cowsay - en pratande ko

EXEMPEL
       cowsay Hej!
       fortune | cowsay
""",
        Run = ctx =>
        {
            var text = ctx.Args.Count > 0 ? string.Join(" ", ctx.Args) : TextCmd.JsTrim(ctx.Stdin ?? "");
            if (text == "") text = "Muu!";
            var lines = text.Split('\n');
            int w = lines.Max(l => Js.CodePointLength(l));
            string Pad(string l) => l + " ".Repeat(w - Js.CodePointLength(l));
            var bubble = new StringBuilder($" {"_".Repeat(w + 2)}\n");
            if (lines.Length == 1) bubble.Append($"< {Pad(lines[0])} >\n");
            else
            {
                for (int i = 0; i < lines.Length; i++)
                {
                    var (a, b) = i == 0 ? ("/", "\\") : i == lines.Length - 1 ? ("\\", "/") : ("|", "|");
                    bubble.Append($"{a} {Pad(lines[i])} {b}\n");
                }
            }
            bubble.Append($" {"-".Repeat(w + 2)}\n");
            ctx.Out(bubble + "        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n");
            return 0;
        },
    };
}
