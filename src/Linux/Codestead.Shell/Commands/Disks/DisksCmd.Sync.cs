namespace Codestead.Shell.Commands;

// The sync command: write everything waiting in memory to the disks.

public static partial class DisksCmd
{
    private static readonly CommandDef Sync = new()
    {
        Name = "sync",
        Summary = "Skriver allt som väntar i minnet till diskarna",
        SummaryEn = "Write everything waiting in memory to the disks",
        Man = SyncMan,
        ManEn = SyncManEn,
        Run = _ => 0,
    };

    private const string SyncMan = """
        NAMN
               sync - skriv cachat innehåll till diskarna

        SYNOPSIS
               sync

        BESKRIVNING
               Linux väntar ofta med att skriva till disken och samlar ändringarna
               i RAM-minnet (cache), eftersom det går mycket snabbare. sync tvingar
               fram skrivningen direkt. umount gör samma sak innan den kopplar
               bort ett filsystem.
        """;

    private const string SyncManEn = """
        NAME
               sync - write cached data to the disks

        SYNOPSIS
               sync

        DESCRIPTION
               Linux often delays writing to disk and collects the changes in RAM
               (cache), because that is much faster. sync forces the write right
               away. umount does the same thing before detaching a file system.
        """;
}
