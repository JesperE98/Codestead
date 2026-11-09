using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;
using Codestead.GP.Gpu.Textures;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// A small model of a Direct3D 12 device, for the simulator: while the program's setup (LoadPipeline, LoadAssets and
/// the helpers they call) and its command list recording run in the C++ runner, it follows the resources the program
/// creates (buffers with their bytes, textures with their images, render targets), the descriptors it writes into
/// heaps (SRVs, RTVs, DSVs) and, per draw, the render target, vertex and index buffer views and descriptor tables that
/// are set. GPU addresses and CPU pointers are numbers (resource × 10⁹ + byte offset); descriptor handles are numbers
/// too (heap × 10⁶ + index; every descriptor increment is 1).
/// </summary>
internal sealed class D3D12Device : IDeviceModel
{
    public sealed class Resource
    {
        public int Id;
        public bool Buffer;
        public int Width, Height, ArraySize = 1, Samples = 1;
        public bool Float, Depth, Window;
        /// <summary>A buffer's contents by byte offset (4-byte numbers; 2-byte for 16-bit index data).</summary>
        public readonly SortedDictionary<long, double> Memory = new();
        /// <summary>A texture's images (one per array slice: six for a cube map).</summary>
        public readonly List<Image?> Images = new();
        public string TargetId => "res:" + Id;
    }

    /// <summary>What is set on the command list when a draw is recorded.</summary>
    public sealed record DrawState(long? RenderTarget, IReadOnlyDictionary<int, (long Address, int Stride)> VertexBuffers,
        (long Address, int Bytes)? IndexBuffer, IReadOnlyDictionary<int, long> Tables);

    private const double AddressUnit = 1e9;
    private const double HeapUnit = 1e6;

    private readonly CppSource src;
    private readonly GpuProject project;
    private readonly List<Resource> resources = new();
    private readonly Dictionary<string, double> heaps = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Image?> images = new(StringComparer.Ordinal);
    /// <summary>SRVs by handle: the resource and whether it is viewed as a cube map.</summary>
    public readonly Dictionary<long, (int Resource, bool Cube)> Srvs = new();
    public readonly Dictionary<long, int> Rtvs = new();
    public readonly Dictionary<long, int> Dsvs = new();
    private bool flip;
    private CppExec? exec;

    // The command list's state while recording.
    private long? renderTarget;
    private readonly Dictionary<int, (long, int)> vertexBuffers = new();
    private (long, int)? indexBuffer;
    private readonly Dictionary<int, long> tables = new();

    /// <summary>Clears and copies recorded so far: (draw count then, the op, with targets as resource ids "res:N").</summary>
    public List<FrameOp> Ops { get; } = new();
    public Func<int> DrawCount { get; set; } = () => 0;

    public D3D12Device(CppSource src, GpuProject project)
    {
        this.src = src;
        this.project = project;
    }

    public void Attach(CppExec exec) => this.exec = exec;

    public Resource? ResourceAt(int id) => id >= 1 && id <= resources.Count ? resources[id - 1] : null;

    public IEnumerable<Resource> Resources => resources;

    object IDeviceModel.Snapshot() => Snapshot();

    List<FrameOp> IDeviceModel.Ops => Ops;

    public DrawState Snapshot() => new(renderTarget, new Dictionary<int, (long, int)>(vertexBuffers), indexBuffer, new Dictionary<int, long>(tables));

    private ShaderValue? Eval(Expr e)
    {
        try
        {
            return exec!.Runner.EvalArg(e);
        }
        catch (ShaderRuntimeException)
        {
            return null;
        }
    }

    private double Num(Expr e) => Eval(e) is { V: { Length: > 0 } v } ? v[0] : 0;

    private static Expr Strip(Expr e) => e is Unary { Op: "&" or "*" } u ? Strip(u.Operand) : e is Call { Function: "Get" or ".Get", Args: [var t] } ? Strip(t) : e;

    /// <summary>The variable an IID_PPV_ARGS(&amp;x) or reinterpret_cast&lt;…&gt;(&amp;x) argument writes to.</summary>
    private static Expr? OutTarget(Expr e) => e switch
    {
        Call { Function: "IID_PPV_ARGS" or "reinterpret_cast" or "static_cast", Args: [var a] } => OutTarget(a),
        Unary { Op: "&" } u => u.Operand,
        Binary { Op: ">" } b => OutTarget(b.Right),
        // The parser keeps no address-of: &x arrives as x.
        Name or Member or IndexOf => e,
        _ => null,
    };

