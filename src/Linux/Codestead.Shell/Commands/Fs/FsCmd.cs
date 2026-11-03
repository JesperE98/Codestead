namespace Codestead.Shell.Commands;

// Port of src/shell/commands/fs.ts – navigating and handling files: cd, pwd, ls, mkdir, touch, rm, cp, mv,
// find, chmod, chown.

public static partial class FsCmd
{
    private static string JoinPath(string dir, string name) => dir == "/" ? $"/{name}" : $"{dir}/{name}";

    private static void ChownTree(FsNode node, User user)
    {
        node.Owner = user.Name;
        node.Group = user.Groups.FirstOrDefault()!;
        node.Mtime = Js.Now();
        foreach (var c in node.Children?.Values.ToList() ?? new List<FsNode>()) ChownTree(c, user);
    }

    private static readonly Regex TrailingSlashes = new(@"/+\z", RegexOptions.CultureInvariant);

    /// <summary>Shared logic for cp and mv.</summary>
    private static int CopyOrMove(CmdCtx ctx, bool move)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = move ? "fivn" : "rRfivan",
            Long = new() { ["recursive"] = "r", ["force"] = "f", ["verbose"] = "v", ["archive"] = "a", ["interactive"] = "i" },
        });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        var name = ctx.Name;
        var ops = o.Operands.ToList();
        if (ops.Count == 0) return UtilCmd.BadOption(ctx, "missing file operand");
        if (ops.Count == 1) return UtilCmd.BadOption(ctx, $"missing destination file operand after '{ops[0]}'");
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        var dest = ops[^1];
        ops.RemoveAt(ops.Count - 1);
        var destPath = sh.Resolve(dest);
        var destNode = sh.Vfs.TryLookup(destPath, user);
        if (ops.Count > 1 && destNode?.Type != "dir")
        {
            ctx.Err($"{name}: target '{dest}' is not a directory\n");
            return 1;
        }
        bool recursive = move || o.Flags.Contains("r") || o.Flags.Contains("R") || o.Flags.Contains("a");
        int code = 0;
        foreach (var src in ops)
        {
            var srcPath = sh.Resolve(src);
            FsNode node;
            try
            {
                // mv moves a symbolic link itself; cp copies what it points to.
                node = sh.Vfs.Lookup(srcPath, user, follow: !move || src.EndsWith('/'));
            }
            catch (FsError e)
            {
                ctx.Err($"{name}: cannot stat '{src}': {e.Message}\n");
                code = 1;
                continue;
            }
            if (node.Type == "dir" && !recursive)
            {
                ctx.Err($"cp: -r not specified; omitting directory '{src}'\n");
                code = 1;
                continue;
            }
            var target = destNode?.Type == "dir" ? JoinPath(destPath, VfsLib.Basename(srcPath)) : destPath;
            var trimmedDest = TrailingSlashes.Replace(dest, "", 1);
            var targetLabel = destNode?.Type == "dir" ? JoinPath(trimmedDest != "" ? trimmedDest : "/", VfsLib.Basename(srcPath)) : dest;
            if (target == srcPath)
            {
                ctx.Err($"{name}: '{src}' and '{targetLabel}' are the same file\n");
                code = 1;
                continue;
            }
            if (node.Type == "dir" && target.StartsWith(srcPath + "/", StringComparison.Ordinal))
            {
                ctx.Err(move
                    ? $"mv: cannot move '{src}' to a subdirectory of itself, '{targetLabel}'\n"
                    : $"cp: cannot copy a directory, '{src}', into itself, '{targetLabel}'\n");
                code = 1;
                continue;
            }
            var existing = sh.Vfs.TryLookup(target, user);
            if (existing?.Type == "dir" && node.Type != "dir")
            {
                ctx.Err($"{name}: cannot overwrite directory '{targetLabel}' with non-directory\n");
                code = 1;
                continue;
            }
            try
            {
                if (move)
                {
                    var (dir, _) = sh.Vfs.Parent(srcPath, user);
                    if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
                    sh.Vfs.Insert(target, node, user);
                    dir.Children!.Remove(VfsLib.Basename(srcPath));
                }
                else
                {
                    if (node.Type == "file" && !VfsLib.HasPerm(node, user, 'r'))
                    {
                        ctx.Err($"cp: cannot open '{src}' for reading: Permission denied\n");
                        code = 1;
                        continue;
                    }
                    if (existing?.Type == "file")
                    {
                        if (!VfsLib.HasPerm(existing, user, 'w')) throw new FsError("EACCES");
                        existing.Content = node.Content;
                        existing.Size = node.Size;
                        existing.Mtime = Js.Now();
                    }
                    else
                    {
                        var copy = VfsLib.CloneNode(node);
                        if (!o.Flags.Contains("a")) ChownTree(copy, user);
                        sh.Vfs.Insert(target, copy, user);
                    }
                }
                if (o.Flags.Contains("v")) ctx.Out(move ? $"renamed '{src}' -> '{targetLabel}'\n" : $"'{src}' -> '{targetLabel}'\n");
            }
            catch (FsError e)
            {
                var msg = e.Message;
                ctx.Err(move
                    ? $"mv: cannot move '{src}' to '{targetLabel}': {msg}\n"
                    : $"cp: cannot create {(node.Type == "dir" ? "directory" : "regular file")} '{targetLabel}': {msg}\n");
                code = 1;
            }
        }
        return code;
    }

    private static readonly Regex ModeRe = new(@"^([ugoa]*[-+=][rwxXst]*)(,[ugoa]*[-+=][rwxXst]*)*\z", RegexOptions.CultureInvariant);
    private static readonly Regex OctalModeRe = new(@"^[0-7]{1,4}\z", RegexOptions.CultureInvariant);
    private static readonly Regex ClauseRe = new(@"^([ugoa]*)([-+=])([rwxXst]*)\z", RegexOptions.CultureInvariant);

    public static int? ApplyMode(int current, string spec, bool isDir)
    {
        if (OctalModeRe.IsMatch(spec)) return Convert.ToInt32(spec, 8);
        if (!ModeRe.IsMatch(spec)) return null;
        int mode = current;
        foreach (var clause in spec.Split(','))
        {
            var m = ClauseRe.Match(clause);
            var who = m.Groups[1].Value != "" ? m.Groups[1].Value : "a";
            var classes = who.Contains('a') ? new List<char> { 'u', 'g', 'o' } : who.Distinct().ToList();
            int bits = 0;
            int clear = 0;
            foreach (var c in classes)
            {
                int shift = c == 'u' ? 6 : c == 'g' ? 3 : 0;
                clear |= 7 << shift;
                foreach (var p in m.Groups[3].Value)
                {
                    if (p == 'r') bits |= 4 << shift;
                    if (p == 'w') bits |= 2 << shift;
                    if (p == 'x') bits |= 1 << shift;
                    if (p == 'X' && (isDir || (current & Js.Oct(111)) != 0)) bits |= 1 << shift;
                    if (p == 's' && c == 'u') bits |= Js.Oct(4000);
                    if (p == 's' && c == 'g') bits |= Js.Oct(2000);
                    if (p == 't' && c == 'o') bits |= Js.Oct(1000);
                }
            }
            var op = m.Groups[2].Value;
            if (op == "+") mode |= bits;
            else if (op == "-") mode &= ~bits;
            else mode = (mode & ~clear) | bits;
        }
        return mode;
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Cd, Pwd, Ls, Mkdir, Rmdir, Touch, Rm, Cp, Mv, Find, Chmod, Chown };
}
