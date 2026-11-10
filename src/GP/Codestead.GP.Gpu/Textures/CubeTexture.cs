namespace Codestead.GP.Gpu.Textures;

/// <summary>
/// A cube map: six faces in the order +X, -X, +Y, -Y, +Z, -Z (GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, Vulkan array layers
/// 0–5, D3D12 array slices 0–5). A direction picks the face of its largest component and a point on it, as the OpenGL
/// specification's cube map table says (Vulkan and Direct3D use the same rule), so faces loaded top row first appear
/// the right way up.
/// </summary>
public sealed class CubeTexture(IReadOnlyList<Texture?> faces)
{
    public IReadOnlyList<Texture?> Faces { get; } = faces;

    /// <summary>
    /// The smaller mip levels, level 1 first (each six faces): rendered one by one (a pre-filtered environment map) or
    /// made from level 0 (glGenerateMipmap). Null or empty: the cube map has only level 0.
    /// </summary>
    public IReadOnlyList<IReadOnlyList<Texture?>>? Mips { get; init; }

    /// <summary>
    /// The cube map at a mip level (textureLod, SampleLevel): the two nearest levels blended (trilinear filtering),
    /// the level kept inside the levels there are.
    /// </summary>
    public double[] Sample(double x, double y, double z, double lod)
    {
        int levels = 1 + (Mips?.Count ?? 0);
        lod = double.IsNaN(lod) ? 0 : Math.Clamp(lod, 0, levels - 1);
        int lower = (int)Math.Floor(lod);
        double t = lod - lower;
        var a = Sample(x, y, z, lower == 0 ? Faces : Mips![lower - 1]);
        if (t <= 0 || lower + 1 >= levels) return a;
        var b = Sample(x, y, z, Mips![lower]);
        var r = new double[4];
        for (int k = 0; k < 4; k++) r[k] = a[k] + (b[k] - a[k]) * t;
        return r;
    }

    public double[] Sample(double x, double y, double z) => Sample(x, y, z, Faces);

    private static double[] Sample(double x, double y, double z, IReadOnlyList<Texture?> faces)
    {
        double ax = Math.Abs(x), ay = Math.Abs(y), az = Math.Abs(z);
        int face;
        double sc, tc, ma;
        if (ax >= ay && ax >= az)
        {
            face = x >= 0 ? 0 : 1;
            sc = x >= 0 ? -z : z;
            tc = -y;
            ma = ax;
        }
        else if (ay >= az)
        {
            face = y >= 0 ? 2 : 3;
            sc = x;
            tc = y >= 0 ? z : -z;
            ma = ay;
        }
        else
        {
            face = z >= 0 ? 4 : 5;
            sc = z >= 0 ? x : -x;
            tc = -y;
            ma = az;
        }
        if (ma == 0 || face >= faces.Count || faces[face] is not { } tex) return [0, 0, 0, 1];
        return tex.Sample(0.5 * (sc / ma + 1), 0.5 * (tc / ma + 1));
    }
}
