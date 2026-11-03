using System.Runtime.CompilerServices;

namespace Codestead.Shell.Commands;

// Scheduled jobs: crontab, and the cron daemon that runs them. Jobs really run while the app is open:
// before each command line, every minute that has passed since the last one is checked (see Tick).
// When the app is closed, the computer is "off" – like a real computer, cron does not catch up afterwards.

public static partial class CronCmd
{
    // ---------- Schedules ----------

    private static readonly string[] Months = { "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec" };
    private static readonly string[] Days = { "sun", "mon", "tue", "wed", "thu", "fri", "sat" };

    private static readonly Dictionary<string, string> Specials = new(StringComparer.Ordinal)
    {
        ["@yearly"] = "0 0 1 1 *",
        ["@annually"] = "0 0 1 1 *",
        ["@monthly"] = "0 0 1 * *",
        ["@weekly"] = "0 0 * * 0",
        ["@daily"] = "0 0 * * *",
        ["@midnight"] = "0 0 * * *",
        ["@hourly"] = "0 * * * *",
    };

    /// <summary>A job: when it runs (five sets of allowed values) and what it runs.</summary>
    public sealed class Job
    {
        public required HashSet<int>[] When { get; init; }
        /// <summary>Day of month and day of week both restricted: either one is enough (as in cron).</summary>
        public bool EitherDay { get; init; }
        public bool AtReboot { get; init; }
        public required string User { get; init; }
        public required string Command { get; init; }
    }

    /// <summary>The allowed values of one field (e.g. "*/15", "1-5", "mon,wed"), or null if it is wrong.</summary>
    private static HashSet<int>? ParseField(string field, int min, int max, string[]? names)
    {
        var set = new HashSet<int>();
        foreach (var part in field.Split(','))
        {
            var p = part;
            int step = 1;
            int slash = p.IndexOf('/');
            if (slash >= 0)
            {
                if (!int.TryParse(p[(slash + 1)..], NumberStyles.None, CultureInfo.InvariantCulture, out step) || step < 1) return null;
                p = p[..slash];
            }
            int lo, hi;
            if (p == "*")
            {
                lo = min;
                hi = max;
            }
            else
            {
                var dash = p.IndexOf('-');
                int? a = Value(dash >= 0 ? p[..dash] : p, names, min);
                int? b = dash >= 0 ? Value(p[(dash + 1)..], names, min) : a;
                if (a is null || b is null) return null;
                lo = a.Value;
                hi = b.Value;
                // "5/10" means 5-max in steps of 10.
                if (slash >= 0 && dash < 0) hi = max;
            }
            if (lo < min || hi > max || lo > hi) return null;
            // Sunday can be written 7 as well as 0.
            for (int v = lo; v <= hi; v += step) set.Add(max == 7 && v == 7 ? 0 : v);
        }
        return set;
    }

