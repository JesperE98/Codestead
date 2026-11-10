using System.Collections.Concurrent;
using System.Runtime.ExceptionServices;
using Codestead.GP.Gpu.Scene;

namespace Codestead.GP.Gpu.Raster;

// Shading fragments on every core. The fragment shader (an interpreted GLSL/HLSL program) is what makes a frame slow,
// so the primitives of a draw are set up in order on the draw's thread and their fragments shaded in batches by one
// worker per core, each with its own shader runners. Worker w owns the rows w, w + n, w + 2n … and runs every
// primitive of the batch in draw order over its rows: a pixel still sees the primitives – depth test, stencil,
// blending – in exactly the order the program drew them, so the frame is the same as on one core.
public static partial class Rasterizer
{
    /// <summary>The texture reads of a draw's shaders: texture() and friends, cube maps, textureSize().</summary>
    private sealed record TextureReads(
        Func<string, double, double, double[]>? Sample,
        Func<string, double, double, double, double[]?>? SampleCube,
        Func<string, (int Width, int Height)?>? Size)
    {
        public static TextureReads Of(DrawCall draw) => new(draw.Textures, draw.CubeTextures, draw.TextureSizes);

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
                Size is { } size ? id => Read(2, id, () => size(id)) : null);
        }
    }

    /// <summary>
    /// The set-up primitives of a draw waiting for their fragments, in draw order. <see cref="Run"/> shades them: a
    /// small batch on the draw's thread with the draw's stages, a large one by a worker per core with stages of its
    /// own (made on first use, then kept for the rest of the draw).
    /// </summary>
    private sealed class FragmentBatch(Stages stages, Func<Stages> newWorker)
    {
        /// <summary>Primitives per batch: enough to keep the cores busy, few enough to bound what they hold on to.</summary>
        private const int MaxPrimitives = 1024;

        /// <summary>Below this many pixels (bounding boxes) a batch is shaded on one thread: handing it over costs more.</summary>
        private const long MinParallelPixels = 256;

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

        /// <summary>Shades the waiting primitives; a shader error is thrown as one core would have hit it first.</summary>
        public void Run()
        {
            if (fills.Count == 0) return;
            try
            {
                if (Cores == 1 || pixels < MinParallelPixels)
                    foreach (var fill in fills) fill(stages, 0, 1);
                else RunParallel();
            }
            finally
            {
                fills.Clear();
                pixels = 0;
            }
        }

        private void RunParallel()
        {
            int n = Cores;
            // Made here on the draw's thread: setting a uniform may write into values the stages share.
            while (workers.Count < n) workers.Add(newWorker());
            var context = current;
            var errors = new (int Primitive, long Position, Exception Error)?[n];
            // The first primitive an error was hit in: no worker goes past it (one core would have stopped there).
            int stop = int.MaxValue;
            Parallel.For(0, n, new ParallelOptions { MaxDegreeOfParallelism = n }, w =>
            {
                // Render-target textures read the frame's targets through the thread's render context.
                var previous = current;
                current = context;
                try
                {
                    for (int i = 0; i < fills.Count && i <= Volatile.Read(ref stop); i++)
                    {
                        try
                        {
                            fills[i](workers[w], w, n);
                        }
                        catch (Exception e)
                        {
                            errors[w] = (i, workers[w].Position, e);
                            for (int seen = Volatile.Read(ref stop); i < seen; seen = Volatile.Read(ref stop))
                                if (Interlocked.CompareExchange(ref stop, i, seen) == seen) break;
                            break;
                        }
                    }
                }
                finally
                {
                    current = previous;
                }
            });
            // Of the errors, the one a single core would have met first: the earliest primitive, then pixel.
            if (errors.Where(e => e is not null).Select(e => e!.Value).OrderBy(e => e.Primitive).ThenBy(e => e.Position).FirstOrDefault() is { Error: { } first })
                ExceptionDispatchInfo.Capture(first).Throw();
        }
    }
}
