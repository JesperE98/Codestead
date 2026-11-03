namespace Codestead.Shell.Commands;

// zsh's setopt and unsetopt.

public static partial class ShellsCmd
{
    private static readonly List<string> ZshOptions = new()
    {
        "autocd", "autopushd", "correct", "extendedglob", "globdots", "histignorealldups", "histignoredups",
        "interactivecomments", "nomatch", "promptsubst", "sharehistory", "shwordsplit", "appendhistory", "notify",
    };

    private static int NotFound(CmdCtx ctx)
    {
        var mode = ctx.Sh.ShellMode;
        ctx.Err(mode == "fish" ? $"fish: Unknown command: {ctx.Name}\n" : $"{mode}: {ctx.Name}: command not found\n");
        ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg("shells.zshOnly", ("command", ctx.Name))}{UtilCmd.Color.Reset}\n");
        return 127;
    }

    private static CommandDef OptCommand(string name) => new()
    {
        Name = name,
        Builtin = true,
        Summary = name == "setopt" ? "Slår på en inställning i zsh (t.ex. autocd)" : "Slår av en inställning i zsh",
        SummaryEn = name == "setopt" ? "Turn on a zsh option (e.g. autocd)" : "Turn off a zsh option",
        Man = $"""
            NAMN
                   {name} - {(name == "setopt" ? "slå på" : "slå av")} inställningar i zsh

            SYNOPSIS
                   {name} [INSTÄLLNING]...

            BESKRIVNING
                   Finns bara i zsh. Utan argument listas inställningarna som är på.
                   Lägg raden i ~/.zshrc för att den ska gälla varje gång.

                   autocd       skriv ett katalognamn för att gå dit, utan cd
                   shwordsplit  dela upp ociterade $variabler vid mellanslag, som bash
                   correct      föreslå rättningar av felstavade kommandon

            EXEMPEL
                   setopt autocd
                   dokument
            """,
        ManEn = $"""
            NAME
                   {name} - turn zsh options {(name == "setopt" ? "on" : "off")}

            SYNOPSIS
                   {name} [OPTION]...

            DESCRIPTION
                   Only exists in zsh. Without arguments the options that are on are
                   listed. Put the line in ~/.zshrc to make it permanent.

                   autocd       type a directory name to go there, without cd
                   shwordsplit  split unquoted $variables on spaces, like bash
                   correct      suggest corrections for misspelled commands

            EXAMPLES
                   setopt autocd
                   dokument
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (sh.ShellMode != "zsh") return NotFound(ctx);
            var frame = sh.ShellStack.Count > 0 ? sh.ShellStack[^1] : null;
            var options = frame?.Mode == "zsh" ? frame.Options : Js.Obj<bool>();
            if (ctx.Args.Count == 0)
            {
                foreach (var o in options.Keys.Where(k => options[k]).ToList().SortJs()) ctx.Out(o + "\n");
                return 0;
            }
            int code = 0;
            foreach (var a in ctx.Args)
            {
                var opt = a.ToLowerInvariant().Replace("_", "");
                bool on = name == "setopt";
                if (opt.StartsWith("no", StringComparison.Ordinal) && ZshOptions.Contains(opt.Slice(2)))
                {
                    opt = opt.Slice(2);
                    on = !on;
                }
                if (!ZshOptions.Contains(opt))
                {
                    ctx.Err($"{name}: no such option: {a}\n");
                    code = 1;
                    continue;
                }
                options[opt] = on;
            }
            return code;
        },
    };
}