    private static int? Value(string text, string[]? names, int min)
    {
        if (int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var n)) return n;
        if (names is null) return null;
        var i = Array.IndexOf(names, text.ToLowerInvariant());
        return i < 0 ? null : i + min;
    }

    private static readonly string[] FieldNames = { "minute", "hour", "day-of-month", "month", "day-of-week" };

    private static readonly Regex EnvLineRe = new(@"^[A-Za-z_][A-Za-z0-9_]*\s*=", RegexOptions.CultureInvariant);

    /// <summary>
    /// Parses a crontab. <paramref name="withUser"/>: /etc/crontab and /etc/cron.d have a user name after the
    /// five time fields. Returns the jobs, or an error like "bad minute" with its line number.
    /// </summary>
    public static (List<Job> Jobs, string? Error, int Line) Parse(string text, string owner, bool withUser = false)
    {
        var jobs = new List<Job>();
        var lines = text.Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (line == "" || line.StartsWith('#') || EnvLineRe.IsMatch(line)) continue;
            var words = line.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).ToList();
            bool reboot = false;
            int timeWords = 5;
            List<string> fields;
            if (words[0].StartsWith('@'))
            {
                timeWords = 1;
                if (words[0] == "@reboot")
                {
                    reboot = true;
                    fields = new List<string> { "*", "*", "*", "*", "*" };
                }
                else if (Specials.TryGetValue(words[0], out var expanded)) fields = expanded.Split(' ').ToList();
                else return (jobs, "bad minute", i + 1);
            }
            else fields = words.Take(5).ToList();
            int need = timeWords + (withUser ? 1 : 0) + 1;
            if (words.Count < need)
            {
                if (fields.Count < 5) return (jobs, $"bad {FieldNames[fields.Count]}", i + 1);
                return (jobs, withUser && words.Count == timeWords ? "bad username" : "bad command", i + 1);
            }
            var sets = new HashSet<int>[5];
            var ranges = new (int Min, int Max, string[]? Names)[] { (0, 59, null), (0, 23, null), (1, 31, null), (1, 12, Months), (0, 7, Days) };
            for (int f = 0; f < 5; f++)
            {
                var set = ParseField(fields[f], ranges[f].Min, ranges[f].Max, ranges[f].Names);
                if (set is null) return (jobs, $"bad {FieldNames[f]}", i + 1);
                sets[f] = set;
            }
            var user = withUser ? words[timeWords] : owner;
            // The command is the rest of the line, as written (spaces kept).
            var rest = line;
            for (int w = 0; w < timeWords + (withUser ? 1 : 0); w++)
            {
                rest = rest.TrimStart();
                var sp = rest.IndexOfAny(new[] { ' ', '\t' });
                rest = sp < 0 ? "" : rest[sp..];
            }
            jobs.Add(new Job
            {
                When = sets,
                EitherDay = fields[2] != "*" && fields[4] != "*",
                AtReboot = reboot,
                User = user,
                Command = rest.Trim(),
            });
        }
        return (jobs, null, 0);
    }

    public static bool Due(Job job, DateTime t)
    {
        if (job.AtReboot) return false;
        bool dom = job.When[2].Contains(t.Day);
        bool dow = job.When[4].Contains((int)t.DayOfWeek);
        bool day = job.EitherDay ? dom || dow : dom && dow;
        return job.When[0].Contains(t.Minute) && job.When[1].Contains(t.Hour) && job.When[3].Contains(t.Month) && day;
    }

    // ---------- Where crontabs live ----------

    /// <summary>The users' crontabs: /var/spool/cron/crontabs on Debian/Ubuntu, /var/spool/cron elsewhere.</summary>
    public static string SpoolDir(Shell sh) => sh.Distro.Family == "debian" ? "/var/spool/cron/crontabs" : "/var/spool/cron";

    private static FsNode EnsureSpool(Shell sh)
    {
        var root = sh.RootUser();
        var dir = SpoolDir(sh);
        var cur = "";
        foreach (var seg in dir.Split('/').Where(s => s != ""))
        {
            cur += "/" + seg;
            if (sh.Vfs.TryLookup(cur, root) is null)
            {
                bool spool = cur == dir && sh.Distro.Family == "debian" && UsersLib.GroupExists(sh, "crontab");
                var node = VfsLib.MakeDir("root", spool ? Js.Oct(1730) : Js.Oct(700), null, spool ? "crontab" : "root");
                sh.Vfs.Insert(cur, node, root);
            }
        }
        return sh.Vfs.Lookup(dir, root);
    }

    /// <summary>Whether the cron daemon runs (cron, crond or cronie depending on the distribution).</summary>
    public static bool DaemonRuns(Shell sh)
    {
        var rt = ServicesLib.ResolveUnit(sh, ServicesLib.CronUnit(sh.Distro));
        return rt?.Active == "active";
    }

    // ---------- crontab ----------

    private static readonly CommandDef Crontab = new()
    {
        Name = "crontab",
        Summary = "Visar och ändrar dina schemalagda jobb (cron)",
        SummaryEn = "Show and change your scheduled jobs (cron)",
        Man = """
            NAMN
                   crontab - dina schemalagda jobb

            SYNOPSIS
                   crontab -l
                   crontab FIL
                   crontab -e
                   crontab -r

            BESKRIVNING
                   Din crontab är en lista med jobb som tjänsten cron kör åt dig på
                   bestämda tider. Varje rad har fem tidsfält och sedan kommandot:

                   ┌───────────── minut (0–59)
                   │ ┌─────────── timme (0–23)
                   │ │ ┌───────── dag i månaden (1–31)
                   │ │ │ ┌─────── månad (1–12)
                   │ │ │ │ ┌───── veckodag (0–7, 0 och 7 är söndag)
                   │ │ │ │ │
                   * * * * *  kommando

                   * betyder "varje", 1-5 ett intervall, 1,15 en lista och */10
                   "var tionde". @daily, @hourly, @weekly och @reboot är genvägar.

                   Jobben körs med /bin/sh i din hemkatalog, utan dina alias och
                   med en kort PATH. Utdata som inte skickas till en fil försvinner,
                   så skriv t.ex. >> ~/jobb.log 2>&1 sist på raden.

            FLAGGOR
                   -l        visa din crontab
                   FIL       ersätt din crontab med innehållet i FIL (- = indata)
                   -e        öppna din crontab i en texteditor
                   -r        ta bort din crontab
                   -u ANV    (root) gör det för en annan användare

            EXEMPEL
                   crontab -l
                   echo '30 2 * * * ~/backup.sh >> ~/backup.log 2>&1' | crontab -
                   (crontab -l; echo '@reboot ~/start.sh') | crontab -
            """,
        ManEn = """
            NAME
                   crontab - your scheduled jobs

            SYNOPSIS
                   crontab -l
                   crontab FILE
                   crontab -e
                   crontab -r

            DESCRIPTION
                   Your crontab is a list of jobs that the cron service runs for you at
                   set times. Each line has five time fields and then the command:

                   ┌───────────── minute (0–59)
                   │ ┌─────────── hour (0–23)
                   │ │ ┌───────── day of month (1–31)
                   │ │ │ ┌─────── month (1–12)
                   │ │ │ │ ┌───── day of week (0–7, 0 and 7 are Sunday)
                   │ │ │ │ │
                   * * * * *  command

                   * means "every", 1-5 a range, 1,15 a list and */10 "every tenth".
                   @daily, @hourly, @weekly and @reboot are shortcuts.

                   Jobs run with /bin/sh in your home directory, without your aliases
                   and with a short PATH. Output that is not sent to a file is lost, so
                   end the line with e.g. >> ~/job.log 2>&1.

            OPTIONS
                   -l        show your crontab
                   FILE      replace your crontab with the content of FILE (- = input)
                   -e        open your crontab in a text editor
                   -r        remove your crontab
                   -u USER   (root) do it for another user

            EXAMPLES
                   crontab -l
                   echo '30 2 * * * ~/backup.sh >> ~/backup.log 2>&1' | crontab -
                   (crontab -l; echo '@reboot ~/start.sh') | crontab -
            """,
        Run = RunCrontab,
    };

    private static int Usage(CmdCtx ctx, string? why = null)
    {
        if (why is not null) ctx.Err($"crontab: {why}\n");
        ctx.Err("usage:\tcrontab [-u user] file\n\tcrontab [ -u user ] [ -i ] { -e | -l | -r }\n\t\t(default operation is replace, per 1003.2)\n\t-e\t(edit user's crontab)\n\t-l\t(list user's crontab)\n\t-r\t(delete user's crontab)\n\t-i\t(prompt before deleting user's crontab)\n");
        return 1;
    }

    private static int RunCrontab(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var me = sh.CurrentUser();
        string? who = null;
        string? action = null;
        string? file = null;
        var args = ctx.Args.ToList();
        for (int i = 0; i < args.Count; i++)
        {
            var a = args[i];
            if (a == "-u")
            {
                if (++i >= args.Count) return Usage(ctx, "option requires an argument -- 'u'");
                who = args[i];
            }
            else if (a is "-l" or "-r" or "-e") action = action is null ? a : "conflict";
            else if (a == "-i") continue;
            else if (a.StartsWith('-') && a != "-") return Usage(ctx, $"invalid option -- '{a.TrimStart('-')}'");
            else file = a;
        }
        if (action == "conflict" || (action is not null && file is not null)) return Usage(ctx);
        if (action is null && file is null)
        {
            // Without arguments crontab reads the new crontab from its input (an empty input removes all jobs).
            if (ctx.Stdin is null) return Usage(ctx, "usage error: file name or - (for stdin) must be specified");
            file = "-";
        }
        if (who is not null && who != me.Name && me.Uid != 0)
        {
            ctx.Err("crontab: must be privileged to use -u\n");
            return 1;
        }
        var user = who ?? me.Name;
        if (!UsersLib.UserExists(sh, user))
        {
            ctx.Err($"crontab: user '{user}' unknown\n");
            return 1;
        }
        var root = sh.RootUser();
        var path = $"{SpoolDir(sh)}/{user}";
        var current = sh.Vfs.TryLookup(path, root);

        switch (action)
        {
            case "-l":
                if (current is null)
                {
                    ctx.Err($"no crontab for {user}\n");
                    return 1;
                }
                ctx.Out(current.Content ?? "");
                return 0;
            case "-r":
                if (current is null)
                {
                    ctx.Err($"no crontab for {user}\n");
                    return 1;
                }
                sh.Vfs.Remove(path, root);
                return 0;
            case "-e":
                ctx.Out($"{UtilCmd.Color.Dim}{sh.Msg("cron.editUnsupported")}{UtilCmd.Color.Reset}\n");
                return 1;
        }

        string text;
        if (file == "-") text = ctx.Stdin ?? "";
        else
        {
            try
            {
                text = sh.Vfs.ReadFile(sh.Resolve(file!), me);
            }
            catch (FsError e)
            {
                ctx.Err($"{file}: {e.Message}\n");
                return 1;
            }
        }
        var label = file == "-" ? "-" : file;
        if (text != "" && !text.EndsWith('\n'))
        {
            ctx.Err("new crontab file is missing newline before EOF, can't install.\n");
            return 1;
        }
        var (_, error, line) = Parse(text, user);
        if (error is not null)
        {
            ctx.Err($"\"{label}\":{line}: {error}\nerrors in crontab file, can't install.\n");
            return 1;
        }
        var spool = EnsureSpool(sh);
        var group = sh.Distro.Family == "debian" && UsersLib.GroupExists(sh, "crontab") ? "crontab" : sh.GetUser(user).Groups.FirstOrDefault() ?? user;
        var node = VfsLib.MakeFile(text, user, Js.Oct(600), group);
        spool.Children![user] = node;
        return 0;
    }

    // ---------- The daemon ----------

    /// <summary>When the jobs were last checked, per computer (not saved: a closed app is a computer that is off).</summary>
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Shell, StrongBox<long>> LastCheck = new();

    private static bool running;

    /// <summary>All jobs on the computer: the users' crontabs, /etc/crontab and /etc/cron.d/*.</summary>
    public static List<Job> AllJobs(Shell sh)
    {
        var root = sh.RootUser();
        var jobs = new List<Job>();
        var spool = sh.Vfs.TryLookup(SpoolDir(sh), root);
        foreach (var (user, node) in spool?.Children ?? Js.Obj<FsNode>())
            if (node.Type == "file" && UsersLib.UserExists(sh, user)) jobs.AddRange(Parse(node.Content ?? "", user).Jobs);
        var etc = sh.Vfs.TryLookup("/etc/crontab", root);
        if (etc?.Type == "file") jobs.AddRange(Parse(etc.Content ?? "", "root", withUser: true).Jobs);
        var d = sh.Vfs.TryLookup("/etc/cron.d", root);
        foreach (var (_, node) in d?.Children ?? Js.Obj<FsNode>())
            if (node.Type == "file") jobs.AddRange(Parse(node.Content ?? "", "root", withUser: true).Jobs);
        return jobs;
    }

    /// <summary>
    /// Runs the jobs that were due since the last check (at most the last hour). Called before every command
    /// line the student runs.
    /// </summary>
    public static void Tick(Shell sh)
    {
        if (running) return;
        var now = Js.Now();
        var box = LastCheck.GetValue(sh, _ => new StrongBox<long>(now));
        long from = Math.Max(box.Value, now - 3_600_000);
        box.Value = now;
        // Whole minutes between the last check and now.
        long firstMinute = from / 60_000 + 1;
        long lastMinute = now / 60_000;
        if (lastMinute < firstMinute) return;
        if (!sh.Installed.ContainsKey("cron") || !DaemonRuns(sh)) return;
        List<Job> jobs;
        try
        {
            jobs = AllJobs(sh);
        }
        catch (FsError)
        {
            return;
        }
        if (jobs.Count == 0) return;
        running = true;
        try
        {
            for (long m = firstMinute; m <= lastMinute; m++)
            {
                var t = Js.LocalDate(m * 60_000);
                foreach (var job in jobs.Where(j => Due(j, t))) RunJob(sh, job, m * 60_000);
            }
        }
        finally
        {
            running = false;
        }
    }

    private static void RunJob(Shell sh, Job job, long t)
    {
        if (!UsersLib.UserExists(sh, job.User)) return;
        // The system's own jobs (run-parts /etc/cron.daily ...) are only logged: their programs are not simulated.
        bool systemJob = job.Command.Contains("run-parts", StringComparison.Ordinal);
        var user = sh.GetUser(job.User);
        int pid = sh.Proc.NextPid++;
        var ident = sh.Distro.Family == "debian" ? "CRON" : "CROND";
        var unit = ServicesLib.CronUnit(sh.Distro);
        ServicesLib.Log(sh, t, ident, $"({job.User}) CMD ({job.Command})", pid, unit: unit);
        if (systemJob) return;
        var output = new StringBuilder();
        var savedCwd = sh.Cwd;
        var savedEnv = Js.Copy(sh.Env);
        try
        {
            // cron's environment: the home directory, /bin/sh and a short PATH – not the student's shell settings.
            sh.Cwd = user.Home;
            sh.Env["HOME"] = user.Home;
            sh.Env["LOGNAME"] = user.Name;
            sh.Env["USER"] = user.Name;
            sh.Env["SHELL"] = "/bin/sh";
            sh.Env["PATH"] = "/usr/bin:/bin";
            sh.Env["PWD"] = user.Home;
            var io = new IO(s => output.Append(s), s => output.Append(s), null, false);
            // The command's % signs would be newlines in real cron; they are rare in exercises and are kept.
            sh.RunAs(job.User, () => sh.RunScript(job.Command, "sh", new List<string>(), io));
        }
        catch (Exception e) when (e is LimitError or FsError)
        {
            // A job that runs away is stopped, as a real one would be killed eventually.
        }
        finally
        {
            sh.Cwd = savedCwd;
            sh.Env = savedEnv;
        }
        if (output.Length > 0)
            ServicesLib.Log(sh, t, ident, $"({job.User}) MAIL (mailed {Js.Num(output.Length)} bytes of output but got status 0x007f from MTA)", pid, prio: 3, unit: unit);
        if (sh.Distro.Family == "debian" && output.Length > 0)
            ServicesLib.Log(sh, t, "cron", "(CRON) info (No MTA installed, discarding output)", 530, unit: unit);
    }

    public static List<CommandDef> All { get; } = new() { Crontab };
}
