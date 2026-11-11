namespace Codestead.GP.Gpu;

/// <summary>The learner's project: its files by path ("main.cpp", "shaders/shader.vert"), in the order they are shown.</summary>
public sealed class GpuProject
{
    public OrderedDictionary<string, string> Files { get; set; } = new(StringComparer.Ordinal);

    /// <summary>Binary files the code loads (images), by path. They are shown but not edited.</summary>
    public OrderedDictionary<string, byte[]> Assets { get; set; } = new(StringComparer.Ordinal);

    public GpuProject()
    {
    }

    public GpuProject(IEnumerable<KeyValuePair<string, string>> files)
    {
        foreach (var (k, v) in files) Files[k] = v.Replace("\r\n", "\n");
    }

    public GpuProject Clone()
    {
        var copy = new GpuProject(Files);
        foreach (var (k, v) in Assets) copy.Assets[k] = v;
        return copy;
    }

    /// <summary>An asset by its path or by its name alone, or null.</summary>
    public byte[]? FindAsset(string name)
    {
        name = name.Replace('\\', '/').TrimStart('.', '/');
        if (Assets.TryGetValue(name, out var data)) return data;
        var file = Path.GetFileName(name);
        return Assets.FirstOrDefault(kv => Path.GetFileName(kv.Key) == file).Value;
    }

    /// <summary>A file by its path, or by its name alone ("shader.vs" finds "shaders/shader.vs").</summary>
    public string? Find(string name)
    {
        name = name.Replace('\\', '/').TrimStart('.', '/');
        if (Files.TryGetValue(name, out var text)) return text;
        var file = Path.GetFileName(name);
        return Files.FirstOrDefault(kv => Path.GetFileName(kv.Key) == file).Value;
    }

    public string? PathOf(string name)
    {
        name = name.Replace('\\', '/').TrimStart('.', '/');
        if (Files.ContainsKey(name)) return name;
        var file = Path.GetFileName(name);
        return Files.Keys.FirstOrDefault(k => Path.GetFileName(k) == file);
    }

    /// <summary>
    /// The main file's text as the simulator reads it: the project's headers it includes that only hold data (const
    /// float LTC1[] = { … }: no functions, no classes) are appended after it, so their arrays are known (the main file's
    /// own offsets and lines stay as they are).
    /// </summary>
    public string MainText()
    {
        var main = MainFile;
        var text = Files.TryGetValue(main, out var t) ? t : "";
        var appended = new System.Text.StringBuilder();
        foreach (System.Text.RegularExpressions.Match m in System.Text.RegularExpressions.Regex.Matches(text, @"^[ \t]*#\s*include\s*""([^""]+)""", System.Text.RegularExpressions.RegexOptions.Multiline))
        {
            if (Find(m.Groups[1].Value) is not { } header || PathOf(m.Groups[1].Value) == main) continue;
            var code = Readers.CppSource.BlankComments(header);
            if (System.Text.RegularExpressions.Regex.IsMatch(code, @"\)\s*(?:const\s*)?\{|\bclass\s+\w+|\bstruct\s+\w+\s*\{[^}]*\(")) continue;
            appended.Append("\n// ---- ").Append(m.Groups[1].Value).Append(" ----\n").Append(code);
        }
        return appended.Length == 0 ? text : text + "\n" + appended;
    }

    /// <summary>The C++ sources (.cpp and .h files).</summary>
    public IEnumerable<KeyValuePair<string, string>> CppFiles =>
        Files.Where(kv => kv.Key.EndsWith(".cpp", StringComparison.Ordinal) || kv.Key.EndsWith(".h", StringComparison.Ordinal) || kv.Key.EndsWith(".hpp", StringComparison.Ordinal));

    /// <summary>The file that has main() (or WinMain/wWinMain), else the first .cpp file.</summary>
    public string MainFile =>
        CppFiles.FirstOrDefault(kv => System.Text.RegularExpressions.Regex.IsMatch(kv.Value, @"\b(?:w?WinMain|main)\s*\(")).Key
        ?? CppFiles.FirstOrDefault().Key ?? Files.Keys.FirstOrDefault() ?? "main.cpp";
}
