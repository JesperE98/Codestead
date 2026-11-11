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
internal sealed partial class D3D12Device : IDeviceModel
{
    public sealed class Resource
    {
        public int Id;
        public bool Buffer;
        public int Width, Height, ArraySize = 1, Samples = 1;
        public bool Float, Depth, Window, Srgb;
        public string Format = "";
        /// <summary>A buffer's contents by byte offset (4-byte numbers; 2-byte for 16-bit index data).</summary>
        public readonly SortedDictionary<long, double> Memory = new();
        /// <summary>A texture's images (one per array slice: six for a cube map).</summary>
        public readonly List<Image?> Images = new();
        public string TargetId => "res:" + Id;
        /// <summary>
        /// Mip levels that hold a picture: drawn into one by one through render target views of single mip slices – the
        /// render targets "res:N~level" hold levels 1 and up.
        /// </summary>
        public int TargetLevels = 1;
        /// <summary>The texture is drawn into through views of single array slices (one cube face per view).</summary>
        public bool PerSlice;

        public string LevelTarget(int level) => level > 0 ? $"{TargetId}~{level}" : TargetId;
    }

    /// <summary>What is set on the command list when a draw is recorded.</summary>
    /// <param name="Target">The render target the descriptor named when the draw was recorded (a program may write
    /// another view into the same descriptor for its next pass: one RTV slot for every face of a cube map); null for
    /// the window.</param>
    public sealed record DrawState(long? RenderTarget, IReadOnlyDictionary<int, (long Address, int Stride)> VertexBuffers,
        (long Address, int Bytes)? IndexBuffer, IReadOnlyDictionary<int, long> Tables, IReadOnlyDictionary<int, long>? RootCbvs = null, string? Target = null, string? Topology = null,
        bool NoHeap = false, string? Pso = null);

    private const double AddressUnit = 1e9;
    private const double HeapUnit = 1e6;

    private readonly CppSource src;
    private readonly GpuProject project;
    private readonly List<Resource> resources = new();
    private readonly Dictionary<string, double> heaps = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Image?> images = new(StringComparer.Ordinal);
    /// <summary>SRVs by handle: the resource and whether it is viewed as a cube map.</summary>
    public readonly Dictionary<long, (int Resource, bool Cube)> Srvs = new();
    /// <summary>Resources drawn as a further render target of another one's target: resource → (target, attachment).</summary>
    private readonly Dictionary<int, (string Target, int Attachment)> attachmentOf = new();
    /// <summary>Per render target: how many colour attachments, and whether a depth stencil view is bound with it.</summary>
    private readonly Dictionary<string, (int Colors, bool Depth)> targetShape = new(StringComparer.Ordinal);

    public (int Colors, bool Depth)? ShapeOf(string target) => targetShape.TryGetValue(target, out var s) ? s : null;

    /// <summary>A depth resource → the first off-screen target drawn with it; a target → the target whose depth it shares.</summary>
    private readonly Dictionary<int, string> depthUsers = new();
    private readonly Dictionary<string, string> depthOf = new(StringComparer.Ordinal);

    /// <summary>The channels each colour attachment of a target keeps (an R8_UNORM revealage texture: 1), or null.</summary>
    public IReadOnlyList<int>? ChannelsOf(string target, int colors)
    {
        var formats = new string?[Math.Max(1, colors)];
        foreach (var r in resources.Where(r => r.TargetId == target)) formats[0] = r.Format;
        foreach (var (id, (t, k)) in attachmentOf)
            if (t == target && k < formats.Length && ResourceAt(id) is { } attached) formats[k] = attached.Format;
        return FormatChannels.List(formats.Select(FormatChannels.Of));
    }

    /// <summary>The target whose depth buffer a target uses too (both drawn with one depth stencil view), or null.</summary>
    public string? DepthOf(string target) => depthOf.GetValueOrDefault(target);

    /// <summary>SRVs that read their texture as sRGB (an _SRGB view format, or the resource's own).</summary>
    private readonly HashSet<long> srgbSrvs = new();

