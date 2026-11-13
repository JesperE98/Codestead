using System.Text.Json;
using Avalonia.Controls;
using Avalonia.Platform.Storage;
using Codestead.GP.Course;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu;

namespace Codestead.GP;

// The panel's buttons: "Check my code" (asks for the chapter's main file the first time; "Change file…" asks again)
// and "Save start files…" (into a folder the learner picks; its main file is then the one checked).
public sealed partial class GpTool
{
    private static readonly FilePickerFileType SourceFiles = new("C/C++") { Patterns = ["*.cpp", "*.cc", "*.cxx", "*.c"] };

    private async Task CheckMyCode(bool pickAgain)
    {
        if (pickAgain || mainFile is null || !File.Exists(mainFile))
        {
            if (await PickMainFile() is not { } picked) return;
            SetMainFile(picked);
        }
        await StartCheck();
    }

    private async Task<string?> PickMainFile()
    {
        if (TopLevel.GetTopLevel(Window)?.StorageProvider is not { CanOpen: true } storage) return null;
        var picked = await storage.OpenFilePickerAsync(new FilePickerOpenOptions
        {
            Title = Window.T("yourProject.pickTitle", ("chapter", ChapterTitle(chapter, Window.Lang)), ("api", Apis.Get(shownApi).Name)),
            AllowMultiple = false,
            FileTypeFilter = [SourceFiles, FilePickerFileTypes.All],
            SuggestedStartLocation = await StartFolder(storage),
        });
        return picked.Count > 0 ? picked[0].TryGetLocalPath() : null;
    }

    /// <summary>The pickers start in the main file's folder, else where the last one was.</summary>
    private async Task<IStorageFolder?> StartFolder(IStorageProvider storage)
    {
        var near = mainFile is not null ? Path.GetDirectoryName(mainFile) : MainFiles.LastFolder;
        while (near is not null && !Directory.Exists(near)) near = Path.GetDirectoryName(near);
        return near is null ? null : await storage.TryGetFolderFromPathAsync(near);
    }

    /// <summary>Saves files into a folder the learner picks, asking first when that would overwrite other contents.</summary>
    private async Task SaveFiles(GpuProject files)
    {
        if (TopLevel.GetTopLevel(Window)?.StorageProvider is not { CanPickFolder: true } storage) return;
        var picked = await storage.OpenFolderPickerAsync(new FolderPickerOpenOptions
        {
            Title = Window.T("yourProject.saveFolderTitle", ("chapter", ChapterTitle(chapter, Window.Lang)), ("api", Apis.Get(shownApi).Name)),
            AllowMultiple = false,
            SuggestedStartLocation = await StartFolder(storage),
        });
        if (picked.Count == 0 || picked[0].TryGetLocalPath() is not { } target) return;
        SaveFilesTo(target, files);
    }

    private void SaveFilesTo(string target, GpuProject files)
    {
        var conflicts = StartFiles.Conflicts(target, files);
        if (conflicts.Count == 0)
        {
            Save(target, files);
            return;
        }
        var list = string.Join(", ", conflicts.Take(6)) + (conflicts.Count > 6 ? ", …" : "");
        Window.Overlay.Confirm(Window.T("yourProject.copyConfirmTitle"), Window.T("yourProject.copyConfirm", ("count", conflicts.Count), ("files", list)),
            Window.T("yourProject.overwrite"), Window.T("dialog.cancel"), true, () => Save(target, files));
    }

    private void Save(string target, GpuProject files)
    {
        try
        {
            int n = StartFiles.Copy(target, files);
            var main = Path.Combine(target, files.MainFile);
            if (File.Exists(main)) SetMainFile(main);
            Window.Toast(Window.T("yourProject.saved", ("count", n), ("file", files.MainFile)));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            Window.Toast(Window.T("yourProject.copyFailed", ("message", e.Message)));
        }
    }

    // ---------- Code from the old built-in editor ----------

    /// <summary>Where the app's old built-in editor saved the chapter's code (project.&lt;api&gt;.&lt;chapter&gt;.json).</summary>
    private string OldCodeKey => $"project.{shownApi}.{chapter}";

    private bool HasOldCode() => chapter != "" && File.Exists(Path.Combine(Window.Storage.Directory, OldCodeKey + ".json"));

    private void SaveOldCode()
    {
        try
        {
            var json = Window.Storage.LoadText(OldCodeKey);
            var files = json is null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            if (files is not { Count: > 0 }) return;
            var project = new GpuProject(files);
            foreach (var (name, bytes) in GpCourse.StartProject(chapter, shownApi).Assets) project.Assets[name] = bytes;
            _ = SaveFiles(project);
        }
        catch (JsonException)
        {
        }
    }
}
