using System.Collections.Concurrent;
using System.Runtime.ExceptionServices;
using Codestead.GP.Gpu.Scene;

namespace Codestead.GP.Gpu.Raster;

// Shading fragments on every core. The fragment shader (an interpreted GLSL/HLSL program) is what makes a frame slow,
// so the primitives of a draw are set up in order on the draw's thread and their fragments shaded in batches by one
// worker per core, each with its own shader runners. The framebuffer's rows are split into bands; a worker takes the
// next free band and runs every primitive of the batch in draw order over it: a pixel still meets the primitives –
// depth test, stencil, blending – in exactly the order the program drew them, so the frame is the same as on one
// core.
public static partial class Rasterizer
{
    /// <summary>The texture reads of a draw's shaders: texture() and friends, cube maps, textureSize().</summary>
    private sealed record TextureReads(
        Func<string, double, double, double[]>? Sample,
        Func<string, double, double, double, double[]?>? SampleCube,
        Func<string, Codestead.GP.Gpu.Textures.Image?>? Size,
        Func<string, double, double, double, double, double[]?>? SampleCubeLod = null)
    {
        public static TextureReads Of(DrawCall draw) => new(draw.Textures, draw.CubeTextures, draw.TextureImages, draw.CubeTexturesLod);

        /// <summary>
        /// The same reads for worker threads. The readers' texture lookups fill caches of their own the first time they
        /// see a name, which is not thread-safe: a name's first read runs alone (write lock), later reads of it run side
        /// by side (read lock). A render target's image is made once for all threads (<see cref="RenderContext"/>).
        /// </summary>
        public TextureReads Shared()
        {
            var gate = new ReaderWriterLockSlim();
            var seen = new ConcurrentDictionary<(int Kind, string Id), bool>();
            T Read<T>(int kind, string id, Func<T> read)
            {
                bool known = seen.ContainsKey((kind, id));
                if (known) gate.EnterReadLock();
                else gate.EnterWriteLock();
                try
                {
                    var result = read();
                    if (!known) seen[(kind, id)] = true;
                    return result;
                }
                finally
                {
                    if (known) gate.ExitReadLock();
                    else gate.ExitWriteLock();
                }
            }
            return new(
                Sample is { } sample ? (id, u, v) => Read(0, id, () => sample(id, u, v)) : null,
                SampleCube is { } cube ? (id, x, y, z) => Read(1, id, () => cube(id, x, y, z)) : null,
                Size is { } size ? id => Read(2, id, () => size(id)) : null,
                SampleCubeLod is { } cubeLod ? (id, x, y, z, lod) => Read(1, id, () => cubeLod(id, x, y, z, lod)) : null);
        }
    }

    /// <summary>
    /// The rows a worker changed in the batch it is shading, as they were before it (each row is kept the first time a
    /// fragment is written into it). A shader error puts them back, so the batch can be shaded again on one thread and
    /// stop exactly where one core would have stopped – the frame with the error is the same as on one core too.
    /// </summary>
    private sealed class RowLog
    {
        private readonly Dictionary<(Framebuffer Fb, int Row), (double[][] Colors, double[] Depth, int[] Stencil)> rows = new();

        /// <summary>Keeps the row of a pixel before the first write into it.</summary>
        public void Before(Framebuffer fb, int pixel)
        {
            int row = pixel / fb.Width;
            if (rows.ContainsKey((fb, row))) return;
            int start = row * fb.Width * fb.Samples, length = fb.Width * fb.Samples;
            rows[(fb, row)] = (fb.Colors.Select(c => c.AsSpan(start * 4, length * 4).ToArray()).ToArray(),
                fb.Depth.AsSpan(start, length).ToArray(), fb.Stencil.AsSpan(start, length).ToArray());
        }

        /// <summary>Puts every kept row back.</summary>
        public void Restore()
        {
            foreach (var ((fb, row), (colors, depth, stencil)) in rows)
            {
                int start = row * fb.Width * fb.Samples;
                for (int a = 0; a < colors.Length; a++) colors[a].CopyTo(fb.Colors[a], start * 4);
                depth.CopyTo(fb.Depth, start);
                stencil.CopyTo(fb.Stencil, start);
            }
            rows.Clear();
        }

        public void Clear() => rows.Clear();
    }

