using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

/// <summary>A parsed shader file: its structs, globals (inputs, outputs, uniforms, constants) and functions.</summary>
public sealed class ShaderProgram
{
    public List<Struct> Structs { get; } = new();
    public List<Global> Globals { get; } = new();
    public List<Function> Functions { get; } = new();

    public Function? FindFunction(string id) => Functions.LastOrDefault(f => f.Id == id && f.Body.Count > 0) ?? Functions.LastOrDefault(f => f.Id == id);

    public Struct? FindStruct(string id) => Structs.FirstOrDefault(s => s.Id == id);
}
