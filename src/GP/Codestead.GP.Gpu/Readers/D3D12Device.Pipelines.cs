using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

// Pipeline state objects as the program makes them: the shaders each one was compiled from (D3DCompileFromFile's file
// and entry point) and its description – for programs whose PSOs the reader cannot follow by name (a std::map of
// shaders, a Compile helper with a blend parameter). The CD3DX12 description helpers give their D3D12_DEFAULT values,
// so the fields the program changes afterwards are there too.
internal sealed partial class D3D12Device
{
    private readonly List<(string File, string Entry, string Target)> blobs = new();
    private string? boundPso;

    /// <summary>Every PSO made: its handle → its description (D3D12_GRAPHICS_PIPELINE_STATE_DESC, the blobs as "blob#k").</summary>
    public Dictionary<string, ShaderValue> CreatedPsos { get; } = new(StringComparer.Ordinal);

    /// <summary>A compiled shader blob's file, entry point and target ("blob#k").</summary>
    public (string File, string Entry, string Target)? Blob(string? handle) =>
        handle is not null && handle.StartsWith("blob#", StringComparison.Ordinal) && int.TryParse(handle[5..], out var k) && k >= 1 && k <= blobs.Count ? blobs[k - 1] : null;

    private ShaderValue? PipelineCall(string name, IReadOnlyList<Expr> args)
    {
        switch (name)
        {
            case "D3DCompileFromFile" when args.Count >= 8:
            {
                var file = Eval(args[0])?.Text;
                if (file is null) return null;
                blobs.Add((file, Eval(args[3])?.Text ?? "main", Eval(args[4])?.Text ?? ""));
                if (OutTarget(args[7]) is { } blob) Set(blob, ShaderValue.Str("blob#" + blobs.Count));
                return ShaderValue.Str("S_OK");
            }
            case "CD3DX12_SHADER_BYTECODE" when args.Count >= 1:
                // The bytecode of a blob: the blob itself (vertexShader.Get()); CD3DX12_SHADER_BYTECODE(nullptr, 0): none.
                return args[0] is Name { Id: "nullptr" or "NULL" } ? ShaderValue.Str("") : Eval(Strip(args[0])) ?? ShaderValue.Str("");
            case "CD3DX12_BLEND_DESC" when args.Count == 1:
            {
                ShaderValue Target() => Desc(("BlendEnable", ShaderValue.Str("FALSE")), ("LogicOpEnable", ShaderValue.Str("FALSE")),
                    ("SrcBlend", ShaderValue.Str("D3D12_BLEND_ONE")), ("DestBlend", ShaderValue.Str("D3D12_BLEND_ZERO")), ("BlendOp", ShaderValue.Str("D3D12_BLEND_OP_ADD")),
                    ("SrcBlendAlpha", ShaderValue.Str("D3D12_BLEND_ONE")), ("DestBlendAlpha", ShaderValue.Str("D3D12_BLEND_ZERO")), ("BlendOpAlpha", ShaderValue.Str("D3D12_BLEND_OP_ADD")),
                    ("LogicOp", ShaderValue.Str("D3D12_LOGIC_OP_NOOP")), ("RenderTargetWriteMask", ShaderValue.Str("D3D12_COLOR_WRITE_ENABLE_ALL")));
                return Desc(("AlphaToCoverageEnable", ShaderValue.Str("FALSE")), ("IndependentBlendEnable", ShaderValue.Str("FALSE")),
                    ("RenderTarget", ShaderValue.Array(Enumerable.Range(0, 8).Select(_ => Target()).ToArray())));
            }
            case "CD3DX12_RASTERIZER_DESC" when args.Count == 1:
                return Desc(("FillMode", ShaderValue.Str("D3D12_FILL_MODE_SOLID")), ("CullMode", ShaderValue.Str("D3D12_CULL_MODE_BACK")),
                    ("FrontCounterClockwise", ShaderValue.Str("FALSE")), ("DepthClipEnable", ShaderValue.Str("TRUE")));
            case "CD3DX12_DEPTH_STENCIL_DESC" when args.Count == 1:
                return Desc(("DepthEnable", ShaderValue.Str("TRUE")), ("DepthWriteMask", ShaderValue.Str("D3D12_DEPTH_WRITE_MASK_ALL")),
                    ("DepthFunc", ShaderValue.Str("D3D12_COMPARISON_FUNC_LESS")), ("StencilEnable", ShaderValue.Str("FALSE")));
            case ".CreateGraphicsPipelineState" when args.Count >= 3:
            {
                if (Eval(Strip(args[1])) is not { Fields: not null } desc || OutTarget(args[2]) is not { } target) return null;
                var handle = "pso#" + (CreatedPsos.Count + 1);
                CreatedPsos[handle] = desc.Clone();
                Set(target, ShaderValue.Str(handle));
                return ShaderValue.Str("S_OK");
            }
            case ".SetPipelineState" when args.Count >= 2:
                boundPso = Eval(Strip(args[1]))?.Text;
                return null;   // the frame recorder records it too
            case ".Reset" when args.Count >= 3:
                boundPso = Eval(Strip(args[2]))?.Text;
                return null;
        }
        return null;
    }
}
