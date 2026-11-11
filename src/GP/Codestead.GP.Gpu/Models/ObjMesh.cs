namespace Codestead.GP.Gpu.Models;

/// <summary>One mesh of an OBJ model: its material and its vertices (position, normal, texture coordinate) and indices.</summary>
public sealed class ObjMesh
{
    public string Name { get; init; } = "";
    public ObjMaterial? Material { get; init; }
    public List<double[]> Positions { get; } = new();
    public List<double[]> Normals { get; } = new();
    public List<double[]> TexCoords { get; } = new();
    public List<int> Indices { get; } = new();
    /// <summary>A skinned mesh (glTF's JOINTS_0 / WEIGHTS_0): per vertex four bone indices (the skin's joints) and weights.</summary>
    public List<int[]>? Joints { get; set; }
    public List<double[]>? Weights { get; set; }
}
