using Codestead.UI;

namespace Codestead.GP.YourProject;

/// <summary>
/// The main file the learner picked for each chapter and API ("opengl/hello-window" → a path), for "Check my code",
/// saved in the app's data folder (mainfiles.json), and the folder the file pickers start in. The learner organises
/// their code as they like; the file can be anywhere.
/// </summary>
public sealed class MainFiles
{
    private const string Name = "mainfiles";
    /// <summary>The earlier app's project folder per chapter (folders.json): its main file is used until another is picked.</summary>
    private const string OldFolders = "folders";
    private readonly Storage storage;
    private readonly Choices data;
    private readonly Dictionary<string, string> oldFolders;

    public MainFiles(Storage storage)
    {
        this.storage = storage;
        data = storage.Load<Choices>(Name) ?? new Choices();
        oldFolders = storage.Load<OldChoices>(OldFolders)?.Folders ?? new Dictionary<string, string>(StringComparer.Ordinal);
    }

    private static string Key(string api, string chapterId) => $"{api}/{chapterId}";

    /// <summary>The chapter's main file: the one picked, else the course's main file in the earlier app's folder.</summary>
    public string? Get(string api, string chapterId, string courseMainFile)
    {
        if (data.Files.GetValueOrDefault(Key(api, chapterId)) is { } file) return file;
        if (oldFolders.GetValueOrDefault(Key(api, chapterId)) is { } folder && Path.Combine(folder, courseMainFile) is var old && File.Exists(old)) return old;
        return null;
    }

    public void Set(string api, string chapterId, string file)
    {
        file = Path.GetFullPath(file);
        data.Files[Key(api, chapterId)] = file;
        data.LastFolder = Path.GetDirectoryName(file);
        storage.Save(Name, data);
    }

    /// <summary>Where the pickers start: the folder of the last file picked or saved.</summary>
    public string? LastFolder => data.LastFolder;

    /// <summary>What mainfiles.json holds.</summary>
    public sealed class Choices
    {
        public Dictionary<string, string> Files { get; set; } = new(StringComparer.Ordinal);

        public string? LastFolder { get; set; }
    }

    /// <summary>What the earlier app's folders.json held (only the folders are read).</summary>
    public sealed class OldChoices
    {
        public Dictionary<string, string> Folders { get; set; } = new(StringComparer.Ordinal);
    }
}
