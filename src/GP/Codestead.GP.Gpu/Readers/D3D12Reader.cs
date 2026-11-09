using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Reads a DirectX 12 program written like Microsoft's D3D12HelloWorld samples (LoadPipeline, LoadAssets,
/// PopulateCommandList, OnRender, WaitForPreviousFrame): the Win32 window and message loop, the device, queue, swap
/// chain and render target views, the clear colour, the pipeline state and the draw call. Missing pieces become
/// the messages the debug layer (or a crash) would give.
/// </summary>
public sealed partial class D3D12Reader
{
    private readonly GpuProject project;
    private readonly CppSource src;
    private readonly Scene.Scene scene = new() { Api = Apis.D3D12 };

    private readonly double time;

    private D3D12Reader(GpuProject project, double time)
    {
        this.time = time;
        this.project = project;
        var main = project.MainFile;
        src = new CppSource(main, project.Files.TryGetValue(main, out var t) ? t : "");
    }

    public static Scene.Scene Read(GpuProject project, double time = 1.0) => new D3D12Reader(project, time).Run();

    private bool Has(string call) => src.HasCall(call) || src.HasCall("." + call);

    private Scene.Scene Run()
    {
        if (!Regex.IsMatch(src.Code, @"\b(?:wWinMain|WinMain|main)\s*\("))
        {
            scene.Notes.Add(SimNote.Error("noMain"));
            return scene;
        }
        Window();
        if (!scene.WindowCreated) return scene;
        if (Has("EnableDebugLayer")) scene.Log.Add("D3D12: debug layer enabled");
        if (!Has("D3D12CreateDevice")) return Done("dxNoDevice");
        scene.Log.Add("D3D12CreateDevice: S_OK (Codestead Virtual GPU, simulated)");
        if (!Has("CreateCommandQueue")) return Done("dxNoQueue");
        if (!Has("CreateSwapChainForHwnd") && !Has("CreateSwapChain")) return Done("dxNoSwapChain");
        if (!Has("CreateDescriptorHeap") || !Has("CreateRenderTargetView")) return Done("dxNoRtv");
        if (!Has("CreateCommandAllocator") || !Has("CreateCommandList")) return Done("dxNoCommandList");
        if (!Has("ExecuteCommandLists")) return Done("dxNoExecute");
        if (!Has("Present")) return Done("dxNoPresent");
        scene.Presents = scene.RenderLoop;
        if (!Has("CreateFence") || !Has("Signal")) scene.Notes.Add(SimNote.Warning("dxNoFence"));
        if (src.Calls(".ResourceBarrier").Count < 2) scene.Notes.Add(SimNote.Error("dxNoBarriers"));
        var close = src.Calls(".Close");
        if (close.Count == 0) scene.Notes.Add(SimNote.Error("dxListNotClosed"));
        Clear();
        Draw();
        return scene;
    }

    private Scene.Scene Done(string note)
    {
        scene.Notes.Add(SimNote.Info(note));
        return scene;
    }

    private void Window()
    {
        var create = src.Calls("CreateWindowExW").Concat(src.Calls("CreateWindowEx")).Select(c => (c, title: 2))
            .Concat(src.Calls("CreateWindowW").Concat(src.Calls("CreateWindow")).Select(c => (c, title: 1))).FirstOrDefault();
        if (create.c is null || !(src.HasCall("RegisterClassExW") || src.HasCall("RegisterClassEx") || src.HasCall("RegisterClassW") || src.HasCall("RegisterClass")))
        {
            scene.Notes.Add(SimNote.Info("noWindow"));
            return;
        }
        scene.WindowCreated = true;
        scene.WindowTitle = CppSource.StringArg(create.c.Arg(create.title)) ?? "";
        // The client area: the swap chain's size, else the window's.
        int? w = src.LastFieldValue("Width") is { } wv ? src.Int(wv) : null;
        int? h = src.LastFieldValue("Height") is { } hv ? src.Int(hv) : null;
        scene.Width = w ?? 800;
        scene.Height = h ?? 600;
        if (!src.HasCall("ShowWindow")) scene.Notes.Add(SimNote.Warning("dxNoShowWindow"));
        scene.RenderLoop = Regex.IsMatch(src.Code, @"WM_QUIT") || src.HasCall("GetMessageW") || src.HasCall("GetMessage");
        if (!scene.RenderLoop) scene.Notes.Add(SimNote.Warning("noLoop"));
    }

    private void Clear()
    {
        var clear = src.Calls(".ClearRenderTargetView").FirstOrDefault();
        if (clear is null) return;
        if (src.Numbers(clear.Arg(1)) is { Count: >= 4 } c) scene.ClearColor = [c[0], c[1], c[2], c[3]];
        if (!Has("OMSetRenderTargets") && src.Calls(".DrawInstanced").Concat(src.Calls(".DrawIndexedInstanced")).Any())
            scene.Notes.Add(SimNote.Error("dxNoRenderTarget"));
    }
}
