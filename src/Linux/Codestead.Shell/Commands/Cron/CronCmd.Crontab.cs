namespace Codestead.Shell.Commands;

// The crontab command: show and change your scheduled jobs (cron).

public static partial class CronCmd
{
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
}