    /// <summary>
    /// The set-up primitives of a draw waiting for their fragments, in draw order. <see cref="Run"/> shades them: a
    /// small batch on the draw's thread with the draw's stages, a large one by a worker per core with stages of its
    /// own (made on first use, then kept for the rest of the draw).
    /// </summary>
    private sealed class FragmentBatch(Stages stages, int height, Func<Stages> newWorker)
    {
        /// <summary>Primitives per batch: enough to keep the cores busy, few enough to bound what they hold on to.</summary>
        private const int MaxPrimitives = 1024;

        /// <summary>Below this many pixels (bounding boxes) a batch is shaded on one thread: handing it over costs more.</summary>
        private const long MinParallelPixels = 256;

        /// <summary>
        /// The fragment shader loops (hundreds of samples per pixel: a convolution into a small cube map face): even a
        /// few pixels are worth sharing out.
        /// </summary>
        public bool Heavy { get; init; }

        /// <summary>Bands per worker: small enough that a worker slowed down by other work hands its share to the others.</summary>
        private const int BandsPerWorker = 8;

        private static readonly int Cores = Math.Max(1, Environment.ProcessorCount);

        private readonly List<Fill> fills = new();
        private readonly List<Stages> workers = new();
        private long pixels;

        public void Add(Fill? fill, long size)
        {
            if (fill is null) return;
            fills.Add(fill);
            pixels += size;
            if (fills.Count >= MaxPrimitives) Run();
        }

        /// <summary>Shades the waiting primitives; a shader error is thrown where one core would have hit it.</summary>
        public void Run()
        {
            if (fills.Count == 0) return;
            try
            {
                if (Cores == 1 || height < 2 || pixels < (Heavy ? 4 : MinParallelPixels))
                    foreach (var fill in fills) fill(stages, 0, height);
                else RunParallel();
            }
            finally
            {
                fills.Clear();
                pixels = 0;
            }
        }

        /// <summary>
        /// The workers take bands of rows one after another; a band runs every primitive of the batch in draw order, so
        /// each pixel meets the primitives in the order the program drew them, whichever worker shades it.
        /// </summary>
        private void RunParallel()
        {
            int n = Math.Min(Cores, height);
            // Made here on the draw's thread: setting a uniform may write into values the stages share.
            while (workers.Count < n)
            {
                var worker = newWorker();
                worker.Log = new RowLog();
                workers.Add(worker);
            }
            int band = Math.Max(1, (height + n * BandsPerWorker - 1) / (n * BandsPerWorker));
            int bands = (height + band - 1) / band;
            int next = 0;
            var context = current;
            var errors = new List<(int Primitive, Exception Error)>();
            // The first primitive an error was hit in: no band goes past it (the batch is shaded again anyway).
            int stop = int.MaxValue;
            Parallel.For(0, n, new ParallelOptions { MaxDegreeOfParallelism = n }, w =>
            {
                // Render-target textures read the frame's targets through the thread's render context.
                var previous = current;
                current = context;
                try
                {
                    for (int b = Interlocked.Increment(ref next) - 1; b < bands; b = Interlocked.Increment(ref next) - 1)
                    {
                        int from = b * band, to = Math.Min(height, from + band);
                        for (int i = 0; i < fills.Count && i <= Volatile.Read(ref stop); i++)
                        {
                            try
                            {
                                fills[i](workers[w], from, to);
                            }
                            catch (Exception e)
                            {
                                lock (errors) errors.Add((i, e));
                                for (int seen = Volatile.Read(ref stop); i < seen; seen = Volatile.Read(ref stop))
                                    if (Interlocked.CompareExchange(ref stop, i, seen) == seen) break;
                                break;
                            }
                        }
                    }
                }
                finally
                {
                    current = previous;
                }
            });
            if (errors.Count == 0)
            {
                foreach (var worker in workers) worker.Log!.Clear();
                return;
            }
            // Workers went on past the error: the batch is undone and shaded again on this thread, which stops at the
            // fragment one core stops at (the rare error is paid for with a slow batch, not with a different frame).
            foreach (var worker in workers) worker.Log!.Restore();
            foreach (var fill in fills) fill(stages, 0, height);
            // Not met again (a shader that keeps state from one fragment to the next): the error in the earliest primitive.
            ExceptionDispatchInfo.Capture(errors.MinBy(e => e.Primitive).Error).Throw();
        }
    }
}
