namespace Codestead.Shell;

// ServicesLib: writing to the journal.

public static partial class ServicesLib
{
    // ---------- The journal ----------

    private const int JournalMax = 3000;

    public static int CurrentBoot(Shell sh) => sh.Services.Boots.Count - 1;

    /// <summary>log(sh, t, ident, msg, opts) – the optional fields of the entry are named parameters.</summary>
    public static void Log(Shell sh, long t, string ident, string msg, int? pid = null, int? prio = null, string? unit = null, JournalCatalog? x = null)
    {
        var st = sh.Services;
        st.Journal.Add(new JournalEntry
        {
            T = t,
            Boot = CurrentBoot(sh),
            Ident = ident,
            Prio = prio ?? 6,
            Msg = msg,
            Unit = unit,
            X = x,
            Pid = pid ?? (ident == "systemd" ? 1 : null),
        });
        if (st.Journal.Count > JournalMax) st.Journal.RemoveRange(0, st.Journal.Count - JournalMax);
    }

    private static string IdentOf(string exec) => exec.Split(' ')[0].Split('/').Last();

    private static JournalCatalog SubjectStarted(string unit, int job) => new()
    {
        Subject = $"A start job for unit {unit} has finished successfully",
        Body = new() { $"A start job for unit {unit} has finished successfully.", "", $"The job identifier is {job}." },
    };
}
