using Codestead.GP.Course;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu;

namespace Codestead.GP.Tests;

/// <summary>":::ide" blocks in the texts: alone or inside API blocks, text outside them for every IDE.</summary>
public class IdeBlockTests
{
    private const string Text = """
        Everyone.
        :::ide vs rider
        Solution route.
        :::
        :::opengl
        OpenGL for all.
        :::ide clion vscode
        OpenGL with CMake.
        :::
        OpenGL again.
        :::
        :::vulkan d3d12
        Not OpenGL.
        :::
        The end.
        """;

    [Fact(DisplayName = "IDE-block visas bara för sina IDE:er, även inuti API-block")]
    public void Blocks()
    {
        var clion = CourseText.Preprocess(Text, Apis.OpenGL, Ides.CLion);
        Assert.Contains("Everyone.", clion);
        Assert.DoesNotContain("Solution route.", clion);
        Assert.Contains("OpenGL for all.", clion);
        Assert.Contains("OpenGL with CMake.", clion);
        Assert.Contains("OpenGL again.", clion);
        Assert.DoesNotContain("Not OpenGL.", clion);
        Assert.Contains("The end.", clion);
        Assert.DoesNotContain(":::", clion);

        var vs = CourseText.Preprocess(Text, Apis.OpenGL, Ides.VisualStudio);
        Assert.Contains("Solution route.", vs);
        Assert.DoesNotContain("OpenGL with CMake.", vs);
        Assert.Contains("OpenGL again.", vs);

        var vulkanRider = CourseText.Preprocess(Text, Apis.Vulkan, Ides.Rider);
        Assert.Contains("Solution route.", vulkanRider);
        Assert.DoesNotContain("OpenGL for all.", vulkanRider);
        Assert.Contains("Not OpenGL.", vulkanRider);

        // No IDE: every IDE's steps (the questions are counted this way).
        var all = CourseText.Preprocess(Text, Apis.OpenGL);
        Assert.Contains("Solution route.", all);
        Assert.Contains("OpenGL with CMake.", all);
    }

    [Fact(DisplayName = "ett utelämnat block skiljer styckena runt det åt")]
    public void LeftOutBlockKeepsParagraphsApart()
    {
        var shown = CourseText.Preprocess("Before.\n:::ide vs\nOnly VS.\n:::\nAfter.", Apis.OpenGL, Ides.CLion);
        Assert.Equal("Before.\n\nAfter.", shown);
    }

    [Fact(DisplayName = "standard-IDE: Visual Studio på Windows, annars CLion")]
    public void Default() => Assert.Equal(OperatingSystem.IsWindows() ? "vs" : "clion", Ides.Default);
}