    private Resource? ResourceOf(Expr e)
    {
        var v = Eval(Strip(e));
        if (v?.Text is { } t && t.StartsWith("res:", StringComparison.Ordinal) && int.TryParse(t[4..], out var id)) return ResourceAt(id);
        if (v?.V is { Length: > 0 } n && n[0] >= AddressUnit) return ResourceAt((int)(n[0] / AddressUnit));
        return null;
    }

    private Resource NewResource(Expr target, ShaderValue? desc)
    {
        var r = new Resource { Id = resources.Count + 1 };
        resources.Add(r);
        if (desc?.Fields is { } f)
        {
            string Text(string k) => f.TryGetValue(k, out var x) ? x.Text ?? "" : "";
            int Int(string k, int fallback) => f.TryGetValue(k, out var x) && x.V is { Length: > 0 } v ? (int)v[0] : fallback;
            r.Buffer = Text("Dimension").Contains("BUFFER", StringComparison.Ordinal);
            r.Width = Int("Width", 0);
            r.Height = Int("Height", 1);
            r.ArraySize = Math.Max(1, Int("DepthOrArraySize", 1));
            var format = Text("Format");
            r.Float = format.Contains("FLOAT", StringComparison.Ordinal) && !format.StartsWith("DXGI_FORMAT_D", StringComparison.Ordinal);
            r.Depth = format.StartsWith("DXGI_FORMAT_D", StringComparison.Ordinal) || Text("Flags").Contains("DEPTH_STENCIL", StringComparison.Ordinal);
            if (f.TryGetValue("SampleDesc", out var sd) && sd.Fields?.TryGetValue("Count", out var c) == true && c.V is { Length: > 0 } cv) r.Samples = (int)cv[0];
        }
        exec!.Runner.Assign(target, ShaderValue.Str("res:" + r.Id));
        return r;
    }

    private static ShaderValue Desc(params (string Key, ShaderValue Value)[] fields) =>
        ShaderValue.Struct(fields.ToDictionary(f => f.Key, f => f.Value, StringComparer.Ordinal));

    /// <summary>Handles a call during setup or recording; null when it is not one this model follows.</summary>
    private static readonly bool Debug = Environment.GetEnvironmentVariable("GP_D3D12_DEBUG") is not null;

