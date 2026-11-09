using Codestead.GP.Gpu.Build;
using Codestead.Learning.Game;

namespace Codestead.GP.Course.Game;

/// <summary>What one "Build &amp; run" did, for the statistics and achievements. <see cref="CommandFacts.Names"/> are the API functions the project calls.</summary>
public sealed class BuildFacts : CommandFacts
{
    public string Api { get; init; } = "";
    public bool Succeeded { get; init; }
    /// <summary>The window stayed open and showed frames.</summary>
    public bool ShowsFrames { get; init; }
    /// <summary>Something was drawn in the frame.</summary>
    public bool Drew { get; init; }
    /// <summary>The build stopped at a misspelt API name ("did you mean …?").</summary>
    public bool Typo { get; init; }
    public double[]? ClearColor { get; init; }

    public static BuildFacts From(CheckContext c)
    {
        var facts = new BuildFacts
        {
            Line = "build",
            Output = string.Join("\n", c.Build.Diagnostics),
            ExitCode = c.Built ? 0 : 1,
            Api = c.Api,
            Succeeded = c.Built,
            ShowsFrames = c.Shows,
            Drew = c.Shows && c.Drew,
            Typo = c.Build.Diagnostics.Any(d => d.Message.Contains("did you mean", StringComparison.Ordinal)),
            ClearColor = c.Shows ? c.Scene!.ClearColor : null,
        };
        foreach (System.Text.RegularExpressions.Match m in System.Text.RegularExpressions.Regex.Matches(c.Cpp, @"\b(gl[A-Z]\w*|glfw[A-Z]\w*|vk[A-Z]\w*|D3D12[A-Z]\w*|CreateDXGIFactory\d?)\s*\("))
            if (!facts.Names.Contains(m.Groups[1].Value)) facts.Names.Add(m.Groups[1].Value);
        facts.FirstWords.Add("build");
        return facts;
    }
}
