namespace Codestead.Shell.Commands;

// Port of src/shell/commands/man-en.ts – English summaries and man pages for commands that do not
// have SummaryEn/ManEn directly in their CommandDef. The man pages are shown for every language except
// Swedish; the summaries are translated via ShellI18n (i18n/<lang>.json).
// The man page texts must stay byte for byte identical to the TypeScript.

public static partial class ManEnCmd
{
    // The table is split over the files ManEnCmd.<Group>.cs, one per group of commands, and joined here in
    // the original order.
    public static OrderedDictionary<string, (string Summary, string? Man)> ManEn { get; } = Join(
        FsPages, TextPages, SystemPages, PkgPages, ExtrasPages, ScriptPages, ProcsPages, TextprocPages, ArchivePages);

    private static OrderedDictionary<string, (string Summary, string? Man)> Join(params OrderedDictionary<string, (string Summary, string? Man)>[] parts)
    {
        var all = new OrderedDictionary<string, (string Summary, string? Man)>();
        foreach (var part in parts)
        {
            foreach (var (name, page) in part) all[name] = page;
        }
        return all;
    }

    /// <summary>
    /// The English summary as written in the code (SummaryEn, else the ManEn table). The summaries in
    /// shell i18n/en.json are generated from it, and those in sv.json from <see cref="CommandDef.Summary"/>.
    /// </summary>
    public static string EnglishSummary(CommandDef def) =>
        def.SummaryEn ?? (ManEn.TryGetValue(def.Name, out var e) ? e.Summary : null) ?? def.Summary;

    /// <summary>The one-line summary in the shell's language (shown by help and in generated man pages).</summary>
    public static string SummaryFor(CommandDef def, Shell sh) =>
        ShellI18n.Summary(sh.Lang, def.Name) ?? (sh.Lang == "sv" ? def.Summary : EnglishSummary(def));

    /// <summary>The man page: Swedish for Swedish, otherwise English – like on a real system, man pages are not translated.</summary>
    public static string ManFor(CommandDef def, Shell sh)
    {
        if (sh.Lang == "sv") return def.Man ?? $"NAMN\n       {def.Name} - {SummaryFor(def, sh)}";
        var man = def.ManEn ?? (ManEn.TryGetValue(def.Name, out var e) ? e.Man : null);
        return man ?? $"NAME\n       {def.Name} - {SummaryFor(def, sh)}";
    }
}
