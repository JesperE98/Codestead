using System.Diagnostics;
using System.Text.Json;
using Avalonia.Controls;
using Avalonia.Platform.Storage;
using Codestead.GP.Course;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu;

namespace Codestead.GP;

// The panel's buttons: choose the folder (or use the suggested one), copy the start files into it, open it in the
// file manager, and "I ran it".
public sealed partial class GpTool
{
    private async Task ChooseFolder()
    {
        if (TopLevel.GetTopLevel(Window)?.StorageProvider is not { CanPickFolder: true } storage) return;
        IStorageFolder? start = null;
        var near = folder ?? Folders.Suggestion(watchedApi, chapter);
        while (near is not null && !Directory.Exists(near)) near = Path.GetDirectoryName(near);
        if (near is not null) start = await storage.TryGetFolderFromPathAsync(near);
        var picked = await storage.OpenFolderPickerAsync(new FolderPickerOpenOptions
        {
            Title = Window.T("yourProject.chooseTitle", ("chapter", ChapterTitle(chapter, Window.Lang)), ("api", Apis.Get(watchedApi).Name)),
            AllowMultiple = false,
            SuggestedStartLocation = start,
        });
        if (picked.Count == 0 || picked[0].TryGetLocalPath() is not { } path) return;
        SetFolder(path);
    }

    private void UseSuggestion()
    {
        if (Folders.Suggestion(watchedApi, chapter) is not { } path) return;
        try
        {
            Directory.CreateDirectory(path);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            Window.Toast(Window.T("yourProject.copyFailed", ("message", e.Message)));
            return;
        }
        SetFolder(path);
    }

    /// <summary>The chapter's folder (also used by the smoke test).</summary>
    internal void SetFolder(string path)
    {
        Folders.Set(watchedApi, chapter, path);
        Watch(Folders.Get(watchedApi, chapter));
    }

    /// <summary>Copies files into the folder, asking first when that would overwrite files with other contents.</summary>
    private void CopyStartFiles(GpuProject files)
    {
        if (folder is not { } target || !Directory.Exists(target)) return;
        var conflicts = StartFiles.Conflicts(target, files);
        if (conflicts.Count == 0)
        {
            Copy(target, files);
            return;
        }
        var list = string.Join(", ", conflicts.Take(6)) + (conflicts.Count > 6 ? ", …" : "");
        Window.Overlay.Confirm(Window.T("yourProject.copyConfirmTitle"), Window.T("yourProject.copyConfirm", ("count", conflicts.Count), ("files", list)),
            Window.T("yourProject.overwrite"), Window.T("dialog.cancel"), true, () => Copy(target, files));
    }

    private void Copy(string target, GpuProject files)
    {
        try
        {
            int n = StartFiles.Copy(target, files);
            Window.Toast(Window.T("yourProject.copied", ("count", n)));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            Window.Toast(Window.T("yourProject.copyFailed", ("message", e.Message)));
        }
        watcher?.Refresh();
    }

    // ---------- Code from the old built-in editor ----------

    /// <summary>Where the app's old built-in editor saved the chapter's code (project.&lt;api&gt;.&lt;chapter&gt;.json).</summary>
    private string OldCodeKey => $"project.{watchedApi}.{chapter}";

    private bool HasOldCode() => chapter != "" && File.Exists(Path.Combine(Window.Storage.Directory, OldCodeKey + ".json"));

    private void CopyOldCode()
    {
        try
        {
            var json = Window.Storage.LoadText(OldCodeKey);
            var files = json is null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            if (files is not { Count: > 0 }) return;
            var project = new GpuProject(files);
            foreach (var (name, bytes) in GpCourse.StartProject(chapter, watchedApi).Assets) project.Assets[name] = bytes;
            CopyStartFiles(project);
        }
        catch (JsonException)
        {
        }
    }

    // ---------- Open folder, "I ran it" ----------

    private async Task OpenFolder()
    {
        if (folder is not { } path || !Directory.Exists(path)) return;
        try
        {
            if (TopLevel.GetTopLevel(Window)?.Launcher is { } launcher && await launcher.LaunchDirectoryInfoAsync(new DirectoryInfo(path))) return;
            var opener = OperatingSystem.IsWindows() ? "explorer.exe" : OperatingSystem.IsMacOS() ? "open" : "xdg-open";
            using var _ = Process.Start(new ProcessStartInfo(opener) { ArgumentList = { path }, UseShellExecute = false });
        }
        catch (Exception e) when (e is System.ComponentModel.Win32Exception or IOException or InvalidOperationException or UnauthorizedAccessException)
        {
            Window.Toast(Window.T("yourProject.openFailed"));
        }
    }

    /// <summary>
    /// "I ran it": for setups the app cannot see. The program must still be newer than the code – unless no program
    /// can be found in the folder at all (then the app says it takes the learner's word for it).
    /// </summary>
    private void RanByHand()
    {
        if (watcher is null) return;
        var s = watcher.Status;
        if (!s.NoExecutable && !s.Built)
        {
            Window.Toast(Window.T("yourProject.ranNeedsBuild"));
            return;
        }
        if (s.NoExecutable) Window.Toast(Window.T("yourProject.ranNoExecutable"));
        watcher.MarkRan();
    }
}
