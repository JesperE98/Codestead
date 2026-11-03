namespace Codestead.Shell;

// The definition of a command: name, help summary, man page and the code that runs it.

public partial class CommandDef
{
    public required string Name { get; init; }
    /// <summary>One line in Swedish shown by `help`. The source of the summaries in shell i18n/sv.json.</summary>
    public required string Summary { get; init; }
    /// <summary>Simplified man page in Swedish shown by `man`.</summary>
    public string? Man { get; init; }
    /// <summary>Summary in English. The source of the summaries in shell i18n/en.json (other languages are translated there).</summary>
    public string? SummaryEn { get; init; }
    /// <summary>Man page in English (shown for every language except Swedish).</summary>
    public string? ManEn { get; init; }
    /// <summary>Built into the shell (cd, export ...) instead of a file in /usr/bin.</summary>
    public bool Builtin { get; init; }
    public required Func<CmdCtx, int> Run { get; init; }

    /// <summary>{ ...def, overrides } – a copy with some fields replaced.</summary>
    public CommandDef With(string? name = null, string? summary = null, string? man = null, string? summaryEn = null,
        string? manEn = null, bool? builtin = null, Func<CmdCtx, int>? run = null) => new()
    {
        Name = name ?? Name,
        Summary = summary ?? Summary,
        Man = man ?? Man,
        SummaryEn = summaryEn ?? SummaryEn,
        ManEn = manEn ?? ManEn,
        Builtin = builtin ?? Builtin,
        Run = run ?? Run,
    };
}
