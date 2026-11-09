namespace Codestead.GP.Gpu.Models;

/// <summary>A material of an MTL file: its colours and texture files.</summary>
public sealed class ObjMaterial
{
    public string Name { get; init; } = "";
    public double[] Diffuse { get; set; } = [1, 1, 1];
    public double[] Specular { get; set; } = [0, 0, 0];
    public double Shininess { get; set; } = 32;
    public string? DiffuseMap { get; set; }
    public string? SpecularMap { get; set; }
    public string? NormalMap { get; set; }
}
