namespace Codestead.Shell.Commands;

// The go command: the compiler for the Go programming language.

public static partial class ReposCmd
{
    private static readonly CommandDef Go = new()
    {
        Name = "go",
        Summary = "Kompilatorn för programspråket Go",
        SummaryEn = "The compiler for the Go programming language",
        Man = """
NAMN
       go - verktyg för programspråket Go

BESKRIVNING
       I simulatorn stöds bara "go version".
""",
        ManEn = """
NAME
       go - tool for the Go programming language

DESCRIPTION
       Only "go version" is supported in the simulator.
""",
        Run = ctx =>
        {
            if (ctx.Args.Count > 0 && ctx.Args[0] == "version")
            {
                ctx.Out("go version go1.25.3 linux/amd64\n");
                return 0;
            }
            if (ctx.Args.Count == 0)
            {
                ctx.Out("Go is a tool for managing Go source code.\n\nUsage:\n\n\tgo <command> [arguments]\n");
                return 2;
            }
            ctx.Out(Dim(ctx.Sh, "repos.goSubcommandUnsupported", ("subcommand", ctx.Args[0])));
            return 1;
        },
    };
}
