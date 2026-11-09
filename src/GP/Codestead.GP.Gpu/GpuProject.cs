namespace Codestead.GP.Gpu;

/// <summary>The learner's project: its files by path ("main.cpp", "shaders/shader.vert"), in the order they are shown.</summary>
public sealed class GpuProject
{
    public OrderedDictionary<string, string> Files { get; set; } = new(StringComparer.Ordinal);

    public GpuProject()
    {
    }

    public GpuProject(IEnumerable<KeyValuePair<string, string>> files)
    {
        foreach (var (k, v) in files) Files[k] = v.Replace("\r\n", "\n");
    }

    public GpuProject Clone() => new(Files);

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

    /// <summary>The C++ sources (.cpp and .h files).</summary>
    public IEnumerable<KeyValuePair<string, string>> CppFiles =>
        Files.Where(kv => kv.Key.EndsWith(".cpp", StringComparison.Ordinal) || kv.Key.EndsWith(".h", StringComparison.Ordinal) || kv.Key.EndsWith(".hpp", StringComparison.Ordinal));

    /// <summary>The file that has main() (or WinMain/wWinMain), else the first .cpp file.</summary>
    public string MainFile =>
        CppFiles.FirstOrDefault(kv => System.Text.RegularExpressions.Regex.IsMatch(kv.Value, @"\b(?:w?WinMain|main)\s*\(")).Key
        ?? CppFiles.FirstOrDefault().Key ?? Files.Keys.FirstOrDefault() ?? "main.cpp";
}
