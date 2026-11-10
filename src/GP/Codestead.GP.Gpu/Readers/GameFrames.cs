using System.Text.RegularExpressions;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// A game (learnopengl's 2D game) in Vulkan and Direct3D 12: its state moves on from frame to frame by deltaTime, so
/// the picture at time t is frame t × 60 after the frames before it ran. Deterministic like verify.sh's fixedtime.c:
/// frame n reads the clock n / 60; the space bar is pressed in frame 30 and released in frame 33. The frames before the
/// shown one run without drawing; the caller then records the shown frame as for any program.
/// </summary>
internal static class GameFrames
{
    public static int LastFrame(double time) => (int)Math.Round(time * 60.0);

    /// <summary>
    /// GLFW (Vulkan): the render loop's statements (`while (!glfwWindowShouldClose(window)) { … }`) for frames 0 … t × 60,
    /// without the function that draws (drawFrame); the key callback gets the space bar in frame 30's and 33's
    /// glfwPollEvents(). False: not a game (no key callback) or no such loop.
    /// </summary>
    public static bool RunGlfw(CppSource src, FrameRecorder recorder, double time, IEnumerable<string> drawing)
    {
        var callback = Regex.Match(src.Code, @"glfwSetKeyCallback\s*\(\s*[\w.>-]+\s*,\s*&?\s*(?:\w+::)?(\w+)\s*\)");
        if (!callback.Success || !src.Functions.ContainsKey(callback.Groups[1].Value)) return false;
        var loop = Regex.Match(src.Code, @"while\s*\(\s*!\s*glfwWindowShouldClose\s*\(\s*[\w.>-]+\s*\)\s*\)\s*\{");
        if (!loop.Success || src.FunctionAt(loop.Index) is not { } fn || !src.Functions.TryGetValue(fn, out var range)) return false;
        int open = loop.Index + loop.Length - 1, close = CppSource.MatchBracket(src.Code, open);
        if (close < 0) return false;
        // What the function does before its loop (float deltaTime = 0.0f; float lastFrame = 0.0f;), then the frames.
        recorder.RunCode(src.Code[range.Start..loop.Index]);
        var body = src.Code[(open + 1)..close];
        var key = callback.Groups[1].Value;
        int frame = 0;
        recorder.OnPollEvents = () =>
        {
            if (frame == GlReader.SpacePressFrame) recorder.RunCode($"{key}(window, GLFW_KEY_SPACE, 0, GLFW_PRESS, 0);");
            else if (frame == GlReader.SpaceReleaseFrame) recorder.RunCode($"{key}(window, GLFW_KEY_SPACE, 0, GLFW_RELEASE, 0);");
        };
        var skipped = drawing.Where(d => recorder.Skip.Add(d)).ToList();
        try
        {
            int last = LastFrame(time);
            for (frame = 0; frame <= last; frame++)
            {
                recorder.Runner.Time = frame / 60.0;
                recorder.RunCode(body);
            }
            recorder.Runner.Time = last / 60.0;
        }
        finally
        {
            recorder.OnPollEvents = null;
            foreach (var d in skipped) recorder.Skip.Remove(d);
        }
        return true;
    }

    /// <summary>
    /// The D3D12 samples' framework (OnKeyDown / OnUpdate / OnRender): OnUpdate for frames 0 … t × 60 − 1 with the space
    /// bar delivered before frame 30's and 33's OnUpdate; the caller runs the shown frame (OnUpdate, then the commands).
    /// False: not a game (no OnKeyDown, OnUpdate or deltaTime).
    /// </summary>
    public static bool RunWin32(CppSource src, FrameRecorder recorder, double time)
    {
        if (!src.Functions.ContainsKey("OnKeyDown") || !src.Functions.ContainsKey("OnUpdate") || !src.Uses("deltaTime")) return false;
        int last = LastFrame(time);
        for (int frame = 0; frame <= last; frame++)
        {
            recorder.Runner.Time = frame / 60.0;
            if (frame == GlReader.SpacePressFrame) recorder.RunCode("OnKeyDown(VK_SPACE);");
            else if (frame == GlReader.SpaceReleaseFrame && src.Functions.ContainsKey("OnKeyUp")) recorder.RunCode("OnKeyUp(VK_SPACE);");
            if (frame < last) recorder.Run("OnUpdate");
        }
        return true;
    }
}
