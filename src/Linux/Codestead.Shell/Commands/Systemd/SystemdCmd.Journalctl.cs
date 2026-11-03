namespace Codestead.Shell.Commands;

// The journalctl command: read the system log (the journal).

public static partial class SystemdCmd
{
    private static string SupportUrl(CmdCtx ctx) => ctx.Sh.Distro.Id switch
    {
        "ubuntu" => "http://www.ubuntu.com/support",
        "debian" => "https://www.debian.org/support",
        _ => "https://lists.freedesktop.org/mailman/listinfo/systemd-devel",
    };

    private static List<string> CatalogLines(CmdCtx ctx, JournalEntry e)
    {
        if (e.X is null) return new List<string>();
        var lines = new List<string> { $"Subject: {e.X.Subject}", "Defined-By: systemd", $"Support: {SupportUrl(ctx)}", "" };
        lines.AddRange(e.X.Body);
        return lines.Select(l => $"░░ {l}".TrimEnd() + (l == "" ? " " : "")).ToList();
    }

    private static readonly string[] Prios = { "emerg", "alert", "crit", "err", "warning", "notice", "info", "debug" };
    private static readonly Regex PrioDigitRe = new(@"^[0-7]\z", RegexOptions.CultureInvariant);

    private static (int Lo, int Hi)? ParsePrio(string s)
    {
        int? One(string x)
        {
            if (PrioDigitRe.IsMatch(x)) return x[0] - '0';
            var lower = x.ToLowerInvariant();
            var i = Array.IndexOf(Prios, lower == "error" ? "err" : lower == "warn" ? "warning" : lower);
            return i >= 0 ? i : null;
        }
        if (s.Contains("..", StringComparison.Ordinal))
        {
            var parts = Js.Split(s, "..");
            var a = parts[0];
            var b = parts.Count > 1 ? parts[1] : "";
            var lo = One(a != "" ? a : "emerg");
            var hi = One(b != "" ? b : "debug");
            return lo is null || hi is null ? null : (Math.Min(lo.Value, hi.Value), Math.Max(lo.Value, hi.Value));
        }
        var p = One(s);
        return p is null ? null : (0, p.Value);
    }

