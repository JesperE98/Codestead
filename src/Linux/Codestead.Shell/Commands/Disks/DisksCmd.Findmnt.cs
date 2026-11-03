namespace Codestead.Shell.Commands;

// The findmnt command: show mounted file systems as a tree.

public static partial class DisksCmd
{
    private static readonly CommandDef Findmnt = new()
    {
        Name = "findmnt",
        Summary = "Visar monterade filsystem som ett träd",
        SummaryEn = "Show mounted file systems as a tree",
        Man = FindmntMan,
        ManEn = FindmntManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "lnr",
                Values = "toT",
                Long = Long(("list", "l"), ("noheadings", "n"), ("raw", "r"), ("types", "t"), ("output", "o"), ("target", "T")),
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var sh = ctx.Sh;
            var state = sh.Disks;
            var root = sh.RootUser();
            Column<Mount> C(char align, Func<Mount, string> get) => new(align, (m, _) => get(m));
            var cols = new Dictionary<string, Column<Mount>>
            {
                ["TARGET"] = C('l', m => m.Target),
                ["SOURCE"] = C('l', m => m.Subvol is not null ? $"{m.Source}[{m.Subvol}]" : m.Source),
                ["FSTYPE"] = C('l', m => m.Fstype),
                ["OPTIONS"] = C('l', m => m.Options),
                ["UUID"] = C('l', m => m.Dev is not null ? DisksLib.FindBlock(state, m.Dev)?.Dev.Uuid ?? "" : ""),
                ["LABEL"] = C('l', m => m.Dev is not null ? DisksLib.FindBlock(state, m.Dev)?.Dev.Label ?? "" : ""),
                ["SIZE"] = C('r', m => DisksLib.LsblkSize(DisksLib.MountUsage(sh.Vfs, state, m, root).Size)),
                ["USED"] = C('r', m => DisksLib.LsblkSize(DisksLib.MountUsage(sh.Vfs, state, m, root).Used)),
                ["AVAIL"] = C('r', m => DisksLib.LsblkSize(DisksLib.MountUsage(sh.Vfs, state, m, root).Avail)),
                ["USE%"] = C('r', m =>
                {
                    var u = DisksLib.MountUsage(sh.Vfs, state, m, root);
                    return u.Size != 0 ? $"{Js.Num(Math.Ceiling(u.Used * 100 / Math.Max(1, u.Used + u.Avail)))}%" : "0%";
                }),
            };
            var names = (o.Values.Get("o") ?? "TARGET,SOURCE,FSTYPE,OPTIONS").Split(',').Select(s => s.Trim().ToUpperInvariant()).Where(s => s != "").ToList();
            foreach (var n in names)
            {
                if (!cols.ContainsKey(n))
                {
                    ctx.Err($"findmnt: unknown column: {n}\n");
                    return 1;
                }
            }
            var mounts = state.Mounts;
            bool tree = !o.Flags.Contains("l") && !o.Flags.Contains("r");
            var tVal = o.Values.Get("t");
            if (!string.IsNullOrEmpty(tVal))
            {
                var types = tVal.Split(',');
                mounts = mounts.Where(m => types.Contains(m.Fstype)).ToList();
                tree = false;
            }
            var TVal = o.Values.Get("T");
            var pick = TVal ?? (o.Operands.Count > 0 ? o.Operands[0] : null);
            if (pick is not null)
            {
                tree = false;
                if (TVal is not null)
                {
                    var m = DisksLib.MountFor(state, sh.Resolve(pick));
                    mounts = m is not null ? new List<Mount> { m } : new List<Mount>();
                }
                else
                {
                    var b = pick.StartsWith("/dev/", StringComparison.Ordinal) || LabelUuidPrefix.IsMatch(pick) ? DisksLib.FindBlock(state, pick) : null;
                    var path = sh.Resolve(pick);
                    mounts = mounts.Where(m => m.Target == path || (b is not null && m.Dev == b.Name)).ToList();
                }
            }
            if (mounts.Count == 0) return 1;
            var rows = new List<(Mount M, string Prefix)>();
            if (tree)
            {
                var all = mounts;
                Mount? ParentOf(Mount m)
                {
                    Mount? best = null;
                    foreach (var p in all)
                    {
                        if (p == m) continue;
                        bool under = p.Target == "/" ? m.Target != "/" : m.Target.StartsWith(p.Target + "/", StringComparison.Ordinal);
                        if (under && (best is null || p.Target.Length > best.Target.Length)) best = p;
                    }
                    return best;
                }
                List<Mount> Children(Mount? p) => all.Where(m => ParentOf(m) == p).ToList();
                void Walk(Mount m, string indent, bool isLast, bool top)
                {
                    rows.Add((m, top ? "" : indent + Branch(isLast)));
                    var kids = Children(m);
                    for (int i = 0; i < kids.Count; i++)
                        Walk(kids[i], top ? "" : indent + (isLast ? "  " : "│ "), i == kids.Count - 1, false);
                }
                foreach (var top in Children(null)) Walk(top, "", true, true);
            }
            else
            {
                foreach (var m in mounts) rows.Add((m, ""));
            }
            var @out = rows.Select(r => names.Select((n, i) => (i == 0 && n == "TARGET" ? r.Prefix : "") + cols[n].Get(r.M, false)).ToList()).ToList();
            if (!o.Flags.Contains("n")) @out.Insert(0, names.ToList());
            ctx.Out(Table(@out, names.Select(n => cols[n].Align).ToList()));
            return 0;
        },
    };

    private const string FindmntMan = """
        NAMN
               findmnt - hitta och visa monterade filsystem

        SYNOPSIS
               findmnt [FLAGGA]... [KATALOG | ENHET]

        BESKRIVNING
               Visar allt som är monterat som ett träd: varje filsystem under
               det som det är monterat i. Med en KATALOG eller ENHET visas bara
               den monteringen.

        FLAGGOR
               -l, --list         lista i stället för träd
               -n, --noheadings   ingen rubrikrad
               -t, --types TYP    bara filsystem av typen TYP (t.ex. ext4,vfat)
               -T, --target FIL   filsystemet som FIL ligger på
               -o, --output LISTA kolumner: TARGET,SOURCE,FSTYPE,OPTIONS,UUID,
                                  LABEL,SIZE,USED,AVAIL,USE%

        EXEMPEL
               findmnt
               findmnt /
               findmnt -t ext4,btrfs,vfat
               findmnt -n -o UUID /
        """;

    private const string FindmntManEn = """
        NAME
               findmnt - find and show mounted file systems

        SYNOPSIS
               findmnt [OPTION]... [DIRECTORY | DEVICE]

        DESCRIPTION
               Shows everything that is mounted as a tree: each file system below
               the one it is mounted in. With a DIRECTORY or DEVICE, only that
               mount is shown.

        OPTIONS
               -l, --list         list instead of tree
               -n, --noheadings   no header line
               -t, --types TYPE   only file systems of type TYPE (e.g. ext4,vfat)
               -T, --target FILE  the file system that FILE is on
               -o, --output LIST  columns: TARGET,SOURCE,FSTYPE,OPTIONS,UUID,
                                  LABEL,SIZE,USED,AVAIL,USE%

        EXAMPLES
               findmnt
               findmnt /
               findmnt -t ext4,btrfs,vfat
               findmnt -n -o UUID /
        """;
}
