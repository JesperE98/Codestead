using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Raster;

/// <summary>
/// A storage image a compute shader writes and reads (GLSL image2D, a Vulkan storage image, an HLSL RWTexture2D): RGBA
/// floats, row 0 first (the texture's v = 0).
/// </summary>
public sealed class StorageImage(int width, int height, double[]? data = null)
{
    public int Width { get; } = width;
    public int Height { get; } = height;
    public double[] Data { get; } = data ?? new double[width * height * 4];

    /// <summary>The image as a texture image (floats, and bytes clamped to 0 … 1).</summary>
    public Textures.Image ToImage()
    {
        var bytes = new byte[Data.Length];
        for (int i = 0; i < Data.Length; i++) bytes[i] = (byte)Math.Round(Math.Clamp(double.IsNaN(Data[i]) ? 0 : Data[i], 0, 1) * 255);
        return new Textures.Image(Width, Height, 4, bytes, (double[])Data.Clone());
    }

    /// <summary>A texture image's texels as a storage image (its floats, else its bytes / 255).</summary>
    public static StorageImage From(Textures.Image? image, int width, int height)
    {
        if (image is null || image.Width != width || image.Height != height) return new StorageImage(Math.Max(1, width), Math.Max(1, height));
        var data = image.Floats is { } f && f.Length == width * height * 4 ? (double[])f.Clone() : image.Rgba.Select(b => b / 255.0).ToArray();
        return new StorageImage(width, height, data);
    }
}

// Compute shaders: a dispatch of work groups, each of local_size_x × y × z invocations ([numthreads(x, y, z)]), run on
// every core; the shaders write storage images (imageStore, RWTexture2D[xy] = …).
public static partial class Rasterizer
{
    /// <summary>
    /// Runs a compute shader over <paramref name="groups"/> work groups with the uniforms (by name, as for draws), the
    /// storage images by the shader's names for them, and the textures it samples. Returns the errors it ran into.
    /// </summary>
    public static List<string> Dispatch(ShaderProgram program, string entry, bool hlsl, Dictionary<string, ShaderValue> uniforms,
        IReadOnlyDictionary<string, StorageImage> images, (int X, int Y, int Z) groups, double time,
        Func<string, double, double, double[]>? textures = null, Func<string, (int Width, int Height)?>? textureSizes = null)
    {
        var errors = new List<string>();
        var size = program.LocalSize.ToArray();
        Function? hlslEntry = null;
        if (hlsl)
        {
            hlslEntry = program.FindFunction(entry);
            if (hlslEntry is null)
            {
                errors.Add($"the compute shader has no function '{entry}'");
                return errors;
            }
            if (program.Attribute(entry, "numthreads") is { Length: >= 1 } threads)
                for (int k = 0; k < 3; k++) size[k] = k < threads.Length && int.TryParse(threads[k], out var n) ? Math.Max(1, n) : 1;
        }
        else if (program.FindFunction("main") is null)
        {
            errors.Add("the compute shader has no main()");
            return errors;
        }
        int gx = Math.Clamp(groups.X, 0, 65535), gy = Math.Clamp(groups.Y, 0, 65535), gz = Math.Clamp(groups.Z, 0, 65535);
        if ((long)gx * gy * gz == 0) return errors;
        // Writes out of the image are dropped, reads out of it are 0 (robust access, as the drivers do).
        double[]? Load(string name, int x, int y) =>
            images.TryGetValue(name, out var img) && x >= 0 && y >= 0 && x < img.Width && y < img.Height ? img.Data.AsSpan((y * img.Width + x) * 4, 4).ToArray() : null;
        void Store(string name, int x, int y, double[] value)
        {
            if (!images.TryGetValue(name, out var img) || x < 0 || y < 0 || x >= img.Width || y >= img.Height) return;
            value.AsSpan(0, 4).CopyTo(img.Data.AsSpan((y * img.Width + x) * 4, 4));
        }
        (int, int)? Size(string name) => images.TryGetValue(name, out var img) ? (img.Width, img.Height) : null;
        ShaderRunner MakeRunner()
        {
            var runner = new ShaderRunner(program) { Time = time, ImageLoad = Load, ImageStore = Store, ImageSize = Size, Sample = textures, TextureSize = textureSizes };
            foreach (var (k, v) in uniforms) Stages.SetUniform(runner, k, v);
            return runner;
        }
        var numGroups = ShaderValue.Vec(gx, gy, gz);
        var groupSize = ShaderValue.Vec(size[0], size[1], size[2]);
        object errorLock = new();
        // One task per row of work groups (y, z); every invocation of a group in order.
        Parallel.For(0, gy * gz, new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount }, () => MakeRunner(), (row, _, runner) =>
        {
            int wy = row % gy, wz = row / gy;
            try
            {
                for (int wx = 0; wx < gx; wx++)
                    for (int lz = 0; lz < size[2]; lz++)
                        for (int ly = 0; ly < size[1]; ly++)
                            for (int lx = 0; lx < size[0]; lx++)
                            {
                                var global = ShaderValue.Vec(wx * size[0] + lx, wy * size[1] + ly, wz * size[2] + lz);
                                var local = ShaderValue.Vec(lx, ly, lz);
                                var group = ShaderValue.Vec(wx, wy, wz);
                                int index = (lz * size[1] + ly) * size[0] + lx;
                                if (hlsl)
                                {
                                    var args = hlslEntry!.Params.Select(p => (p.Semantic ?? "").ToUpperInvariant() switch
                                    {
                                        "SV_DISPATCHTHREADID" => global,
                                        "SV_GROUPTHREADID" => local,
                                        "SV_GROUPID" => group,
                                        "SV_GROUPINDEX" => ShaderValue.Integer(index),
                                        _ => runner.Default(p.Type),
                                    }).ToList();
                                    runner.Call(hlslEntry.Id, args);
                                }
                                else
                                {
                                    runner.Globals["gl_GlobalInvocationID"] = global;
                                    runner.Globals["gl_LocalInvocationID"] = local;
                                    runner.Globals["gl_WorkGroupID"] = group;
                                    runner.Globals["gl_NumWorkGroups"] = numGroups;
                                    runner.Globals["gl_WorkGroupSize"] = groupSize;
                                    runner.Globals["gl_LocalInvocationIndex"] = ShaderValue.Integer(index);
                                    runner.Call("main", []);
                                }
                            }
            }
            catch (ShaderRuntimeException e)
            {
                lock (errorLock)
                    if (errors.Count < 5) errors.Add(e.Line > 0 ? $"line {e.Line}: {e.Message}" : e.Message);
            }
            return runner;
        }, _ => { });
        return errors;
    }
}
