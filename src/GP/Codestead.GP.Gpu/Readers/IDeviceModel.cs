using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

/// <summary>A model of an explicit API's device (<see cref="D3D12Device"/>, <see cref="VulkanDevice"/>) that the frame recorder feeds.</summary>
internal interface IDeviceModel
{
    void Attach(CppExec exec);
    ShaderValue? Hook(string name, IReadOnlyList<Expr> args);
    /// <summary>The state set on the command list now (copied into each recorded draw).</summary>
    object Snapshot();
    List<FrameOp> Ops { get; }
    /// <summary>A recorded draw's state says it goes to an off-screen target (not to the window).</summary>
    bool Offscreen(object? state);
    Func<int> DrawCount { get; set; }
}
