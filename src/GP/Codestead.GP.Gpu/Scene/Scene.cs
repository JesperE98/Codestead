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
    /// <summary>Off-screen render targets by id (framebuffer objects …); draws name them in <see cref="DrawCall.Target"/>.</summary>
    public Dictionary<string, RenderTarget> Targets { get; } = new(StringComparer.Ordinal);
    /// <summary>Clears and copies between draws, in program order (the window's first clear is <see cref="ClearColor"/>).</summary>
    public List<FrameOp> Ops { get; } = new();
    /// <summary>Samples per pixel of the window (multisample anti-aliasing: glfwWindowHint(GLFW_SAMPLES, 4) …).</summary>
    public int Samples { get; set; } = 1;

    /// <summary>
    /// The window is written through an sRGB format (GL_FRAMEBUFFER_SRGB, an _SRGB swap chain format or render target
    /// view): the shaders' linear colours are encoded with the sRGB curve when stored.
    /// </summary>
    public bool WindowSrgb { get; set; }
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
