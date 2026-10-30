using System.Text.Json;

namespace Codestead.UI;

/// <summary>
/// Saves small JSON files per tool in the user's app data folder:
/// Windows %APPDATA%\Codestead\&lt;tool&gt;, Linux ~/.config/Codestead/&lt;tool&gt;.
/// Writes are atomic (temp file + move) so a crash never leaves a half-written file.
/// </summary>
public sealed class Storage
{
    private static readonly JsonSerializerOptions Options = Codestead.Shell.Js.JsonOptions;

    public string Directory { get; }

    public Storage(string toolId, string? baseDirectory = null)
    {
        var root = baseDirectory
            ?? Environment.GetEnvironmentVariable("CODESTEAD_DATA_DIR")
            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Codestead");
        Directory = Path.Combine(root, toolId);
    }

    private string PathFor(string name) => Path.Combine(Directory, name + ".json");

    public T? Load<T>(string name)
    {
        try
        {
            var path = PathFor(name);
            return File.Exists(path) ? JsonSerializer.Deserialize<T>(File.ReadAllText(path), Options) : default;
        }
        catch (Exception e) when (e is IOException or JsonException or UnauthorizedAccessException or NotSupportedException)
        {
            return default;
        }
    }

    public string? LoadText(string name)
    {
        try
        {
            var path = PathFor(name);
            return File.Exists(path) ? File.ReadAllText(path) : null;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    public void Save<T>(string name, T value) => SaveText(name, JsonSerializer.Serialize(value, Options));

    public void SaveText(string name, string json)
    {
        try
        {
            System.IO.Directory.CreateDirectory(Directory);
            var path = PathFor(name);
            var tmp = path + ".tmp";
            File.WriteAllText(tmp, json);
            File.Move(tmp, path, overwrite: true);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            // Saving is best effort; the app keeps working without it.
        }
    }

    public void Remove(string name)
    {
        try
        {
            File.Delete(PathFor(name));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
        }
    }
}
