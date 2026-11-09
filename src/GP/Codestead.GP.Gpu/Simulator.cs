using Codestead.GP.Gpu.Build;
using Codestead.GP.Gpu.Readers;

namespace Codestead.GP.Gpu;

/// <summary>"Build &amp; run" for a project: the compile step, then (when it compiled) what the program does.</summary>
public static class Simulator
{
    public static BuildResult Build(GpuProject project, string api)
    {
        var commands = Commands(project, api);
        var diagnostics = BuildChecker.Check(project, api);
        if (diagnostics.Any(d => d.IsError)) return new BuildResult(api, commands, diagnostics, null);
        var scene = Read(project, api, 1.0);
        var copy = project.Clone();
        scene.AtTime = t => Read(copy, api, t);
        return new BuildResult(api, commands, diagnostics, scene);
    }

    /// <summary>What the program does when its clock reads <paramref name="time"/> seconds.</summary>
    public static Scene.Scene Read(GpuProject project, string api, double time) => api switch
    {
        Apis.Vulkan => VulkanReader.Read(project, time),
        Apis.D3D12 => D3D12Reader.Read(project, time),
        _ => GlReader.Read(project, time),
    };

    /// <summary>The commands a real build would run (shown in the output, as in a terminal).</summary>
    private static List<string> Commands(GpuProject project, string api)
    {
        var list = new List<string>();
        switch (api)
        {
            case Apis.Vulkan:
                foreach (var f in project.Files.Keys.Where(k => k.EndsWith(".vert", StringComparison.Ordinal) || k.EndsWith(".frag", StringComparison.Ordinal)))
                {
                    var dir = Path.GetDirectoryName(f)?.Replace('\\', '/') ?? "";
                    var spv = (dir.Length > 0 ? dir + "/" : "") + (f.EndsWith(".vert", StringComparison.Ordinal) ? "vert" : "frag") + ".spv";
                    list.Add($"$ glslc {f} -o {spv}");
                }
                list.Add("$ g++ -std=c++17 main.cpp -o app -lglfw -lvulkan");
                list.Add("$ ./app");
                break;
            case Apis.D3D12:
                list.Add("> cl /std:c++17 /EHsc main.cpp /link d3d12.lib dxgi.lib d3dcompiler.lib user32.lib");
                list.Add("> main.exe");
                break;
            default:
                list.Add("$ g++ -std=c++17 main.cpp glad.c -o app -lglfw -ldl");
                list.Add("$ ./app");
                break;
        }
        return list;
    }
}
