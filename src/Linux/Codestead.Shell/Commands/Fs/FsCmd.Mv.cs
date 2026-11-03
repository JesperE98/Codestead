namespace Codestead.Shell.Commands;

// The mv command: moves or renames files.

public static partial class FsCmd
{
    private static readonly CommandDef Mv = new()
    {
        Name = "mv",
        Summary = "Flyttar eller byter namn på filer",
        Man = """
NAMN
       mv - flytta eller byt namn på filer (move)

SYNOPSIS
       mv [FLAGGA]... KÄLLA MÅL
       mv [FLAGGA]... KÄLLA... KATALOG

BESKRIVNING
       Om MÅL är en befintlig katalog flyttas KÄLLA dit. Annars byter
       KÄLLA namn till MÅL. Kataloger kan flyttas utan -r.

FLAGGOR
       -v, --verbose   berätta vad som flyttas
""",
        Run = ctx => CopyOrMove(ctx, true),
    };
}
