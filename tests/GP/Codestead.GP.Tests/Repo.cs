namespace Codestead.GP.Tests;

/// <summary>Paths in the repository (the tests read solution/ folders and texts from disk).</summary>
internal static class Repo
{
    public static string Root { get; } = Find();

    private static string Find()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Codestead.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Codestead.sln not found");
    }

    public static string Content => Path.Combine(Root, "src", "GP", "content");
}
