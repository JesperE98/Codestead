namespace Codestead.Shell.Commands;

// Port of src/shell/commands/systemd.ts – commands for services and logs: systemctl, journalctl,
// hostnamectl, systemd-analyze and reboot. The model (services, journal, boots) is in ../Services.cs.

public static partial class SystemdCmd
{
    private static readonly string[] Months = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
    private static readonly string[] Days = { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };

    private const string BoldYellow = "\x1b[1;33m";

    private static string Pad2(int n) => n.ToString(CultureInfo.InvariantCulture).PadLeft(2, '0');
    private static string Clock(DateTime d) => $"{Pad2(d.Hour)}:{Pad2(d.Minute)}:{Pad2(d.Second)}";

    private static string TzName(DateTime d)
    {
        try
        {
            return UtilCmd.TimeZoneAbbreviation(d);
        }
        catch
        {
            return "UTC";
        }
    }

    /// <summary>"Oct 30 08:00:03" – as in the journal.</summary>
    private static string ShortTime(long t)
    {
        var d = Js.LocalDate(t);
        return $"{Months[d.Month - 1]} {Pad2(d.Day)} {Clock(d)}";
    }

    /// <summary>"Fri 2026-10-30 08:00:03 CET" – as in systemctl status.</summary>
    private static string LongTime(long t)
    {
        var d = Js.LocalDate(t);
        return $"{Days[(int)d.DayOfWeek]} {d.Year}-{Pad2(d.Month)}-{Pad2(d.Day)} {Clock(d)} {TzName(d)}";
    }

    private static string IsoTime(long t)
    {
        var d = Js.LocalDate(t);
        var off = (int)TimeZoneInfo.Local.GetUtcOffset(d).TotalMinutes;
        var sign = off >= 0 ? "+" : "-";
        return $"{d.Year}-{Pad2(d.Month)}-{Pad2(d.Day)}T{Clock(d)}{sign}{Pad2(Math.Abs(off) / 60)}{Pad2(Math.Abs(off) % 60)}";
    }

    private static string Paint(CmdCtx ctx, string code, string s) => ctx.IsTTY ? $"{code}{s}{UtilCmd.Color.Reset}" : s;

