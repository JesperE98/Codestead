namespace Codestead.Shell.Commands;

// The tree command: shows directories as a tree.

public static partial class ExtrasCmd
{
    private static readonly CommandDef Tree = new()
    {
        Name = "tree",
        Summary = "Visar kataloger som ett träd",
        Man = """
NAMN
       tree - visa innehållet i kataloger som ett träd

SYNOPSIS
       tree [-a] [-d] [-L NIVÅ] [KATALOG]

FLAGGOR
       -a       visa även dolda filer
       -d       visa bara kataloger
       -L NIVÅ  gå högst NIVÅ nivåer ner
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "ad", Values = "L" });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            var levelValue = o.Values.Get("L");
            double maxLevel = !string.IsNullOrEmpty(levelValue) ? Js.Number(levelValue) : double.PositiveInfinity;
            int dirs = 0;
            int files = 0;
            void Walk(FsNode node, string prefix, int level)
            {
                if (level > maxLevel) return;
                if (!VfsLib.HasPerm(node, user, 'r')) return;
                var names = node.Children!.Keys
                    .Where(n => o.Flags.Contains("a") || !n.StartsWith('.'))
                    .Where(n => !o.Flags.Contains("d") || node.Children[n].Type == "dir")
                    .ToList()
                    .StableSort(Js.LocaleCompare);
                for (int i = 0; i < names.Count; i++)
                {
                    var n = names[i];
                    var child = node.Children[n];
                    bool last = i == names.Count - 1;
                    ctx.Out($"{prefix}{(last ? "└── " : "├── ")}{UtilCmd.ColorName(n, child, ctx.IsTTY)}\n");
                    if (child.Type == "dir")
                    {
                        dirs++;
                        Walk(child, prefix + (last ? "    " : "│   "), level + 1);
                    }
                    else
                    {
                        files++;
                    }
                }
            }
            var target = o.Operands.Count > 0 ? o.Operands[0] : ".";
            try
            {
                var node = sh.Vfs.Lookup(sh.Resolve(target), user);
                if (node.Type != "dir")
                {
                    ctx.Out($"{target}  [error opening dir]\n\n0 directories, 0 files\n");
                    return 2;
                }
                ctx.Out(UtilCmd.ColorName(target, node, ctx.IsTTY) + "\n");
                Walk(node, "", 1);
            }
            catch (FsError e)
            {
                ctx.Out($"{target}  [error opening dir: {e.Message}]\n");
                return 2;
            }
            ctx.Out($"\n{dirs} director{(dirs == 1 ? "y" : "ies")}{(o.Flags.Contains("d") ? "" : $", {files} file{(files == 1 ? "" : "s")}")}\n");
            return 0;
        },
    };
}
