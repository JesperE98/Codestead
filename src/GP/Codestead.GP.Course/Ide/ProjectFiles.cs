namespace Codestead.GP.Course.Ide;

/// <summary>
/// What the learner's project folder holds, as the app sees it: which files are sources (compiled into the program,
/// or read by it when it runs), which folders are the IDE's or the build's, and which files are executables.
/// </summary>
public static class ProjectFiles
{
    /// <summary>Compiled into the program: a change needs a new build.</summary>
    public static readonly IReadOnlySet<string> Compiled = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ".cpp", ".cc", ".cxx", ".c", ".h", ".hh", ".hpp", ".hxx", ".inl",
    };

    /// <summary>Read by the program when it runs (shaders, levels): a change needs a new run, not a new build.</summary>
    public static readonly IReadOnlySet<string> Runtime = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ".vert", ".frag", ".geom", ".tesc", ".tese", ".tcs", ".tes", ".comp", ".glsl", ".hlsl", ".hlsli", ".fx",
        ".vs", ".fs", ".gs", ".lvl",
    };

    /// <summary>The binary files the course's projects use (images, models, fonts): read when the program runs.</summary>
    public static bool IsAsset(string path) => GpCourse.IsAsset(path);

    /// <summary>A file whose change the app watches for (code, shaders, the course's asset types).</summary>
    public static bool IsSource(string path)
    {
        var ext = Path.GetExtension(path);
        return Compiled.Contains(ext) || Runtime.Contains(ext) || IsAsset(path);
    }

    public static bool IsCompiled(string path) => Compiled.Contains(Path.GetExtension(path));

    /// <summary>
    /// Folders of the build and the IDEs: no sources are read from them (CMake copies shaders there, Visual Studio
    /// keeps its own files), but the executable is looked for in them.
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

    /// <summary>
    /// Is the file a program (not a library or an object file)? Windows: a PE file named .exe. Linux and the BSDs: an
    /// ELF executable (or position-independent executable) with an execute bit, not a shared library. macOS: a Mach-O
    /// executable. The file's first bytes are read.
    /// </summary>
    public static bool IsExecutable(string path)
    {
        try
        {
            var name = Path.GetFileName(path);
            bool exe = name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase);
            // On Windows only .exe files run (an ELF file built in WSL is not seen: "I ran it" covers that).
            if (!exe && OperatingSystem.IsWindows()) return false;
            if (!exe && (name.Contains(".so", StringComparison.Ordinal) || name.EndsWith(".dylib", StringComparison.Ordinal) || name.EndsWith(".o", StringComparison.Ordinal)
                || name.EndsWith(".a", StringComparison.Ordinal) || name.EndsWith(".dll", StringComparison.OrdinalIgnoreCase))) return false;
            if (!exe && !OperatingSystem.IsWindows() && (File.GetUnixFileMode(path) & (UnixFileMode.UserExecute | UnixFileMode.GroupExecute | UnixFileMode.OtherExecute)) == 0) return false;
            Span<byte> head = stackalloc byte[20];
            int n;
            using (var s = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 1, FileOptions.None))
                n = s.ReadAtLeast(head, head.Length, throwOnEndOfStream: false);
            return Kind(head[..n], exe);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or NotSupportedException or ArgumentException)
        {
            return false;
        }
    }

    /// <summary>The format test on a file's first bytes (separate for the tests).</summary>
    public static bool Kind(ReadOnlySpan<byte> head, bool namedExe)
    {
        if (head.Length >= 2 && head[0] == 'M' && head[1] == 'Z') return namedExe;
        if (head.Length >= 18 && head[0] == 0x7F && head[1] == 'E' && head[2] == 'L' && head[3] == 'F')
        {
            // e_type (little or big endian by EI_DATA): 2 = executable, 3 = shared object (also every PIE executable).
            int type = head[5] == 2 ? head[16] << 8 | head[17] : head[16] | head[17] << 8;
            return type is 2 or 3;
        }
        if (head.Length >= 16)
        {
            uint magic = BitConverter.ToUInt32(head[..4]);
            // MH_MAGIC_64 / MH_MAGIC, little endian (every Mac since Intel); filetype 2 = MH_EXECUTE.
            if (magic is 0xFEEDFACF or 0xFEEDFACE) return BitConverter.ToUInt32(head.Slice(12, 4)) == 2;
            // A universal (fat) binary: an executable for several architectures.
            if (magic is 0xBEBAFECA) return true;
        }
        return false;
    }
}
