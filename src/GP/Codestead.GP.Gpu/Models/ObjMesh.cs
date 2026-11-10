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
}
