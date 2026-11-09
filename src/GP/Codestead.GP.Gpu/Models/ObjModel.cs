using System.Globalization;
using System.Text;

namespace Codestead.GP.Gpu.Models;

/// <summary>
/// A Wavefront OBJ model with its MTL materials, read the way Assimp (aiProcess_Triangulate) and tinyobjloader read
/// it: one mesh per object/material, polygons as triangle fans, a vertex per distinct position/uv/normal triple.
/// </summary>
public sealed class ObjModel
{
    public List<ObjMesh> Meshes { get; } = new();
    public Dictionary<string, ObjMaterial> Materials { get; } = new(StringComparer.Ordinal);

    /// <summary>The model at a path of the project (its .mtl and textures next to it), or null.</summary>
    public static ObjModel? Load(GpuProject project, string path)
    {
        var bytes = project.FindAsset(path);
        if (bytes is null) return null;
        var model = new ObjModel();
        var dir = Path.GetDirectoryName(path.Replace('\\', '/'))?.Replace('\\', '/') ?? "";
        var text = Encoding.UTF8.GetString(bytes);
        var positions = new List<double[]>();
        var uvs = new List<double[]>();
        var normals = new List<double[]>();
        ObjMesh? current = null;
        string objectName = "";
        var map = new Dictionary<string, int>();
        ObjMesh Current(string material)
        {
            if (current is null || current.Material?.Name != material || current.Name != objectName)
            {
                current = new ObjMesh { Name = objectName, Material = model.Materials.GetValueOrDefault(material) };
                model.Meshes.Add(current);
                map.Clear();
            }
            return current;
        }
        string material = "";
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line[0] == '#') continue;
            var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            double D(int i) => i < parts.Length ? double.Parse(parts[i], CultureInfo.InvariantCulture) : 0;
            switch (parts[0])
            {
                case "v": positions.Add([D(1), D(2), D(3)]); break;
                case "vt": uvs.Add([D(1), D(2)]); break;
                case "vn": normals.Add([D(1), D(2), D(3)]); break;
                case "o" or "g": objectName = parts.Length > 1 ? parts[1] : ""; current = null; break;
                case "usemtl": material = parts.Length > 1 ? parts[1] : ""; current = null; break;
                case "mtllib" when parts.Length > 1:
                    var mtl = project.FindAsset(dir.Length > 0 ? dir + "/" + parts[1] : parts[1]);
                    if (mtl is not null) ReadMtl(Encoding.UTF8.GetString(mtl), model);
                    break;
                case "f":
                {
                    var mesh = Current(material);
                    var corner = new List<int>();
                    for (int i = 1; i < parts.Length; i++)
                    {
                        if (!map.TryGetValue(parts[i], out var index))
                        {
                            var ids = parts[i].Split('/');
                            int Ix(int k, int count) => k < ids.Length && ids[k].Length > 0 ? (int.Parse(ids[k], CultureInfo.InvariantCulture) is var n && n < 0 ? count + n : n - 1) : -1;
                            int pi = Ix(0, positions.Count), ti = Ix(1, uvs.Count), ni = Ix(2, normals.Count);
                            index = mesh.Positions.Count;
                            mesh.Positions.Add(pi >= 0 && pi < positions.Count ? positions[pi] : [0, 0, 0]);
                            mesh.TexCoords.Add(ti >= 0 && ti < uvs.Count ? uvs[ti] : [0, 0]);
                            mesh.Normals.Add(ni >= 0 && ni < normals.Count ? normals[ni] : [0, 0, 0]);
                            map[parts[i]] = index;
                        }
                        corner.Add(index);
                    }
                    for (int i = 1; i + 1 < corner.Count; i++) mesh.Indices.AddRange([corner[0], corner[i], corner[i + 1]]);
                    break;
                }
            }
        }
        model.Meshes.RemoveAll(m => m.Indices.Count == 0);
        return model;
    }

    private static void ReadMtl(string text, ObjModel model)
    {
        ObjMaterial? m = null;
        foreach (var raw in text.Split('\n'))
        {
            var parts = raw.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2 || parts[0].StartsWith('#')) continue;
            double[] Rgb() => parts.Skip(1).Take(3).Select(p => double.Parse(p, CultureInfo.InvariantCulture)).ToArray();
            switch (parts[0])
            {
                case "newmtl": model.Materials[parts[1]] = m = new ObjMaterial { Name = parts[1] }; break;
                case "Kd" when m is not null: m.Diffuse = Rgb(); break;
                case "Ks" when m is not null: m.Specular = Rgb(); break;
                case "Ns" when m is not null: m.Shininess = double.Parse(parts[1], CultureInfo.InvariantCulture); break;
                case "map_Kd" when m is not null: m.DiffuseMap = parts[^1]; break;
                case "map_Ks" when m is not null: m.SpecularMap = parts[^1]; break;
                case "map_Bump" or "bump" or "norm" when m is not null: m.NormalMap = parts[^1]; break;
            }
        }
    }
}
