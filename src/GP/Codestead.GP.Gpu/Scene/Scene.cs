namespace Codestead.GP.Gpu.Scene;

/// <summary>
/// What the learner's program does when it runs, as far as the simulator can tell: the window, whether it keeps
/// running and showing frames, the clear colour and the draw calls of one frame.
/// </summary>
public sealed class Scene
{
    public required string Api { get; init; }
    public string WindowTitle { get; set; } = "";
    public int Width { get; set; } = 800;
    public int Height { get; set; } = 600;
    public bool WindowCreated { get; set; }
    /// <summary>The program has a render loop, so the window stays open.</summary>
    public bool RenderLoop { get; set; }
    /// <summary>Each frame is shown (glfwSwapBuffers, vkQueuePresentKHR, IDXGISwapChain::Present).</summary>
    public bool Presents { get; set; }
    /// <summary>RGBA; null when the frame is never cleared.</summary>
    public double[]? ClearColor { get; set; }
    public List<DrawCall> Draws { get; } = new();
    public List<SimNote> Notes { get; } = new();
    /// <summary>Lines the program writes while it runs (as a real program would print them).</summary>
    public List<string> Log { get; } = new();
    /// <summary>The frame changes over time (a uniform uses glfwGetTime or a clock), so the preview animates.</summary>
    public bool Animated { get; set; }
    /// <summary>Something the simulator does not understand: the preview may not match a real run.</summary>
    public bool Approximate { get; set; }

    /// <summary>The same program read again at another time (the preview animates with it).</summary>
    public Func<double, Scene>? AtTime { get; set; }

    /// <summary>The frame can be shown: a window that stays open and presents.</summary>
    public bool ShowsFrames => WindowCreated && RenderLoop && Presents;
}
