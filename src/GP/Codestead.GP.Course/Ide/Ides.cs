namespace Codestead.GP.Course.Ide;

/// <summary>
/// The IDEs the course's texts have steps for. Visual Studio and Rider follow the Visual Studio solution route
/// (.sln/.vcxproj), CLion and VS Code (with CMake Tools) the CMake route. The choice only changes which ":::ide"
/// blocks of the texts are shown and where the panel says the program will appear; detection does not depend on it.
/// </summary>
public static class Ides
{
    public const string VisualStudio = "vs";
    public const string CLion = "clion";
    public const string Rider = "rider";
    public const string VSCode = "vscode";

    public static IReadOnlyList<IdeInfo> All { get; } = new List<IdeInfo>
    {
        new(VisualStudio, "Visual Studio", false),
        new(CLion, "CLion", true),
        new(Rider, "Rider", false),
        new(VSCode, "VS Code", true),
    };

    /// <summary>Visual Studio on Windows, CLion elsewhere.</summary>
    public static string Default => OperatingSystem.IsWindows() ? VisualStudio : CLion;

    public static bool IsKnown(string? id) => All.Any(i => i.Id == id);

    public static IdeInfo Get(string? id) => All.FirstOrDefault(i => i.Id == id) ?? All.First(i => i.Id == Default);
}
