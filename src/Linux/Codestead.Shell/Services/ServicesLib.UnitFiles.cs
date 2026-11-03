namespace Codestead.Shell;

// ServicesLib: parsing, writing, finding and loading unit files, and enabled/preset state.

public static partial class ServicesLib
{
    // ---------- Unit files ----------

    private static readonly Regex SectionRe = new(@"^\[(.+)\]\z", RegexOptions.CultureInvariant);
    private static readonly Regex WhitespaceRe = new(@"\s+", RegexOptions.CultureInvariant);
    private static readonly Regex ExecPrefixRe = new(@"^[-@:+!]+", RegexOptions.CultureInvariant);
    private static readonly Regex TruthyRe = new(@"^(yes|true|1|on)\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>Reads the most important settings from a unit file.</summary>
    public static ParsedUnit ParseUnit(string text)
    {
        var values = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var section = "";
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line == "" || line.StartsWith('#') || line.StartsWith(';')) continue;
            var sec = SectionRe.Match(line);
            if (sec.Success)
            {
                section = sec.Groups[1].Value;
                continue;
            }
            var eq = line.IndexOf('=');
            if (eq < 0) continue;
            var key = $"{section}.{line[..eq].Trim()}";
            if (!values.TryGetValue(key, out var list)) values[key] = list = new List<string>();
            list.Add(line[(eq + 1)..].Trim());
        }
        string? Last(string k) => values.TryGetValue(k, out var v) && v.Count > 0 ? v[^1] : null;
        List<string> ListOf(string k) => (values.TryGetValue(k, out var v) ? v : new List<string>())
            .SelectMany(x => WhitespaceRe.Split(x)).Where(x => x != "").ToList();
        var type = Last("Service.Type") ?? "simple";
        var wantedBy = ListOf("Install.WantedBy");
        wantedBy.AddRange(ListOf("Install.RequiredBy"));
        return new ParsedUnit
        {
            Description = Last("Unit.Description") ?? "",
            Docs = ListOf("Unit.Documentation"),
            Type = type,
            Exec = ExecPrefixRe.Replace(Last("Service.ExecStart") ?? "", "", 1),
            Reload = Last("Service.ExecReload"),
            User = Last("Service.User"),
            RemainAfterExit = TruthyRe.IsMatch(Last("Service.RemainAfterExit") ?? ""),
            WantedBy = wantedBy,
            Alias = ListOf("Install.Alias"),
        };
    }

    private static FsNode EnsureDir(Shell sh, string path)
    {
        var root = sh.RootUser();
        var cur = "";
        var node = sh.Vfs.Root;
        foreach (var seg in path.Split('/').Where(s => s != ""))
        {
            cur += "/" + seg;
            if (!node.Children!.TryGetValue(seg, out var next))
            {
                next = VfsLib.MakeDir("root", Js.Oct(755));
                node.Children[seg] = next;
            }
            node = next;
        }
        return sh.Vfs.Lookup(cur == "" ? "/" : cur, root);
    }

    private static string WantsPath(string target, string unit) => $"{AdminUnitDir}/{target}.wants/{unit}";

    private static void WriteUnitFiles(Shell sh)
    {
        var sys = EnsureDir(sh, SystemUnitDir);
        var admin = EnsureDir(sh, AdminUnitDir);
        foreach (var def in ServiceDefs(sh.Distro))
        {
            var dir = def.Admin ? admin : sys;
            dir.Children![def.Name] = VfsLib.MakeFile(UnitFile(def));
            if (def.Enabled && !string.IsNullOrEmpty(def.WantedBy))
            {
                var wants = EnsureDir(sh, $"{AdminUnitDir}/{def.WantedBy}.wants");
                wants.Children![def.Name] = VfsLib.MakeLink($"{(def.Admin ? AdminUnitDir : SystemUnitDir)}/{def.Name}");
            }
        }
        var etc = sh.Vfs.Lookup("/etc", sh.RootUser());
        if (!etc.Children!.ContainsKey("reportd.conf.example")) etc.Children["reportd.conf.example"] = VfsLib.MakeFile(ReportdExample);
    }

    /// <summary>Finds the unit file of a service (the administrator's copy wins over the package's).</summary>
    private static (string Path, string Content)? FindUnitFile(Shell sh, string name)
    {
        foreach (var dir in new[] { AdminUnitDir, SystemUnitDir })
        {
            var node = sh.Vfs.TryLookup($"{dir}/{name}", sh.RootUser());
            if (node?.Type == "file") return ($"{dir}/{name}", node.Content ?? "");
        }
        return null;
    }

    /// <summary>Loads (or reloads) a service from its unit file.</summary>
    private static UnitRt? LoadUnit(Shell sh, string name)
    {
        var file = FindUnitFile(sh, name);
        var st = sh.Services;
        if (file is null) return null;
        if (st.Units.TryGetValue(name, out var existing))
        {
            existing.Path = file.Value.Path;
            existing.Loaded = file.Value.Content;
            return existing;
        }
        var rt = new UnitRt { Name = name, Path = file.Value.Path, Loaded = file.Value.Content, Active = "inactive", Sub = "dead" };
        st.Units[name] = rt;
        return rt;
    }

    private static readonly Regex DigitsRe = new(@"^[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex HasSuffixRe = new(@"\.[a-z]+\z", RegexOptions.CultureInvariant);

    /// <summary>Translates "myserver", "sshd" (alias) or "myserver.service" to a loaded service.</summary>
    public static UnitRt? ResolveUnit(Shell sh, string arg)
    {
        var st = sh.Services;
        if (DigitsRe.IsMatch(arg))
        {
            var n = Js.Number(arg);
            return st.Units.Values.FirstOrDefault(u => u.Pid is int p && p == n);
        }
        var name = HasSuffixRe.IsMatch(arg) ? arg : $"{arg}.service";
        if (!name.EndsWith(".service", StringComparison.Ordinal)) return null;
        if (st.Units.TryGetValue(name, out var found)) return found;
        foreach (var u in st.Units.Values) if (ParseUnit(u.Loaded).Alias.Contains(name)) return u;
        return LoadUnit(sh, name);
    }

    /// <summary>The full name of the service for error messages ("myserver" → "myserver.service").</summary>
    public static string UnitName(string arg) => HasSuffixRe.IsMatch(arg) ? arg : $"{arg}.service";

    public static ParsedUnit UnitInfo(UnitRt rt) => ParseUnit(rt.Loaded);

    /// <summary>Has the unit file changed since it was loaded?</summary>
    public static bool ChangedOnDisk(Shell sh, UnitRt rt)
    {
        var file = FindUnitFile(sh, rt.Name);
        return file is not null && file.Value.Content != rt.Loaded;
    }

    /// <summary>"enabled", "disabled", "static" or "alias".</summary>
    public static string EnabledState(Shell sh, UnitRt rt, string? asked = null)
    {
        if (!string.IsNullOrEmpty(asked) && UnitName(asked) != rt.Name) return "alias";
        var info = UnitInfo(rt);
        if (info.WantedBy.Count == 0) return "static";
        return info.WantedBy.Any(t => sh.Vfs.TryLookup(WantsPath(t, rt.Name), sh.RootUser()) is not null) ? "enabled" : "disabled";
    }

    /// <summary>"preset" in the status output: Debian enables new services, Arch and Fedora do not.</summary>
    public static string PresetState(Shell sh) => sh.Distro.Family == "debian" ? "enabled" : "disabled";
}