    /// <summary>The back buffer's render target view has an _SRGB format: what is drawn into the window is encoded.</summary>
    public bool WindowSrgb { get; private set; }
    public readonly Dictionary<long, int> Rtvs = new();
    /// <summary>Render target views of one array slice (a cube map's face) and/or mip level: handle → (slice, level).</summary>
    private readonly Dictionary<long, (int Slice, int Level)> rtvSlices = new();
    public readonly Dictionary<long, int> Dsvs = new();
    private bool flip;
    private CppExec? exec;

    // The command list's state while recording.
    private long? renderTarget;
    private readonly Dictionary<int, (long, int)> vertexBuffers = new();
    private (long, int)? indexBuffer;
    private readonly Dictionary<int, long> tables = new();
    private readonly Dictionary<int, long> rootCbvs = new();
    /// <summary>The primitive topology set last (IASetPrimitiveTopology): a program may change it between draws.</summary>
    private string? topology;

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

    public DrawState Snapshot() => new(renderTarget, new Dictionary<int, (long, int)>(vertexBuffers), indexBuffer, new Dictionary<int, long>(tables), new Dictionary<int, long>(rootCbvs),
        renderTarget is { } rt ? TargetOf(rt) : null, topology, tablesWithoutHeap, boundPso);

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
            r.Format = format;
            r.Float = format.Contains("FLOAT", StringComparison.Ordinal) && !format.StartsWith("DXGI_FORMAT_D", StringComparison.Ordinal);
            r.Srgb = format.Contains("_SRGB", StringComparison.Ordinal);
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
        if (DebugLayerCall(name, args) is { } answered) return answered;
        if (PipelineCall(name, args) is { } made) return made;
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
                    var pDataValue = item.Fields?.GetValueOrDefault("pData");
                    var pData = pDataValue?.Text;
                    var image = pData is not null && images.TryGetValue(pData, out var img) ? img : null;
                    // Data the program computed (the SSAO noise: XMFLOAT4 noise[16]): its numbers, four per texel (RGBA).
                    if (image is null && pDataValue is not null && pData is null && dst.Width > 0)
                    {
                        var numbers = new List<double>();
                        CppExec.Flatten(pDataValue, numbers);
                        int w = dst.Width, h = Math.Max(1, dst.Height);
                        if (numbers.Count >= w * h)
                        {
                            int per = Math.Clamp(numbers.Count / (w * h), 1, 4);
                            // An 8-bit UNORM format: the numbers are bytes, 0–255 (a glyph atlas of unsigned chars).
                            bool ofBytes = dst.Format.Contains("UNORM", StringComparison.Ordinal) && !dst.Format.Contains("16", StringComparison.Ordinal) && numbers.Any(v => v > 1);
                            var floats = new double[w * h * 4];
                            var bytes = new byte[w * h * 4];
                            for (int t = 0; t < w * h; t++)
                                for (int k = 0; k < 4; k++)
                                {
                                    double v = k < per ? numbers[t * per + k] / (ofBytes ? 255.0 : 1.0) : (k == 3 ? 1 : 0);
                                    floats[t * 4 + k] = v;
                                    bytes[t * 4 + k] = (byte)Math.Round(Math.Clamp(v, 0, 1) * 255);
                                }
                            image = new Image(w, h, 4, bytes, floats);
                        }
                    }
                    while (dst.Images.Count <= first + i) dst.Images.Add(null);
                    dst.Images[first + i] = image;
                }
                return ShaderValue.Scalar(0);
            }
            case "stbi_set_flip_vertically_on_load" when args.Count >= 1:
                flip = Num(args[0]) != 0 || Eval(args[0])?.Text is "true" or "TRUE";
                return ShaderValue.Scalar(0);
            case "stbi_load" or "stbi_loadf" when args.Count >= 5:
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
                    int fileChannels = StbImage.FileChannels(project, path);
                    if (Strip(args[3]) is var c) exec.Runner.Assign(c, ShaderValue.Scalar(fileChannels));
                    // The bytes, read through a pointer (pixelOffset[0]): the channels asked for (0: the file's).
                    exec.Runner.PointerRead ??= (handle, at) => images.TryGetValue(handle, out var img) && img is not null ? StbImage.Byte(img, img.Channels, at) : null;
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
                    CheckSrv(desc, (long)Num(args[3]));
                    var srvFormat = desc?.Fields?.GetValueOrDefault("Format")?.Text;
                    if (srvFormat is not null ? srvFormat.Contains("_SRGB", StringComparison.Ordinal) : viewed.Srgb) srgbSrvs.Add((long)Num(args[3]));
                    else srgbSrvs.Remove((long)Num(args[3]));
                }
                return ShaderValue.Scalar(0);
            }
            case ".CreateRenderTargetView" when args.Count >= 4:
                if (ResourceOf(args[1]) is { } rt)
                {
                    long rtvHandle = (long)Num(args[3]);
                    Rtvs[rtvHandle] = rt.Id;
                    var rtvDesc = args[2] is Name { Id: "nullptr" or "NULL" } ? null : Eval(Strip(args[2]));
                    // A view of one array slice (D3D12_RTV_DIMENSION_TEXTURE2DARRAY with ArraySize 1: a cube map's face)
                    // and/or one mip level: draws through it go into that face and level.
                    rtvSlices.Remove(rtvHandle);
                    var arrayView = rtvDesc?.Fields?.GetValueOrDefault("Texture2DArray");
                    var flatView = rtvDesc?.Fields?.GetValueOrDefault("Texture2D");
                    bool isArrayView = rtvDesc?.Fields?.GetValueOrDefault("ViewDimension")?.Text?.Contains("TEXTURE2DARRAY", StringComparison.Ordinal) == true;
                    int level = (int)((isArrayView ? arrayView : flatView)?.Fields?.GetValueOrDefault("MipSlice")?.X ?? 0);
                    int slice = isArrayView ? (int)(arrayView?.Fields?.GetValueOrDefault("FirstArraySlice")?.X ?? 0) : 0;
                    bool oneSlice = isArrayView && (arrayView?.Fields?.GetValueOrDefault("ArraySize")?.X ?? 0) == 1;
                    if (!rt.Window && (oneSlice || level > 0))
                    {
                        rtvSlices[rtvHandle] = (oneSlice ? slice : 0, level);
                        if (oneSlice) rt.PerSlice = true;
                        rt.TargetLevels = Math.Max(rt.TargetLevels, level + 1);
                    }
                    // A back buffer viewed as _SRGB: what is drawn into the window is encoded.
                    var rtvFormat = rtvDesc?.Fields?.GetValueOrDefault("Format")?.Text;
                    if (rt.Window && rtvFormat is not null) WindowSrgb = rtvFormat.Contains("_SRGB", StringComparison.Ordinal);
                }
                return ShaderValue.Scalar(0);
            case ".CreateDepthStencilView" when args.Count >= 4:
                if (ResourceOf(args[1]) is { } ds) Dsvs[(long)Num(args[3])] = ds.Id;
                return ShaderValue.Scalar(0);

            // ---------- recording ----------
            case ".OMSetRenderTargets" when args.Count >= 3:
                renderTarget = Num(args[1]) > 0 && Eval(Strip(args[2])) is { } rtv ? (long)(rtv.Items is { Length: > 0 } items ? items[0].X : rtv.X) : null;
                // No render target, only a depth stencil view (a shadow map's depth pass): the draws go into the
                // texture behind that view (written as -handle - 1).
                if (renderTarget is null && args.Count >= 5 && args[4] is not Name { Id: "nullptr" or "NULL" } && Eval(Strip(args[4])) is { V: { Length: > 0 } dsv }
                    && Dsvs.TryGetValue((long)dsv[0], out var depthOnly) && ResourceAt(depthOnly) is { Window: false } depthRes && SrvOf(depthRes.Id))
                    renderTarget = -(long)dsv[0] - 1;
                // Several render targets (bloom's bright colour: SV_TARGET1): RTV k is attachment k of the first one's target.
                if (renderTarget is long firstRtv && firstRtv >= 0 && TargetOf(firstRtv) is { } mrtTarget)
                {
                    int count = (int)Num(args[1]);
                    bool single = args.Count >= 4 && (Eval(args[3])?.X ?? 0) != 0;
                    var listed = Eval(Strip(args[2]))?.Items;
                    for (int k = 1; k < count; k++)
                    {
                        long handle = single || listed is null || k >= listed.Length ? firstRtv + k : (long)listed[k].X;
                        if (Rtvs.TryGetValue(handle, out var extra)) attachmentOf[extra] = (mrtTarget, k);
                    }
                    bool hasDsv = args.Count >= 5 && args[4] is not Name { Id: "nullptr" or "NULL" };
                    targetShape[mrtTarget] = (Math.Max(1, count), hasDsv || (targetShape.TryGetValue(mrtTarget, out var old) && old.Depth));
                    // One depth buffer for two targets (weighted blended OIT's transparent pass tests against the opaque
                    // pass's depth): the second uses the first one's.
                    if (hasDsv && Eval(Strip(args[4])) is { V: { Length: > 0 } dsvHandle } && Dsvs.TryGetValue((long)dsvHandle[0], out var depthResource))
                    {
                        if (!depthUsers.TryGetValue(depthResource, out var firstUser)) depthUsers[depthResource] = mrtTarget;
                        else if (firstUser != mrtTarget) depthOf[mrtTarget] = firstUser;
                    }
                }
                return ShaderValue.Scalar(0);
            case ".ClearRenderTargetView" when args.Count >= 3:
            {
                var color = Eval(Strip(args[2]));
                var rgba = new List<double>();
                if (color is not null) CppExec.Flatten(color, rgba);
                // One view's target: an RTV that is attachment k of the render targets set (OMSetRenderTargets with
                // several) clears that attachment only; the first one attachment 0.
                long rtvHandle = (long)Num(args[1]);
                var (cleared, attachment) = Rtvs.TryGetValue(rtvHandle, out var viewed) && attachmentOf.TryGetValue(viewed, out var att) ? (att.Target, (int?)att.Attachment)
                    : (TargetOf(rtvHandle), TargetOf(rtvHandle) is { } single && targetShape.TryGetValue(single, out var shape) && shape.Colors > 1 ? 0 : (int?)null);
                Ops.Add(new ClearOp(DrawCount(), cleared, rgba.Count >= 3 ? rgba.ToArray() : null, null, null, attachment));
                return ShaderValue.Scalar(0);
            }
            case ".ClearDepthStencilView" when args.Count >= 5:
            {
                var flags = (Eval(args[2])?.Text ?? "") + " " + string.Join(" ", FlagNames(args[2]));
                bool depth = flags.Contains("DEPTH", StringComparison.Ordinal), stencil = flags.Contains("STENCIL", StringComparison.Ordinal);
                Ops.Add(new ClearOp(DrawCount(), renderTarget is { } t ? TargetOf(t) : null, null, depth ? Num(args[3]) : null, stencil ? (int)Num(args[4]) : null));
                return ShaderValue.Scalar(0);
            }
            case ".IASetPrimitiveTopology" when args.Count >= 2:
                topology = Eval(args[1])?.Text ?? (args[1] is Name topologyName ? topologyName.Id : topology);
                return ShaderValue.Scalar(0);
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
            case ".SetGraphicsRootConstantBufferView" when args.Count >= 3:
                rootCbvs[(int)Num(args[1])] = (long)Num(args[2]);
                return ShaderValue.Scalar(0);
            case ".Load" when args.Count >= 6 && Eval(args[1])?.Text is { } objPath && objPath.EndsWith(".obj", StringComparison.OrdinalIgnoreCase):
                LoadModel(args[0], objPath, args[4], (int)Num(args[5]));
                return ShaderValue.Scalar(0);
            case ".SetGraphicsRootDescriptorTable" when args.Count >= 3:
                tables[(int)Num(args[1])] = (long)Num(args[2]);
                if (!heapsSet) TableWithoutHeap((long)Num(args[2]));
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

    /// <summary>
    /// The course's Model::Load(path, device, commandList, heap, firstDescriptor) – learnopengl's Model ported: per mesh a
    /// vertex buffer (position, normal, texture coordinates: 32 bytes a vertex), a 32-bit index buffer and two SRVs (the
    /// diffuse and specular maps) at firstDescriptor + 2 × mesh; model.meshes[i].vertexBufferView / indexBufferView /
    /// srvHandle / indices then hold them, for code that draws the meshes itself (the asteroid field).
    /// </summary>
    private void LoadModel(Expr target, string path, Expr heapExpr, int firstDescriptor)
    {
        if (Models.ObjModel.Load(project, path) is not { } model) return;
        bool flipUv = Models.ModelFiles.FlipUVs(src, project);
        var heap = HeapName(heapExpr);
        if (!heaps.TryGetValue(heap, out var heapStart)) heaps[heap] = heapStart = (heaps.Count + 1) * HeapUnit;
        var meshes = new List<ShaderValue>();
        for (int m = 0; m < model.Meshes.Count; m++)
        {
            var mesh = model.Meshes[m];
            var vb = new Resource { Id = resources.Count + 1, Buffer = true };
            resources.Add(vb);
            for (int v = 0; v < mesh.Positions.Count; v++)
            {
                double[] values = [.. mesh.Positions[v], .. mesh.Normals[v], mesh.TexCoords[v][0], flipUv ? 1 - mesh.TexCoords[v][1] : mesh.TexCoords[v][1]];
                for (int k = 0; k < 8; k++) vb.Memory[v * 32L + k * 4] = values[k];
            }
            var ib = new Resource { Id = resources.Count + 1, Buffer = true };
            resources.Add(ib);
            for (int k = 0; k < mesh.Indices.Count; k++) ib.Memory[k * 4L] = mesh.Indices[k];
            long slot = (long)heapStart + firstDescriptor + 2 * m;
            foreach (var (file, offset) in new[] { (mesh.Material?.DiffuseMap, 0), (mesh.Material?.SpecularMap, 1) })
            {
                var tex = new Resource { Id = resources.Count + 1, Width = 1, Height = 1 };
                resources.Add(tex);
                tex.Images.Add(Models.ModelFiles.Texture(project, path, file, false)?.Image);
                Srvs[slot + offset] = (tex.Id, false);
            }
            meshes.Add(ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["vertexBufferView"] = Desc(("BufferLocation", ShaderValue.Scalar(vb.Id * AddressUnit)), ("StrideInBytes", ShaderValue.Scalar(32)), ("SizeInBytes", ShaderValue.Scalar(mesh.Positions.Count * 32))),
                ["indexBufferView"] = Desc(("BufferLocation", ShaderValue.Scalar(ib.Id * AddressUnit)), ("Format", ShaderValue.Str("DXGI_FORMAT_R32_UINT")), ("SizeInBytes", ShaderValue.Scalar(mesh.Indices.Count * 4))),
                ["srvHandle"] = ShaderValue.Scalar(slot),
                ["indices"] = ShaderValue.Array(mesh.Indices.Select(i => ShaderValue.Integer(i)).ToArray()),
                ["vertices"] = ModelVertices(mesh, flipUv),
            }));
        }
        // The meshes are the device's: a copy of a struct that points at the model (Entity's Model* pModel) shares them.
        exec!.Runner.Assign(target, ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal) { ["meshes"] = new ShaderValue { Items = meshes.ToArray(), Shared = true } }));
    }

    /// <summary>
    /// A mesh's vertices as the program's Vertex struct (position, normal, texture coordinates by their names), for code
    /// that reads them (a bounding volume around the model).
    /// </summary>
    private ShaderValue ModelVertices(Models.ObjMesh mesh, bool flipUv)
    {
        var fields = StructLayout.Fields(src, "Vertex")?.Select(f => f.Name).ToList() ?? ["position", "normal", "texCoord"];
        return ShaderValue.Array(Enumerable.Range(0, mesh.Positions.Count).Select(v => ShaderValue.Struct(fields.ToDictionary(f => f, f =>
            f.Contains("pos", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Vec(mesh.Positions[v].ToArray())
            : f.Contains("normal", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Vec(mesh.Normals[v].ToArray())
            : f.Contains("tex", StringComparison.OrdinalIgnoreCase) || f.Contains("uv", StringComparison.OrdinalIgnoreCase)
                ? ShaderValue.Vec(mesh.TexCoords[v][0], flipUv ? 1 - mesh.TexCoords[v][1] : mesh.TexCoords[v][1])
            : ShaderValue.Vec(0, 0, 0), StringComparer.Ordinal))).ToArray());
    }

    /// <summary>
    /// The values of a cbuffer bound as a root constant buffer view, read from the buffer's memory with HLSL's packing:
    /// 16-byte rows, a vector never crosses a row, every array element starts a new row; matrices are read as stored
    /// (the program stores them transposed for column_major HLSL).
    /// </summary>
    /// <summary>A cbuffer matrix: HLSL packs it column by column (column_major), the runner's own order.</summary>
    private static ShaderValue Matrix(double[] v) => ShaderValue.Matrix(v.Length == 16 ? 4 : 3, v);

    public Dictionary<string, ShaderValue>? CbufferAt(long address, IReadOnlyList<Field> fields, Func<string, int> components)
    {
        if (address < AddressUnit || ResourceAt((int)(address / AddressUnit)) is not { } res) return null;
        long baseOffset = address - res.Id * (long)AddressUnit;
        double Get(long at) => res.Memory.TryGetValue(baseOffset + at, out var x) ? x : 0;
        var values = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        long offset = 0;
        foreach (var f in fields)
        {
            int n = components(f.Type);
            bool matrix = n == 16 || n == 9;
            if (f.ArraySize > 0)
            {
                offset = (offset + 15) / 16 * 16;
                var items = new List<ShaderValue>();
                for (int i = 0; i < f.ArraySize; i++)
                {
                    var v = new double[n];
                    for (int k = 0; k < n; k++) v[k] = Get(offset + k * 4);
                    items.Add(matrix ? Matrix(v) : ShaderValue.Vec(v));
                    offset += Math.Max(16, (n * 4 + 15) / 16 * 16);
                }
                values[f.Id] = ShaderValue.Array(items.ToArray());
                continue;
            }
            int bytes = n * 4;
            if (matrix || offset / 16 != (offset + bytes - 1) / 16) offset = (offset + 15) / 16 * 16;
            var value = new double[n];
            for (int k = 0; k < n; k++) value[k] = Get(offset + k * 4);
            values[f.Id] = matrix ? Matrix(value) : ShaderValue.Vec(value);
            offset += bytes;
        }
        return values;
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
    public string? TargetOf(long handle)
    {
        if (handle < 0) return Dsvs.TryGetValue(-handle - 1, out var d) && ResourceAt(d) is { Window: false } dr ? dr.TargetId : null;
        if (!Rtvs.TryGetValue(handle, out var id) || ResourceAt(id) is not { Window: false } r) return null;
        // "res:N", "res:N~2" for mip level 2, "…@3" for array slice (cube face) 3.
        if (!rtvSlices.TryGetValue(handle, out var view)) return r.TargetId;
        var level = r.LevelTarget(view.Level);
        return view.Slice > 0 ? level + "@" + view.Slice : level;
    }

    /// <summary>The resource behind a target id ("res:N~2@3"), and the mip level it names.</summary>
    public (Resource Resource, int Level)? TargetResource(string id)
    {
        var m = System.Text.RegularExpressions.Regex.Match(id, @"^res:(\d+)(?:~(\d+))?(?:@\d+)?$");
        return m.Success && ResourceAt(int.Parse(m.Groups[1].Value)) is { } r ? (r, m.Groups[2].Success ? int.Parse(m.Groups[2].Value) : 0) : null;
    }

    /// <summary>A recorded draw goes to an off-screen target (not to the window).</summary>
    public bool Offscreen(object? state) => state is DrawState { Target: not null };

    /// <summary>A resource some shader resource view reads (a depth texture that is sampled later).</summary>
    private bool SrvOf(int resource) => Srvs.Values.Any(v => v.Resource == resource);

    /// <summary>memcpy into a mapped buffer: the numbers of the source, 4 bytes each (2 for 16-bit index data).</summary>
    private void Write(Expr dst, Expr from, Expr? size)
    {
        var address = Eval(dst) is { V: { Length: > 0 } v } ? v[0] : 0;
        if (address < AddressUnit || ResourceAt((int)(address / AddressUnit)) is not { } res) return;
        long offset = (long)(address - res.Id * AddressUnit);
        var value = Eval(Strip(from));
        if (value is null) return;
        var numbers = new List<double>();
        CppExec.Flatten(value, numbers, rowMajor: true);
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
    /// <param name="layer">The slice a Texture2DArray read names (its third coordinate): slice k of a render target is
    /// "res:N@k".</param>
    public (Texture? Texture, CubeTexture? Cube) TextureAt(long handle, SamplerState sampler, int layer = 0)
    {
        if (!Srvs.TryGetValue(handle, out var srv) || ResourceAt(srv.Resource) is not { } res) return (null, null);
        if (layer > 0 && !srv.Cube && res.Images.Count == 0 && !res.Buffer && !res.Window)
        {
            var slice = res.TargetId + "@" + Math.Min(layer, res.ArraySize - 1);
            bool sliceDepth = res.Depth;
            return (new Texture(() => Raster.Rasterizer.TargetImage(slice, 0, sliceDepth), sampler) { Components = 4 }, null);
        }
        // An invalid view (the debug layer's message #31): the shader reads 0.
        if (invalidSrvs.Contains(handle)) return (new Texture(new Image(1, 1, 4, new byte[4]), sampler) { Components = 4 }, null);
        if (srv.Cube && res.Images.All(i => i is null) && !res.Buffer && !res.Window)
        {
            // A cube map drawn into (point shadows): face i is slice i of the target.
            bool cubeDepth = res.Depth;
            List<Texture?> Level(string target) => Enumerable.Range(0, 6).Select(face =>
                (Texture?)new Texture(() => Raster.Rasterizer.TargetImage(face == 0 ? target : target + "@" + face, 0, cubeDepth), sampler) { Components = 4 }).ToList();
            // Its mip levels, when they were drawn: read by SampleLevel.
            return (null, new CubeTexture(Level(res.TargetId))
            {
                Mips = res.TargetLevels > 1 ? Enumerable.Range(1, res.TargetLevels - 1).Select(level => (IReadOnlyList<Texture?>)Level(res.LevelTarget(level))).ToList() : null,
            });
        }
        if (srv.Cube) return (null, new CubeTexture(res.Images.Select(i => i is null ? null : new Texture(i, sampler) { Components = i.Channels == 4 ? 4 : 3 }).ToList()));
        if (attachmentOf.TryGetValue(res.Id, out var att))
            return (new Texture(() => Raster.Rasterizer.TargetImage(att.Target, att.Attachment, false), sampler) { Components = 4 }, null);
        if (res.Images.FirstOrDefault() is { } image) return (new Texture(image, sampler) { Components = image.Channels == 4 ? 4 : 3, Srgb = srgbSrvs.Contains(handle) }, null);
        if (res.Images.Count == 0 && !res.Buffer)
        {
            var id = res.TargetId;
            bool depth = res.Depth;
            return (new Texture(() => Raster.Rasterizer.TargetImage(id, 0, depth), sampler) { Components = 4 }, null);
        }
        return (null, null);
    }
}
