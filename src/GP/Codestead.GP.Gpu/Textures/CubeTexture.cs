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

    public double[] Sample(double x, double y, double z)
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
        if (ma == 0 || face >= Faces.Count || Faces[face] is not { } tex) return [0, 0, 0, 1];
        return tex.Sample(0.5 * (sc / ma + 1), 0.5 * (tc / ma + 1));
    }
}
