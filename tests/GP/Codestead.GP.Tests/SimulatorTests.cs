using Codestead.GP.Course;
using Codestead.GP.Gpu;

namespace Codestead.GP.Tests;

/// <summary>The simulated GPU tells the learner about the usual mistakes, the way a compiler, a driver or a validation layer would.</summary>
public class SimulatorTests
{
    private static GpuProject Finished(string api, string chapter)
    {
        var p = GpCourse.StartProject(chapter, api);
        foreach (var e in GpCourse.Tasks(chapter, api).SelectMany(t => t.Edits)) Edits.Apply(p, e);
        return p;
    }

    private static GpuProject With(GpuProject p, string file, string from, string to)
    {
        var copy = p.Clone();
        Assert.Contains(from, copy.Files[file]);
        copy.Files[file] = copy.Files[file].Replace(from, to);
        return copy;
    }

    [Theory(DisplayName = "ett felstavat API-namn ger \"did you mean\"")]
    [InlineData("opengl", "glClearColor(", "glClearColour(", "glClearColor")]
    [InlineData("vulkan", "vkCmdDraw(", "vkCmdDraww(", "vkCmdDraw")]
    [InlineData("d3d12", "->DrawInstanced(", "->DrawInstance(", "DrawInstanced")]
    public void Typo(string api, string from, string to, string suggestion)
    {
        var r = Simulator.Build(With(Finished(api, "introduction"), "main.cpp", from, to), api);
        Assert.False(r.Succeeded);
        Assert.Contains(r.Diagnostics, d => d.Message.Contains($"did you mean '{suggestion}'"));
    }

    [Fact(DisplayName = "en saknad klammer stoppar bygget")]
    public void MissingBrace()
    {
        var p = Finished("opengl", "introduction");
        var r = Simulator.Build(With(p, "main.cpp", "glfwPollEvents();\n    }", "glfwPollEvents();\n"), "opengl");
        Assert.False(r.Succeeded);
    }

    [Fact(DisplayName = "OpenGL: ett avstängt attribut ritar inget och säger varför")]
    public void DisabledAttribute()
    {
        var r = Simulator.Build(With(Finished("opengl", "introduction"), "main.cpp", "glEnableVertexAttribArray(0);", ""), "opengl");
        Assert.Contains(r.Scene!.Notes, n => n.Key == "attribDisabled");
    }

    [Fact(DisplayName = "OpenGL: utan glClear säger simulatorn till")]
    public void NoClear()
    {
        var r = Simulator.Build(With(Finished("opengl", "hello-window"), "main.cpp", "glClear(GL_COLOR_BUFFER_BIT);", ""), "opengl");
        Assert.Null(r.Scene!.ClearColor);
        Assert.Contains(r.Scene.Notes, n => n.Key == "noClear");
    }

    [Fact(DisplayName = "Vulkan: utan vkCmdSetViewport ritas inget (dynamiskt tillstånd)")]
    public void VulkanDynamicViewport()
    {
        var p = Finished("vulkan", "introduction");
        var text = p.Files["main.cpp"];
        var at = text.IndexOf("vkCmdSetViewport(", StringComparison.Ordinal);
        var end = text.IndexOf(';', at);
        var r = Simulator.Build(With(p, "main.cpp", text[at..(end + 1)], ""), "vulkan");
        Assert.Contains(r.Scene!.Notes, n => n.Key == "vkDynamicStateNotSet");
        Assert.Empty(r.Scene.Draws);
    }

    [Fact(DisplayName = "DirectX 12: utan barriärer klagar debuglagret")]
    public void D3D12Barriers()
    {
        var p = Finished("d3d12", "introduction");
        var copy = p.Clone();
        copy.Files["main.cpp"] = System.Text.RegularExpressions.Regex.Replace(copy.Files["main.cpp"], @"m_commandList->ResourceBarrier\([^;]*;", "");
        var r = Simulator.Build(copy, "d3d12");
        Assert.Contains(r.Scene!.Notes, n => n.Key == "dxNoBarriers");
    }
}
