using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// Several pipeline state objects (the lit object and the lamp): each CreateGraphicsPipelineState(…, &name) takes the
// vertex and pixel shaders compiled last before it and the rasterizer / depth fields set before it.
public sealed partial class D3D12Reader
{
    /// <summary>
    /// A depth/stencil or blend field set before an offset – unless the whole state was reset to its defaults after it
    /// (psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT), psoDesc.BlendState = CD3DX12_BLEND_DESC(…)).
    /// </summary>
    private string? StateField(string field, int before)
    {
        var assign = src.FieldAssignments(field).Where(a => a.Offset < before).LastOrDefault();
        if (assign.Value is null) return null;
        var group = field is "BlendEnable" or "SrcBlend" or "DestBlend" or "BlendOp" or "SrcBlendAlpha" or "DestBlendAlpha" or "BlendOpAlpha" or "RenderTargetWriteMask"
            ? "BlendState" : "DepthStencilState";
        var reset = src.FieldAssignments(group).Where(a => a.Offset < before).LastOrDefault();
        return reset.Value is not null && reset.Offset > assign.Offset ? null : assign.Value;
    }

    /// <summary>Does the pipeline state description created at an offset have a geometry shader (its GS field set to bytecode)?</summary>
    private bool UsesGeometry(int before) =>
        src.FieldValueBefore("GS", before) is { } gsField && !Regex.IsMatch(gsField, @"^\{\s*\}$|^D3D12_SHADER_BYTECODE\s*\{\s*\}$|nullptr");

    private Dictionary<string, PipelineInfo> Pipelines()
    {
        var result = new Dictionary<string, PipelineInfo>(StringComparer.Ordinal);
        var compiles = src.Calls("D3DCompileFromFile");
        foreach (var create in src.Calls(".CreateGraphicsPipelineState"))
        {
            var name = Regex.Match(create.Arg(1), @"&\s*(\w+)") is { Success: true } m ? m.Groups[1].Value : null;
            if (name is null) continue;
            (ShaderProgram Program, string Entry)? Stage(string prefix)
            {
                var c = compiles.LastOrDefault(x => x.Offset < create.Offset && (CppSource.StringArg(x.Arg(4)) ?? "").StartsWith(prefix, StringComparison.Ordinal));
                if (c is null) return null;
                var text = project.Find(CppSource.StringArg(c.Arg(0)) ?? "");
                if (text is null) return null;
                try
                {
                    return (ShaderParser.ParseProgram(text), CppSource.StringArg(c.Arg(3)) ?? "main");
                }
                catch (ShaderSyntaxException)
                {
                    return null;
                }
            }
            var vs = Stage("vs_");
            var ps = Stage("ps_");
            // A geometry shader when the description sets one (psoDesc.GS = CD3DX12_SHADER_BYTECODE(geometryShader.Get())).
            var gs = UsesGeometry(create.Offset) ? Stage("gs_") : null;
            if (vs is null || ps is null) continue;
            string Field(string f, string fallback) => src.FieldValueBefore(f, create.Offset) ?? fallback;
            var cull = Field("CullMode", "D3D12_CULL_MODE_BACK");
            result[name] = new PipelineInfo(name, vs.Value.Program, ps.Value.Program, vs.Value.Entry, ps.Value.Entry,
                cull.Contains("NONE", StringComparison.Ordinal) ? CullMode.None : cull.Contains("FRONT", StringComparison.Ordinal) ? CullMode.Front : CullMode.Back,
                (src.Int(Field("FrontCounterClockwise", "FALSE")) ?? 0) != 0,
                Field("FillMode", "SOLID").Contains("WIREFRAME", StringComparison.Ordinal),
                DepthEnabled(create.Offset),
                Topology.Triangles,
                PipelineState.D3D12(f => StateField(f, create.Offset), f => StateField(f, create.Offset) is { } v ? src.Int(v) : null),
                gs?.Program, gs?.Entry ?? "main");
        }
        return result;
    }
}
