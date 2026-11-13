namespace Codestead.GP.Course.Ide;

/// <summary>
/// The folders in the learner's project that the reader does not take the course's files from: the build's and the
/// IDEs' own folders, and the libraries kept inside the project.
/// </summary>
public static class ProjectFiles
{
    /// <summary>
    /// Folders of the build and the IDEs: no sources are read from them (CMake copies shaders there, Visual Studio
    /// keeps its own files).
    /// </summary>
    public static bool IsBuildDir(string name) =>
        name.StartsWith("build", StringComparison.OrdinalIgnoreCase)
        || name.StartsWith("cmake-build-", StringComparison.OrdinalIgnoreCase)
        || BuildDirs.Contains(name);

    private static readonly HashSet<string> BuildDirs = new(StringComparer.OrdinalIgnoreCase)
    {
        "out", ".vs", ".idea", ".vscode", "x64", "x86", "Debug", "Release", "RelWithDebInfo", "MinSizeRel", "bin", "obj", ".git",
        "ARM64", ".cache", "DerivedData",
    };

    /// <summary>
    /// Folders not looked into at all: version control, the IDEs' own files, CMake's internals (its compiler checks
    /// build small test programs there) and dependencies fetched and built with the project.
    /// </summary>
    public static bool IsSkippedDir(string name) => SkippedDirs.Contains(name);

    private static readonly HashSet<string> SkippedDirs = new(StringComparer.OrdinalIgnoreCase)
    {
        ".git", ".svn", ".hg", ".vs", ".idea", ".vscode", ".cache", "CMakeFiles", "_deps", "node_modules", "vcpkg_installed",
        "vcpkg", "Testing", "__pycache__",
    };

    /// <summary>
    /// Folders of libraries the learner may keep inside the project (GLAD, GLM, stb, …): their files are not the
    /// learner's code, so they are never taken for the program's main file.
    /// </summary>
    public static bool IsLibraryDir(string name) => LibraryDirs.Contains(name);

    private static readonly HashSet<string> LibraryDirs = new(StringComparer.OrdinalIgnoreCase)
    {
        "glad", "KHR", "glm", "GLFW", "stb", "imgui", "include", "includes", "external", "extern", "third_party", "thirdparty",
        "3rdparty", "vendor", "deps", "dependencies", "lib", "libs", "assimp", "freetype", "irrKlang",
    };
}