    private static void Tip(CmdCtx ctx, string key, params (string Name, object? Value)[] args) =>
        ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg(key, args)}{UtilCmd.Color.Reset}\n");

    private static string JournalLine(CmdCtx ctx, JournalEntry e, string output = "short")
    {
        if (output == "cat") return e.Msg;
        var time = output == "short-iso" ? IsoTime(e.T) : ShortTime(e.T);
        var who = e.Ident == "kernel" || e.Pid is null ? e.Ident : $"{e.Ident}[{e.Pid}]";
        var msg = e.Prio <= 3 ? Paint(ctx, UtilCmd.Color.Red, e.Msg)
            : e.Prio == 4 ? Paint(ctx, BoldYellow, e.Msg)
            : e.Prio == 5 ? Paint(ctx, UtilCmd.Color.Bold, e.Msg)
            : e.Msg;
        return $"{time} {ctx.Sh.Distro.Hostname} {who}: {msg}";
    }

    private const string Auth = "Interactive authentication required.";

    private static void SudoTip(CmdCtx ctx) => Tip(ctx, "systemd.needsRoot");

    private static bool IsRoot(CmdCtx ctx) => ctx.Sh.CurrentUser().Uid == 0;

    private static string ReplaceFirst(string s, string find, string repl)
    {
        var i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + repl + s[(i + find.Length)..];
    }

    private static List<string> Table(List<List<string>> rows)
    {
        var widths = rows[0].Select((_, i) => rows.Max(r => (i < r.Count ? r[i] : "").Length)).ToList();
        return rows.Select(r => string.Join(" ", r.Select((cell, i) => i == r.Count - 1 ? cell : cell.PadRight(widths[i]))).TrimEnd()).ToList();
    }

    private static int DoReboot(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        ServicesLib.Reboot(sh);
        // Every session disappears at reboot: the student logs in again in the home directory.
        sh.UserStack.Clear();
        sh.UserStack.Add(sh.World.User);
        var home = sh.World.Home;
        sh.Env["USER"] = sh.World.User;
        sh.Env["LOGNAME"] = sh.World.User;
        sh.Env["HOME"] = home;
        sh.Env["PWD"] = home;
        sh.Cwd = home;
        ctx.Out($"{UtilCmd.Color.Dim}{sh.Msg("systemd.rebooted", ("user", sh.World.User))}{UtilCmd.Color.Reset}\n");
        return 0;
    }

    private static readonly Regex RelativeRe = new(@"^([+-])\s*([0-9]+)\s*([a-z]+)\z", RegexOptions.CultureInvariant);
    private static readonly Regex AgoRe = new(@"^([0-9]+)\s*([a-z]+)\s+ago\z", RegexOptions.CultureInvariant);
    private static readonly Regex ClockRe = new(@"^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?\z", RegexOptions.CultureInvariant);
    private static readonly Regex DateRe = new(@"^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[ t]([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?)?\z", RegexOptions.CultureInvariant);

    private static readonly Dictionary<string, long> TimeUnits = new(StringComparer.Ordinal)
    {
        ["s"] = 1, ["sec"] = 1, ["second"] = 1, ["seconds"] = 1,
        ["m"] = 60, ["min"] = 60, ["minute"] = 60, ["minutes"] = 60,
        ["h"] = 3600, ["hour"] = 3600, ["hours"] = 3600,
        ["d"] = 86400, ["day"] = 86400, ["days"] = 86400,
    };

    private static long LocalMs(DateTime local) => new DateTimeOffset(DateTime.SpecifyKind(local, DateTimeKind.Local)).ToUnixTimeMilliseconds();

    /// <summary>new Date(y, m, d, h, mi, s) in local time, with JS's overflow of the fields (month 13 → next year).</summary>
    private static long LocalDateMs(double year, double month, double day, double hour, double minute, double second)
    {
        if (year >= 0 && year <= 99) year += 1900;
        var d = new DateTime((int)year, 1, 1, 0, 0, 0, DateTimeKind.Local)
            .AddMonths((int)month)
            .AddDays(day - 1)
            .AddHours(hour)
            .AddMinutes(minute)
            .AddSeconds(second);
        return LocalMs(d);
    }

    /// <summary>Parses times such as "today", "yesterday", "10:00", "2026-10-30 08:00", "-1h", "1 hour ago".</summary>
    public static long? ParseSince(string s, long? now = null)
    {
        var nowMs = now ?? Js.Now();
        var v = s.Trim().ToLowerInvariant();
        var midnight = LocalMs(Js.LocalDate(nowMs).Date);
        if (v == "now") return nowMs;
        if (v == "today") return midnight;
        if (v == "yesterday") return midnight - 86_400_000;
        if (v == "tomorrow") return midnight + 86_400_000;
        var m = RelativeRe.Match(v);
        if (m.Success && TimeUnits.TryGetValue(m.Groups[3].Value, out var u1))
            return nowMs + (m.Groups[1].Value == "-" ? -1 : 1) * (long)Js.Number(m.Groups[2].Value) * u1 * 1000;
        m = AgoRe.Match(v);
        if (m.Success && TimeUnits.TryGetValue(m.Groups[2].Value, out var u2))
            return nowMs - (long)Js.Number(m.Groups[1].Value) * u2 * 1000;
        m = ClockRe.Match(v);
        if (m.Success)
        {
            var sec = m.Groups[3].Success ? Js.Number(m.Groups[3].Value) : 0;
            return midnight + (long)((Js.Number(m.Groups[1].Value) * 3600 + Js.Number(m.Groups[2].Value) * 60 + sec) * 1000);
        }
        m = DateRe.Match(v);
        if (m.Success)
        {
            double G(int i) => m.Groups[i].Success ? Js.Number(m.Groups[i].Value) : 0;
            return LocalDateMs(G(1), G(2) - 1, G(3), G(4), G(5), G(6));
        }
        return null;
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Systemctl, Journalctl, Hostnamectl, Analyze, RebootCmd };
}
