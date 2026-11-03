namespace Codestead.Shell.Commands;

// The read command: reads a line of input into variables.

public static partial class ScriptCmd
{
    private static readonly CommandDef Read = new()
    {
        Name = "read",
        Builtin = true,
        Summary = "Läser en rad indata till variabler",
        Man = """
NAMN
       read - läs en rad från standard input till en eller flera variabler

SYNOPSIS
       read [-r] [-p FRÅGA] NAMN...

BESKRIVNING
       Läser en rad och lägger den i variabeln NAMN (eller REPLY). Med flera
       namn delas raden upp vid mellanslag; sista variabeln får resten.

FLAGGOR
       -p FRÅGA   visa FRÅGA innan raden läses
       -r         behandla \ som ett vanligt tecken

EXEMPEL
       read -p "Vad heter du? " namn
       while read rad; do echo "> $rad"; done < fil.txt

I SIMULATORN
       Inne i skript kan read bara läsa från en pipe eller en fil (< fil),
       inte från tangentbordet.
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var names = new List<string>();
            var promptText = "";
            for (int i = 0; i < ctx.Args.Count; i++)
            {
                var a = ctx.Args[i];
                if (a == "-p") promptText = ++i < ctx.Args.Count ? ctx.Args[i] : "";
                else if (a == "-r" || a == "-s" || a == "-e") continue;
                else names.Add(a);
            }
            if (names.Count == 0) names.Add("REPLY");
            void Assign(string line)
            {
                var fields = TextCmd.SplitWords(TextCmd.JsTrim(line));
                for (int idx = 0; idx < names.Count; idx++)
                {
                    var n = names[idx];
                    var value = idx == names.Count - 1 ? string.Join(" ", Js.Slice(fields, idx)) : (idx < fields.Count ? fields[idx] : "");
                    sh.SetVar(n, n == "REPLY" && names.Count == 1 ? line : value);
                }
            }
            var reader = ctx.Reader;
            if (reader is not null)
            {
                if (reader.Pos >= reader.Data.Length)
                {
                    foreach (var n in names) sh.SetVar(n, "");
                    return 1;
                }
                int nl = reader.Data.IndexOf('\n', reader.Pos);
                int end = nl < 0 ? reader.Data.Length : nl;
                Assign(reader.Data[reader.Pos..end]);
                reader.Pos = nl < 0 ? reader.Data.Length : nl + 1;
                return 0;
            }
            if (sh.CanAskInteractively())
            {
                sh.AskText(promptText, (text, _) =>
                {
                    Assign(text);
                    return 0;
                });
                return 0;
            }
            ctx.Err(
                $"bash: read: {ctx.Sh.Msg("script.readNoInput")}\n{UtilCmd.Color.Dim}{ctx.Sh.Msg("script.readInScripts")}{UtilCmd.Color.Reset}\n");
            return 1;
        },
    };
}