    public ShaderValue? Hook(string name, IReadOnlyList<Expr> args)
    {
        if (exec is null) return null;
        if (Debug && name is not "ThrowIfFailed") Console.Error.WriteLine($"[d3d12] {name}({string.Join(", ", args.Select(a => { var v = Eval(a); return v is null ? "?" : v.ToString(); }))})");
        switch (name)
        {
            case "ThrowIfFailed" when args.Count >= 1:
                Eval(args[0]);
                return ShaderValue.Scalar(0);
            case "CD3DX12_RESOURCE_DESC::Buffer" when args.Count >= 1:
                return Desc(("Dimension", ShaderValue.Str("D3D12_RESOURCE_DIMENSION_BUFFER")), ("Width", ShaderValue.Scalar(Num(args[0]))));
            case "CD3DX12_RESOURCE_DESC::Tex2D" when args.Count >= 3:
                return Desc(("Dimension", ShaderValue.Str("D3D12_RESOURCE_DIMENSION_TEXTURE2D")), ("Format", Eval(args[0]) ?? ShaderValue.Str("")),
                    ("Width", ShaderValue.Scalar(Num(args[1]))), ("Height", ShaderValue.Scalar(Num(args[2]))),
                    ("DepthOrArraySize", ShaderValue.Scalar(args.Count > 3 ? Num(args[3]) : 1)),
                    ("SampleDesc", Desc(("Count", ShaderValue.Scalar(args.Count > 5 ? Math.Max(1, Num(args[5])) : 1)))),
                    ("Flags", args.Count > 7 ? Eval(args[7]) ?? ShaderValue.Str("") : ShaderValue.Str("")));
            case ".CreateCommittedResource" when args.Count >= 7 && OutTarget(args[6]) is { } created:
                NewResource(created, Eval(Strip(args[3])));
                return ShaderValue.Scalar(0);
            case ".GetBuffer" when args.Count >= 3 && OutTarget(args[2]) is { } backBuffer:
                NewResource(backBuffer, null).Window = true;
                return ShaderValue.Scalar(0);
            case ".GetGPUVirtualAddress" when args.Count >= 1:
                return ResourceOf(args[0]) is { } res ? ShaderValue.Scalar(res.Id * AddressUnit) : ShaderValue.Scalar(0);
            case ".Map" when args.Count >= 4 && OutTarget(args[3]) is { } pointer:
                if (ResourceOf(args[0]) is { } mapped) exec.Runner.Assign(pointer, ShaderValue.Scalar(mapped.Id * AddressUnit));
                return ShaderValue.Scalar(0);
            case "memcpy" when args.Count >= 2:
                Write(args[0], args[1], args.Count > 2 ? args[2] : null);
                return ShaderValue.Scalar(0);
            case ".CopyBufferRegion" when args.Count >= 6:
            {
                if (ResourceOf(args[1]) is not { } dst || ResourceOf(args[3]) is not { } srcRes) return ShaderValue.Scalar(0);
                long dstOff = (long)Num(args[2]), srcOff = (long)Num(args[4]), bytes = (long)Num(args[5]);
                foreach (var (k, v) in srcRes.Memory.Where(kv => kv.Key >= srcOff && kv.Key < srcOff + bytes).ToList()) dst.Memory[k - srcOff + dstOff] = v;
                return ShaderValue.Scalar(0);
            }
            case ".CopyResource" when args.Count >= 3:
            {
                if (ResourceOf(args[1]) is { } dst && ResourceOf(args[2]) is { } srcRes)
                {
                    foreach (var (k, v) in srcRes.Memory) dst.Memory[k] = v;
                    if (srcRes.Images.Count > 0) dst.Images.AddRange(srcRes.Images);
                }
                return ShaderValue.Scalar(0);
            }
            case "UpdateSubresources" when args.Count >= 7:
            {
                if (ResourceOf(args[1]) is not { } dst) return ShaderValue.Scalar(0);
                var data = Eval(Strip(args[6]));
                var list = data?.Items ?? (data is null ? [] : [data]);
                int first = (int)Num(args[4]), count = (int)Math.Max(1, Num(args[5]));
                foreach (var (item, i) in list.Take(count).Select((x, i) => (x, i)))
                {
                    var pData = item.Fields?.GetValueOrDefault("pData")?.Text;
                    var image = pData is not null && images.TryGetValue(pData, out var img) ? img : null;
                    while (dst.Images.Count <= first + i) dst.Images.Add(null);
                    dst.Images[first + i] = image;
                }
                return ShaderValue.Scalar(0);
            }
            case "stbi_set_flip_vertically_on_load" when args.Count >= 1:
                flip = Num(args[0]) != 0 || Eval(args[0])?.Text is "true" or "TRUE";
                return ShaderValue.Scalar(0);
            case "stbi_load" when args.Count >= 5:
            {
                var path = Eval(args[0])?.Text;
                if (path is null) return ShaderValue.Scalar(0);
                int wanted = (int)Num(args[4]);
                var image = StbImage.Load(project, path, flip, wanted);
                var key = $"img:{images.Count}:{path}";
                images[key] = image;
                if (image is not null)
                {
                    if (Strip(args[1]) is var w) exec.Runner.Assign(w, ShaderValue.Scalar(image.Width));
                    if (Strip(args[2]) is var h) exec.Runner.Assign(h, ShaderValue.Scalar(image.Height));
                    if (Strip(args[3]) is var c) exec.Runner.Assign(c, ShaderValue.Scalar(image.Channels));
                }
                return ShaderValue.Str(key);
            }
            case ".GetDescriptorHandleIncrementSize":
                return ShaderValue.Scalar(1);
            case ".GetCPUDescriptorHandleForHeapStart" or ".GetGPUDescriptorHandleForHeapStart" when args.Count >= 1:
            {
                var heap = HeapName(args[0]);
                if (!heaps.TryGetValue(heap, out var at)) heaps[heap] = at = (heaps.Count + 1) * HeapUnit;
                return ShaderValue.Scalar(at);
            }
            case "CD3DX12_CPU_DESCRIPTOR_HANDLE" or "CD3DX12_GPU_DESCRIPTOR_HANDLE" when args.Count >= 1:
                return ShaderValue.Scalar(args.Count switch
                {
                    1 => Num(args[0]),
                    2 => Num(args[0]) + Num(args[1]),
                    _ => Num(args[0]) + Num(args[1]) * Num(args[2]),
                });
            case ".Offset" when args.Count >= 2:
                exec.Runner.Assign(args[0], ShaderValue.Scalar(Num(args[0]) + Num(args[1]) * (args.Count > 2 ? Num(args[2]) : 1)));
                return ShaderValue.Scalar(0);
            case ".CreateShaderResourceView" when args.Count >= 4:
            {
                if (ResourceOf(args[1]) is { } viewed)
                {
                    var desc = args[2] is Name { Id: "nullptr" or "NULL" } ? null : Eval(Strip(args[2]));
                    bool cube = desc?.Fields?.GetValueOrDefault("ViewDimension")?.Text?.Contains("TEXTURECUBE", StringComparison.Ordinal) == true;
                    Srvs[(long)Num(args[3])] = (viewed.Id, cube);
                }
                return ShaderValue.Scalar(0);
            }
            case ".CreateRenderTargetView" when args.Count >= 4:
                if (ResourceOf(args[1]) is { } rt) Rtvs[(long)Num(args[3])] = rt.Id;
                return ShaderValue.Scalar(0);
            case ".CreateDepthStencilView" when args.Count >= 4:
                if (ResourceOf(args[1]) is { } ds) Dsvs[(long)Num(args[3])] = ds.Id;
                return ShaderValue.Scalar(0);

            // ---------- recording ----------
            case ".OMSetRenderTargets" when args.Count >= 3:
                renderTarget = Num(args[1]) > 0 && Eval(Strip(args[2])) is { } rtv ? (long)(rtv.Items is { Length: > 0 } items ? items[0].X : rtv.X) : null;
                return ShaderValue.Scalar(0);
            case ".ClearRenderTargetView" when args.Count >= 3:
            {
                var color = Eval(Strip(args[2]));
                var rgba = new List<double>();
                if (color is not null) CppExec.Flatten(color, rgba);
                Ops.Add(new ClearOp(DrawCount(), TargetOf((long)Num(args[1])), rgba.Count >= 3 ? rgba.ToArray() : null, null, null));
                return ShaderValue.Scalar(0);
            }
            case ".ClearDepthStencilView" when args.Count >= 5:
            {
                var flags = (Eval(args[2])?.Text ?? "") + " " + string.Join(" ", FlagNames(args[2]));
                bool depth = flags.Contains("DEPTH", StringComparison.Ordinal), stencil = flags.Contains("STENCIL", StringComparison.Ordinal);
                Ops.Add(new ClearOp(DrawCount(), renderTarget is { } t ? TargetOf(t) : null, null, depth ? Num(args[3]) : null, stencil ? (int)Num(args[4]) : null));
                return ShaderValue.Scalar(0);
            }
            case ".IASetVertexBuffers" when args.Count >= 4:
            {
                int start = (int)Num(args[1]), count = (int)Num(args[2]);
                var views = Eval(Strip(args[3]));
                var list = views?.Items ?? (views is null ? [] : [views]);
                for (int i = 0; i < count && i < list.Length; i++)
                {
                    var f = list[i].Fields;
                    if (f is null) continue;
                    vertexBuffers[start + i] = ((long)(f.GetValueOrDefault("BufferLocation")?.X ?? 0), (int)(f.GetValueOrDefault("StrideInBytes")?.X ?? 0));
                }
                return ShaderValue.Scalar(0);
            }
            case ".IASetIndexBuffer" when args.Count >= 2:
            {
                var f = Eval(Strip(args[1]))?.Fields;
                if (f is not null)
                    indexBuffer = ((long)(f.GetValueOrDefault("BufferLocation")?.X ?? 0), (f.GetValueOrDefault("Format")?.Text ?? "").Contains("R16", StringComparison.Ordinal) ? 2 : 4);
                return ShaderValue.Scalar(0);
            }
            case ".SetGraphicsRootDescriptorTable" when args.Count >= 3:
                tables[(int)Num(args[1])] = (long)Num(args[2]);
                return null;   // the frame recorder records it too
            case ".ResolveSubresource" when args.Count >= 5:
            {
                if (ResourceOf(args[1]) is { } dst && ResourceOf(args[3]) is { } from)
                    Ops.Add(new CopyOp(DrawCount(), from.Window ? null : from.TargetId, dst.Window ? null : dst.TargetId));
                return ShaderValue.Scalar(0);
            }
        }
        return null;
    }