    private const string JournalctlHelp = "journalctl [OPTIONS...] [MATCHES...]\n\nQuery the journal.\n\nSee \"man journalctl\" for the options.\n";
    private static readonly Regex LinesValueRe = new(@"^(\+?[0-9]+|all)\z", RegexOptions.CultureInvariant);
    private static readonly Regex BootValueRe = new(@"^[+-]?[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex MatchArgRe = new(@"^(_SYSTEMD_UNIT|UNIT|SYSLOG_IDENTIFIER|_COMM)=(.+)\z", RegexOptions.CultureInvariant);

    private static double LinesValue(string v) => v == "all" ? double.PositiveInfinity : Js.Number(ReplaceFirst(v, "+", ""));

    private static Regex? MakeGrep(string v)
    {
        try
        {
            var opts = RegexOptions.CultureInvariant | (v == v.ToLowerInvariant() ? RegexOptions.IgnoreCase : RegexOptions.None);
            return new Regex(v, opts);
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private static readonly CommandDef Journalctl = new()
    {
        Name = "journalctl",
        Summary = "Läser systemloggen (journalen)",
        SummaryEn = "Read the system log (the journal)",
        Man = """
            NAMN
                   journalctl - läs systemd:s logg, journalen

            SYNOPSIS
                   journalctl [FLAGGOR]

            BESKRIVNING
                   Allt som tjänsterna, kärnan och systemd skriver hamnar i journalen.
                   Utan flaggor visas hela journalen, äldst först. Fel visas i rött och
                   varningar i gult.

            FLAGGOR
                   -u TJÄNST        bara rader från tjänsten (t.ex. -u ssh)
                   -n N             bara de N senaste raderna (-n utan tal: 10)
                   -p PRIORITET     bara rader med den prioriteten eller allvarligare:
                                    emerg alert crit err warning notice info debug
                                    (eller 0–7). -p err visar bara fel.
                   -b [N]           bara den här uppstarten; -b -1 = förra uppstarten
                   --since TID      från och med TID: today, yesterday, "10:00",
                                    "2026-10-30 08:00", "1 hour ago"
                   --until TID      till och med TID
                   -f               följ loggen: visa nya rader när de kommer (Ctrl+C)
                   -e               hoppa till slutet
                   -x               lägg till förklaringar till vissa rader
                   -r               nyast först
                   -k               bara kärnans meddelanden (som dmesg)
                   -g MÖNSTER       bara rader som matchar MÖNSTER (reguljärt uttryck)
                   -t NAMN          bara rader från programmet NAMN
                   -o FORMAT        short (standard), short-iso eller cat
                   --list-boots     lista uppstarterna som finns i journalen
                   --disk-usage     visa hur mycket plats journalen tar

            EXEMPEL
                   journalctl -u myserver
                   journalctl -xeu reportd
                   journalctl -p err -b
                   journalctl --since today -u ssh
                   journalctl -f
            """,
        ManEn = """
            NAME
                   journalctl - read the systemd log, the journal

            SYNOPSIS
                   journalctl [OPTIONS]

            DESCRIPTION
                   Everything the services, the kernel and systemd log ends up in the
                   journal. Without options the whole journal is shown, oldest first.
                   Errors are shown in red and warnings in yellow.

            OPTIONS
                   -u UNIT          only lines from the service (e.g. -u ssh)
                   -n N             only the N most recent lines (-n without a number: 10)
                   -p PRIORITY      only lines with that priority or more severe:
                                    emerg alert crit err warning notice info debug
                                    (or 0–7). -p err shows only errors.
                   -b [N]           only this boot; -b -1 = the previous boot
                   --since TIME     from TIME: today, yesterday, "10:00",
                                    "2026-10-30 08:00", "1 hour ago"
                   --until TIME     up to TIME
                   -f               follow the log: show new lines as they arrive (Ctrl+C)
                   -e               jump to the end
                   -x               add explanations to some lines
                   -r               newest first
                   -k               only kernel messages (like dmesg)
                   -g PATTERN       only lines matching PATTERN (regular expression)
                   -t NAME          only lines from the program NAME
                   -o FORMAT        short (default), short-iso or cat
                   --list-boots     list the boots in the journal
                   --disk-usage     show how much space the journal uses

            EXAMPLES
                   journalctl -u myserver
                   journalctl -xeu reportd
                   journalctl -p err -b
                   journalctl --since today -u ssh
                   journalctl -f
            """,
        Run = RunJournalctl,
    };

    private static int RunJournalctl(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        ServicesLib.SyncServices(sh);
        var st = sh.Services;
        var args = ctx.Args;
        var units = new List<string>();
        var idents = new List<string>();
        double? lines = null;
        (int Lo, int Hi)? prio = null;
        double? boot = null;
        long? since = null;
        long? until = null;
        var follow = false;
        var catalog = false;
        var end = false;
        var reverse = false;
        var kernel = false;
        var output = "short";
        Regex? grep = null;
        var listBoots = false;
        var diskUsage = false;

        int Fail(string msg)
        {
            ctx.Err(msg + "\n");
            return 1;
        }
        string? SetTime(string which, string? v)
        {
            if (v is null) return $"option '--{which}' requires an argument";
            var t = ParseSince(v);
            if (t is null) return $"Failed to parse timestamp: {v}";
            if (which == "since") since = t;
            else until = t;
            return null;
        }
        string? Next(ref int i)
        {
            ++i;
            return i < args.Count ? args[i] : null;
        }

        for (int i = 0; i < args.Count; i++)
        {
            var a = args[i];
            if (a.StartsWith("--", StringComparison.Ordinal))
            {
                var eq = a.IndexOf('=');
                var key = eq > 0 ? a[2..eq] : a[2..];
                var attached = eq > 0 ? a[(eq + 1)..] : null;
                string? Value() => attached ?? Next(ref i);
                string? Optional(Regex re) => attached ?? (i + 1 < args.Count && re.IsMatch(args[i + 1]) ? args[++i] : null);
                string? err = null;
                switch (key)
                {
                    case "unit":
                    {
                        var v = Value();
                        if (v is null) return Fail("journalctl: option '--unit' requires an argument");
                        units.Add(v);
                        break;
                    }
                    case "identifier":
                    {
                        var v = Value();
                        if (v is null) return Fail("journalctl: option '--identifier' requires an argument");
                        idents.Add(v);
                        break;
                    }
                    case "lines":
                    {
                        var v = Optional(LinesValueRe);
                        lines = v is null ? 10 : LinesValue(v);
                        break;
                    }
                    case "priority":
                    {
                        var p = ParsePrio(Value() ?? "");
                        if (p is null) return Fail($"Failed to parse priority value: {attached ?? (i < args.Count ? args[i] : "undefined")}");
                        prio = p;
                        break;
                    }
                    case "boot":
                    {
                        var v = Optional(BootValueRe);
                        boot = v is null ? 0 : Js.Number(v);
                        break;
                    }
                    case "since":
                        err = SetTime("since", Value());
                        break;
                    case "until":
                        err = SetTime("until", Value());
                        break;
                    case "follow":
                        follow = true;
                        break;
                    case "catalog":
                        catalog = true;
                        break;
                    case "pager-end":
                        end = true;
                        break;
                    case "reverse":
                        reverse = true;
                        break;
                    case "dmesg":
                        kernel = true;
                        break;
                    case "output":
                        output = Value() ?? "";
                        break;
                    case "grep":
                    {
                        var v = Value() ?? "";
                        grep = MakeGrep(v);
                        if (grep is null) return Fail($"Bad pattern \"{v}\"");
                        break;
                    }
                    case "list-boots":
                        listBoots = true;
                        break;
                    case "disk-usage":
                        diskUsage = true;
                        break;
                    case "no-pager":
                    case "full":
                    case "all":
                    case "quiet":
                    case "utc":
                    case "no-hostname":
                    case "system":
                    case "merge":
                        break;
                    case "help":
                        ctx.Out(JournalctlHelp);
                        return 0;
                    default:
                        return Fail($"journalctl: unrecognized option '{a}'");
                }
                if (err is not null) return Fail(err);
                continue;
            }
            if (a.StartsWith('-') && a.Length > 1)
            {
                for (int j = 1; j < a.Length; j++)
                {
                    var c = a[j];
                    var rest = a[(j + 1)..];
                    string? Value() => rest != "" ? rest : Next(ref i);
                    string? Optional(Regex re) => rest != "" ? rest : i + 1 < args.Count && re.IsMatch(args[i + 1]) ? args[++i] : null;
                    var stop = false;
                    string? err = null;
                    switch (c)
                    {
                        case 'u':
                        case 't':
                        {
                            var v = Value();
                            if (v is null) return Fail($"journalctl: option requires an argument -- '{c}'");
                            (c == 'u' ? units : idents).Add(v);
                            stop = true;
                            break;
                        }
                        case 'n':
                        {
                            var v = Optional(LinesValueRe);
                            lines = v is null ? 10 : LinesValue(v);
                            if (double.IsNaN(lines.Value)) return Fail($"Failed to parse lines '{v}'");
                            stop = true;
                            break;
                        }
                        case 'p':
                        {
                            var v = Value();
                            var p = ParsePrio(v ?? "");
                            if (p is null) return Fail($"Failed to parse priority value: {v ?? ""}");
                            prio = p;
                            stop = true;
                            break;
                        }
                        case 'b':
                        {
                            var v = Optional(BootValueRe);
                            boot = v is null ? 0 : Js.Number(v);
                            if (double.IsNaN(boot.Value)) return Fail($"Failed to parse boot descriptor '{v}'");
                            stop = true;
                            break;
                        }
                        case 'S':
                        case 'U':
                            err = SetTime(c == 'S' ? "since" : "until", Value());
                            stop = true;
                            break;
                        case 'o':
                            output = Value() ?? "";
                            stop = true;
                            break;
                        case 'g':
                        {
                            var v = Value() ?? "";
                            grep = MakeGrep(v);
                            if (grep is null) return Fail($"Bad pattern \"{v}\"");
                            stop = true;
                            break;
                        }
                        case 'f':
                            follow = true;
                            break;
                        case 'x':
                            catalog = true;
                            break;
                        case 'e':
                            end = true;
                            break;
                        case 'r':
                            reverse = true;
                            break;
                        case 'k':
                            kernel = true;
                            break;
                        case 'q':
                        case 'a':
                        case 'l':
                            break;
                        case 'h':
                            ctx.Out(JournalctlHelp);
                            return 0;
                        default:
                            return Fail($"journalctl: invalid option -- '{c}'");
                    }
                    if (err is not null) return Fail(err);
                    if (stop) break;
                }
                continue;
            }
            // Matches such as _SYSTEMD_UNIT=ssh.service or _PID=733.
            var m = MatchArgRe.Match(a);
            if (m.Success)
            {
                if (m.Groups[1].Value.EndsWith("UNIT", StringComparison.Ordinal)) units.Add(m.Groups[2].Value);
                else idents.Add(m.Groups[2].Value);
                continue;
            }
            return Fail($"Failed to add match '{a}': Invalid argument");
        }

        if (output is not ("short" or "short-iso" or "cat")) return Fail($"Unknown output format '{output}'.");

        var cur = ServicesLib.CurrentBoot(sh);
        if (listBoots)
        {
            var rows = new List<List<string>> { new() { "IDX", "BOOT ID", "FIRST ENTRY", "LAST ENTRY" } };
            for (int i = 0; i < st.Boots.Count; i++)
            {
                var b = st.Boots[i];
                var bootEntries = st.Journal.Where(e => e.Boot == i).ToList();
                var first = bootEntries.Count > 0 ? bootEntries[0].T : b.Start;
                var last = bootEntries.Count > 0 ? bootEntries[^1].T : b.Start;
                rows.Add(new List<string> { (i - cur).ToString(CultureInfo.InvariantCulture).PadLeft(3), b.Id, LongTime(first), LongTime(last) });
            }
            foreach (var line in Table(rows)) ctx.Out(line + "\n");
            return 0;
        }
        if (diskUsage)
        {
            ctx.Out($"Archived and active journals take up {Js.ToFixed(8 + st.Boots.Count * 8, 1)}M in the file system.\n");
            return 0;
        }

        IEnumerable<JournalEntry> query = st.Journal;
        if (boot is not null || kernel)
        {
            var b = boot ?? 0;
            var idx = b <= 0 ? cur + b : b - 1;
            if (idx < 0 || idx > cur) return Fail($"Data from the specified boot ({(b > 0 ? "+" : "")}{Js.Num(b)}) is not available: No such boot ID in journal");
            query = query.Where(e => e.Boot == idx);
        }
        if (kernel) query = query.Where(e => e.Ident == "kernel");
        if (units.Count > 0)
        {
            var names = units.Select(u => ServicesLib.ResolveUnit(sh, u)?.Name ?? ServicesLib.UnitName(u)).ToList();
            query = query.Where(e => e.Unit is not null && names.Contains(e.Unit));
        }
        if (idents.Count > 0) query = query.Where(e => idents.Contains(e.Ident));
        if (prio is (int lo, int hi)) query = query.Where(e => e.Prio >= lo && e.Prio <= hi);
        if (since is long sinceT) query = query.Where(e => e.T >= sinceT);
        if (until is long untilT) query = query.Where(e => e.T <= untilT);
        if (grep is not null) query = query.Where(e => grep.IsMatch(e.Msg));
        var entries = query.ToList();
        var n = lines ?? (follow ? 10 : end ? 1000 : double.PositiveInfinity);
        if (double.IsFinite(n))
        {
            var start = Math.Max(0, entries.Count - n);
            entries = entries.Slice((int)Math.Min(start, entries.Count));
        }
        if (reverse) entries.Reverse();

        if (entries.Count == 0)
        {
            if (!follow) ctx.Out("-- No entries --\n");
        }
        int? prevBoot = null;
        foreach (var e in entries)
        {
            if (prevBoot is not null && e.Boot != prevBoot) ctx.Out($"-- Boot {(e.Boot >= 0 && e.Boot < st.Boots.Count ? st.Boots[e.Boot].Id : "?")} --\n");
            prevBoot = e.Boot;
            ctx.Out(JournalLine(ctx, e, output) + "\n");
            if (catalog) foreach (var l in CatalogLines(ctx, e)) ctx.Out(l + "\n");
        }
        if (follow)
        {
            Tip(ctx, "systemd.journalFollow");
        }
        return 0;
    }
}
