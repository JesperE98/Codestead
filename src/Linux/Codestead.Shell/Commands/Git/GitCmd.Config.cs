namespace Codestead.Shell.Commands;

// Configuration files (.git/config, ~/.gitconfig), the identity and time used for commits, and git config.

public static partial class GitCmd
{
    private sealed class ConfigEntry
    {
        public string Key = "";
        public string Value = "";
        public string Scope = "";
        public string Path = "";
    }

    private static readonly Regex SectionRe = new("^\\[\\s*([A-Za-z0-9.-]+)(?:\\s+\"((?:[^\"\\\\]|\\\\.)*)\")?\\s*\\]", RO);
    private static readonly Regex KvRe = new("^([A-Za-z][A-Za-z0-9-]*)\\s*(?:=\\s*(.*))?\\z", RO);
    private static readonly Regex KvNameRe = new("^([A-Za-z][A-Za-z0-9-]*)\\s*(=|\\z)", RO);
    private static readonly Regex UnescapeRe = new("\\\\(.)", RO);

    private static List<ConfigEntry> ParseConfig(string text)
    {
        var entries = new List<ConfigEntry>();
        var section = "";
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line == "" || line.StartsWith('#') || line.StartsWith(';')) continue;
            var head = SectionRe.Match(line);
            if (head.Success)
            {
                section = head.Groups[1].Value.ToLowerInvariant() + (head.Groups[2].Success ? "." + UnescapeRe.Replace(head.Groups[2].Value, "$1") : "");
                continue;
            }
            var kv = KvRe.Match(line);
            if (!kv.Success || section == "") continue;
            entries.Add(new ConfigEntry { Key = $"{section}.{kv.Groups[1].Value.ToLowerInvariant()}", Value = !kv.Groups[2].Success ? "true" : Unquote(kv.Groups[2].Value) });
        }
        return entries;
    }

    private static string Unquote(string v)
    {
        var sb = new StringBuilder();
        bool q = false;
        for (int i = 0; i < v.Length; i++)
        {
            char ch = v[i];
            if (ch == '"') q = !q;
            else if (ch == '\\' && i + 1 < v.Length)
            {
                char n = v[++i];
                sb.Append(n == 'n' ? '\n' : n == 't' ? '\t' : n);
            }
            else if (!q && (ch == '#' || ch == ';')) break;
            else sb.Append(ch);
        }
        var o = sb.ToString();
        return q ? o : o.Trim();
    }

    private static readonly Regex NeedsQuoteRe = new("^\\s|\\s\\z|[#;\"\\\\\\n\\t]", RO);

    private static string QuoteValue(string v)
    {
        var esc = v.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\t", "\\t");
        return NeedsQuoteRe.IsMatch(v) ? $"\"{esc}\"" : esc;
    }

    private sealed class KeyParts
    {
        public string Section = "";
        public string? Sub;
        public string Name = "";
    }

    private static readonly Regex KeyNameRe = new("^[A-Za-z][A-Za-z0-9-]*\\z", RO);

    private static KeyParts? SplitKey(string key)
    {
        int first = key.IndexOf('.');
        int last = key.LastIndexOf('.');
        if (first < 0) return null;
        var name = key.Slice(last + 1);
        if (!KeyNameRe.IsMatch(name)) return null;
        return new KeyParts { Section = key.Slice(0, first).ToLowerInvariant(), Sub = first == last ? null : key.Slice(first + 1, last), Name = name };
    }

    private static string NormKey(KeyParts k) => $"{k.Section}{(k.Sub is not null ? "." + k.Sub : "")}.{k.Name.ToLowerInvariant()}";

    private static readonly Regex SubQuoteRe = new("([\"\\\\])", RO);

    /// <summary>Sets (or removes, with value null) a key in the configuration text.</summary>
    private static string SetConfigText(string text, KeyParts key, string? value)
    {
        var lines = text.Split('\n').ToList();
        if (lines[^1] == "") lines.RemoveAt(lines.Count - 1);
        bool inSection = false;
        int sectionEnd = -1;
        int keyLine = -1;
        var toRemove = new List<int>();
        for (int i = 0; i < lines.Count; i++)
        {
            var line = lines[i].Trim();
            var head = SectionRe.Match(line);
            if (head.Success)
            {
                string? sub = head.Groups[2].Success ? UnescapeRe.Replace(head.Groups[2].Value, "$1") : null;
                inSection = head.Groups[1].Value.ToLowerInvariant() == key.Section && sub == key.Sub;
                if (inSection) sectionEnd = i + 1;
                continue;
            }
            if (!inSection) continue;
            sectionEnd = i + 1;
            var kv = KvNameRe.Match(line);
            if (kv.Success && kv.Groups[1].Value.ToLowerInvariant() == key.Name.ToLowerInvariant())
            {
                keyLine = i;
                toRemove.Add(i);
            }
        }
        if (value is null)
        {
            return string.Concat(lines.Where((_, i) => !toRemove.Contains(i)).Select(l => l + "\n"));
        }
        var formatted = $"\t{key.Name} = {QuoteValue(value)}";
        if (keyLine >= 0) lines[keyLine] = formatted;
        else if (sectionEnd >= 0) lines.Insert(sectionEnd, formatted);
        else
        {
            lines.Add(key.Sub is not null ? $"[{key.Section} \"{SubQuoteRe.Replace(key.Sub, "\\$1")}\"]" : $"[{key.Section}]");
            lines.Add(formatted);
        }
        return string.Concat(lines.Select(l => l + "\n"));
    }

    private static string GlobalConfigPath(G g) => $"{g.Sh.Home}/.gitconfig";

    /// <summary>All configuration files that apply, in order (later wins).</summary>
    private static List<(string Scope, string Path)> ConfigFiles(G g, Repo? r)
    {
        var files = new List<(string Scope, string Path)> { ("system", "/etc/gitconfig"), ("global", GlobalConfigPath(g)) };
        if (r is not null) files.Add(("local", Gpath(r, "config")));
        return files;
    }

    private static List<ConfigEntry> ConfigAll(G g, Repo? r) =>
        ConfigFiles(g, r).SelectMany(f => ParseConfig(ReadText(g, f.Path) ?? "").Select(e =>
        {
            e.Scope = f.Scope;
            e.Path = f.Path;
            return e;
        })).ToList();

    private static string? GetConfig(G g, Repo? r, string key)
    {
        var k = SplitKey(key);
        if (k is null) return null;
        var nk = NormKey(k);
        return ConfigAll(g, r).Where(e => e.Key == nk).LastOrDefault()?.Value;
    }

    private static readonly Regex TrueRe = new("^(true|yes|on|1)\\z", RO | RegexOptions.IgnoreCase);

    private static bool ConfigBool(string? v, bool def) => v is null ? def : TrueRe.IsMatch(v);

    private static void SetConfig(G g, string path, string key, string? value)
    {
        var k = SplitKey(key) ?? throw Fail($"error: key does not contain a section: {key}", 2);
        var text = ReadText(g, path) ?? "";
        WriteText(g, path, SetConfigText(text, k, value));
    }

    private static long Now() => (long)Math.Floor(Js.Now() / 1000.0);

    private static string TzNow()
    {
        var off = (int)Math.Round(TimeZoneInfo.Local.GetUtcOffset(DateTimeOffset.FromUnixTimeMilliseconds(Js.Now())).TotalMinutes);
        int a = Math.Abs(off);
        return $"{(off < 0 ? "-" : "+")}{(a / 60).ToString(CultureInfo.InvariantCulture).PadLeft(2, '0')}{(a % 60).ToString(CultureInfo.InvariantCulture).PadLeft(2, '0')}";
    }

    private static string FmtDate(Ident i)
    {
        int sign = i.Tz.CharAt(0) == "-" ? -1 : 1;
        var off = sign * (Js.Number(i.Tz.Slice(1, 3)) * 60 + Js.Number(i.Tz.Slice(3, 5)));
        var d = DateTimeOffset.FromUnixTimeMilliseconds((long)((i.Time + off * 60) * 1000)).UtcDateTime;
        var t = $"{d.Hour:00}:{d.Minute:00}:{d.Second:00}";
        return $"{UtilCmd.Days[(int)d.DayOfWeek]} {UtilCmd.Months[d.Month - 1]} {d.Day} {t} {d.Year} {i.Tz}";
    }

    /// <summary>The name from /etc/passwd (GECOS), which real git uses if user.name is missing.</summary>
    private static string GecosName(G g)
    {
        var passwd = g.Sh.Vfs.TryLookup("/etc/passwd", g.Sh.RootUser())?.Content ?? "";
        var line = passwd.Split('\n').FirstOrDefault(l => l.StartsWith(g.User.Name + ":", StringComparison.Ordinal));
        var fields = line?.Split(':');
        var gecos = fields is not null && fields.Length > 4 ? fields[4].Split(',')[0] : null;
        return !string.IsNullOrEmpty(gecos) ? gecos : g.User.Name;
    }

    private static Ident? Identity(G g, Repo? r, bool strict = true)
    {
        var email = GetConfig(g, r, "user.email") ?? g.Sh.Env.Get("EMAIL");
        var cfgName = GetConfig(g, r, "user.name");
        var name = !string.IsNullOrEmpty(cfgName) ? cfgName : GecosName(g);
        if (string.IsNullOrEmpty(email))
        {
            if (!strict) return null;
            throw Fail(
                $"Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email \"you@example.com\"\n  git config --global user.name \"Your Name\"\n\nto set your account's default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got '{g.User.Name}@{g.Sh.Distro.Hostname}.(none)')",
                128);
        }
        return new Ident { Name = name, Email = email, Time = Now(), Tz = TzNow() };
    }

    // config

    private static int CmdConfig(G g, List<string> args)
    {
        // The new syntax (git 2.46+): git config list|get|set|unset ...
        string? action = null;
        if (args.Count > 0 && args[0] is "list" or "get" or "set" or "unset")
        {
            action = args[0];
            args = args.Skip(1).ToList();
        }
        var o = ParseArgs(args, new[] { "global", "local", "system", "l|list", "get", "get-all", "unset", "unset-all", "show-origin", "e|edit", "add", "all" }, "config");
        string? scope = o.Has("global") ? "global" : o.Has("system") ? "system" : o.Has("local") ? "local" : null;
        if (o.Has("edit"))
        {
            g.Note("git.configEditUnsupported");
            return 1;
        }
        if (o.Has("list")) action = "list";
        else if (o.Has("get") || o.Has("get-all")) action = "get";
        else if (o.Has("unset") || o.Has("unset-all")) action = "unset";
        action ??= o.Operands.Count >= 2 ? "set" : o.Operands.Count == 1 ? "get" : null;
        if (action is null)
            throw Fail("usage: git config [<options>]\n\n    git config list [<file-option>] [<display-option>] [--includes]\n    git config get [<file-option>] [<display-option>] [--includes] [--all] <name>\n    git config set [<file-option>] [--type=<type>] [--all] [--value=<value>] [--fixed-value] <name> <value>\n    git config unset [<file-option>] [--all] [--value=<value>] [--fixed-value] <name>", 129);
        var r = Discover(g, g.Cwd);
        string PathFor(string s) => s == "global" ? GlobalConfigPath(g) : s == "system" ? "/etc/gitconfig" : r is not null ? Gpath(r, "config") : throw Fatal("not in a git directory");
        if (action == "list")
        {
            List<ConfigEntry> entries;
            if (scope is not null)
            {
                var path = PathFor(scope);
                entries = ParseConfig(ReadText(g, path) ?? "").Select(e =>
                {
                    e.Path = path;
                    return e;
                }).ToList();
            }
            else entries = ConfigAll(g, r);
            if (scope is not null && ReadText(g, PathFor(scope)) is null) throw Fatal($"unable to read config file '{PathFor(scope)}': No such file or directory");
            foreach (var e in entries) g.Out($"{(o.Has("show-origin") ? $"file:{e.Path}\t" : "")}{e.Key}={e.Value}\n");
            return 0;
        }
        var key = o.Operands.Count > 0 ? o.Operands[0] : null;
        var parts = SplitKey(key ?? "");
        if (parts is null)
        {
            if (!string.IsNullOrEmpty(key) && !key.Contains('.')) throw Fail($"error: key does not contain a section: {key}", 2);
            throw Fail($"error: invalid key: {key ?? ""}", 1);
        }
        if (action == "get")
        {
            var nk = NormKey(parts);
            var entries = (scope is not null ? ParseConfig(ReadText(g, PathFor(scope)) ?? "") : ConfigAll(g, r)).Where(e => e.Key == nk).ToList();
            if (entries.Count == 0) return 1;
            foreach (var e in o.Has("get-all") || o.Has("all") ? entries : JsSlice(entries, -1)) g.Out(e.Value + "\n");
            return 0;
        }
        var cfgPath = PathFor(scope ?? "local");
        if (action == "unset")
        {
            var text = ReadText(g, cfgPath) ?? "";
            if (!ParseConfig(text).Any(e => e.Key == NormKey(parts))) return 5;
            WriteText(g, cfgPath, SetConfigText(text, parts, null));
            return 0;
        }
        var value = o.Operands.Count > 1 ? o.Operands[1] : null;
        if (value is null) throw Fail("error: wrong number of arguments, should be 2", 129);
        SetConfig(g, cfgPath, key!, value);
        return 0;
    }
}