    /// <summary>The names in a flags expression (D3D12_CLEAR_FLAG_DEPTH | D3D12_CLEAR_FLAG_STENCIL).</summary>
    private static IEnumerable<string> FlagNames(Expr e) => e switch
    {
        Name n => [n.Id],
        Binary b => FlagNames(b.Left).Concat(FlagNames(b.Right)),
        _ => [],
    };

    private string HeapName(Expr e) => Strip(e) switch
    {
        Name n => n.Id,
        Member m => m.Field,
        Call { Function: ".Get", Args: [var t] } => HeapName(t),
        _ => "heap",
    };

    /// <summary>The render target id of an RTV handle: null for a swap chain buffer (the window).</summary>
    public string? TargetOf(long handle) =>
        Rtvs.TryGetValue(handle, out var id) && ResourceAt(id) is { Window: false } r ? r.TargetId : null;

    /// <summary>memcpy into a mapped buffer: the numbers of the source, 4 bytes each (2 for 16-bit index data).</summary>
    private void Write(Expr dst, Expr from, Expr? size)
    {
        var address = Eval(dst) is { V: { Length: > 0 } v } ? v[0] : 0;
        if (address < AddressUnit || ResourceAt((int)(address / AddressUnit)) is not { } res) return;
        long offset = (long)(address - res.Id * AddressUnit);
        var value = Eval(Strip(from));
        if (value is null) return;
        var numbers = new List<double>();
        CppExec.Flatten(value, numbers);
        int bytes = 4;
        if (Strip(from) is Name n && src.DeclaredType(n.Id) is { } type && System.Text.RegularExpressions.Regex.IsMatch(type, @"16|WORD|short", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) bytes = 2;
        long limit = size is null ? long.MaxValue : (long)Num(size);
        for (int i = 0; i < numbers.Count && (long)i * bytes < limit; i++) res.Memory[offset + (long)i * bytes] = numbers[i];
    }

    /// <summary>The numbers of a buffer from a GPU address on: count values, stride bytes apart, comps each.</summary>
    public double[]? Read(long address, long byteOffset, int comps)
    {
        if (address < AddressUnit || ResourceAt((int)(address / AddressUnit)) is not { } res) return null;
        long at = address - res.Id * (long)AddressUnit + byteOffset;
        var r = new double[comps];
        for (int k = 0; k < comps; k++) r[k] = res.Memory.TryGetValue(at + k * 4, out var x) ? x : 0;
        return r;
    }

    public double? ReadIndex(long address, long byteOffset, int bytes)
    {
        if (address < AddressUnit || ResourceAt((int)(address / AddressUnit)) is not { } res) return null;
        long at = address - res.Id * (long)AddressUnit + byteOffset;
        return res.Memory.TryGetValue(at, out var x) ? x : null;
    }

    /// <summary>The texture a shader register reads through a descriptor table: a loaded image, a cube map or a render target.</summary>
    public (Texture? Texture, CubeTexture? Cube) TextureAt(long handle, SamplerState sampler)
    {
        if (!Srvs.TryGetValue(handle, out var srv) || ResourceAt(srv.Resource) is not { } res) return (null, null);
        if (srv.Cube) return (null, new CubeTexture(res.Images.Select(i => i is null ? null : new Texture(i, sampler) { Components = i.Channels == 4 ? 4 : 3 }).ToList()));
        if (res.Images.FirstOrDefault() is { } image) return (new Texture(image, sampler) { Components = image.Channels == 4 ? 4 : 3 }, null);
        if (res.Images.Count == 0 && !res.Buffer)
        {
            var id = res.TargetId;
            bool depth = res.Depth;
            return (new Texture(() => Raster.Rasterizer.TargetImage(id, 0, depth), sampler) { Components = 4 }, null);
        }
        return (null, null);
    }
}
