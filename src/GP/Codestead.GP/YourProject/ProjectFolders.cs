using Codestead.UI;

namespace Codestead.GP.YourProject;

/// <summary>
/// The learner's project folder for each chapter and API ("opengl/hello-window" → a path), saved in the app's data
/// folder (folders.json), and the base folder the next chapter's folder is suggested in: &lt;base&gt;/&lt;api&gt;/&lt;chapter&gt;.
/// </summary>
public sealed class ProjectFolders
{
    private const string Name = "folders";
    private readonly Storage storage;
    private readonly FolderChoices data;

    public ProjectFolders(Storage storage)
    {
        this.storage = storage;
        data = storage.Load<FolderChoices>(Name) ?? new FolderChoices();
    }

    private static string Key(string api, string chapterId) => $"{api}/{chapterId}";

    /// <summary>Has a folder been chosen for any chapter?</summary>
    public bool Any => data.Folders.Count > 0;

    public string? Get(string api, string chapterId) => data.Folders.GetValueOrDefault(Key(api, chapterId));

    /// <summary>Remembers a chapter's folder; the base becomes the folder above &lt;api&gt;/&lt;chapter&gt; (or the folder's parent).</summary>
    public void Set(string api, string chapterId, string folder)
    {
        folder = Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        data.Folders[Key(api, chapterId)] = folder;
        data.Base = BaseOf(folder, api, chapterId);
        storage.Save(Name, data);
    }

    /// <summary>Where this chapter's folder would go: &lt;base&gt;/&lt;api&gt;/&lt;chapter&gt; (null before the first choice).</summary>
    public string? Suggestion(string api, string chapterId) =>
        data.Base is { } b ? Path.Combine(b, api, chapterId) : null;

    public static string? BaseOf(string folder, string api, string chapterId)
    {
        var dir = new DirectoryInfo(folder);
        if (dir.Parent is { } parent && string.Equals(dir.Name, chapterId, StringComparison.OrdinalIgnoreCase)
            && string.Equals(parent.Name, api, StringComparison.OrdinalIgnoreCase) && parent.Parent is { } grand)
            return grand.FullName;
        return dir.Parent?.FullName;
    }
}
