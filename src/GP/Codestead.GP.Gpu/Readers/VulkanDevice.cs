using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;
using Codestead.GP.Gpu.Textures;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// A small model of a Vulkan device, for the simulator: while the program's setup (initVulkan and the helpers it calls)
/// and its command buffer recording run in the C++ runner, it follows buffers and their memory (the bytes copied into
/// them, staging copies, vkCmdUpdateBuffer), images with their layers (textures, cube maps, off-screen colour images),
/// image views, samplers, framebuffers and descriptor sets, and per draw the render pass's framebuffer and clear values,
/// the vertex and index buffers and the descriptor set bound. Handles are strings ("buf:3", "img:2" …); mapped
/// pointers are numbers (memory × 10⁹ + byte offset).
/// </summary>
internal sealed class VulkanDevice : IDeviceModel
{
    public sealed class Memory
    {
        public readonly SortedDictionary<long, double> Bytes = new();
        /// <summary>Images copied in with memcpy (stb_image pixels), by byte offset.</summary>
        public readonly SortedDictionary<long, string> Images = new();
    }

    public sealed class ImageObject
    {
        public int Id;
        public bool Window;
        public int Width, Height, Layers = 1, Samples = 1;
        public bool Cube, Depth, Float;
        public readonly List<Image?> LayerImages = new();
        public string TargetId => "img:" + Id;
    }

    public sealed record DrawState(string? Framebuffer, IReadOnlyDictionary<int, (string Buffer, long Offset)> VertexBuffers,
        (string Buffer, long Offset, int Bytes)? IndexBuffer, IReadOnlyDictionary<int, string> Sets, string? Pipeline = null);

    /// <summary>A vertex attribute of a pipeline: location, binding, byte offset, numbers.</summary>
    public sealed record Attribute(int Location, int Binding, int Offset, int Comps);

    /// <summary>
    /// What vkCreateGraphicsPipelines was given: the vertex input (attributes; bindings' stride and per-instance rate)
    /// and the rasterization sample count.
    /// </summary>
    public sealed record Pipeline(List<Attribute> Attributes, Dictionary<int, (int Stride, bool Instance)> Bindings, int Samples);

    private readonly Dictionary<string, Pipeline> pipelines = new(StringComparer.Ordinal);
    private string? boundPipeline;

    public Pipeline? PipelineOf(string? handle) => handle is not null && pipelines.TryGetValue(handle, out var p) ? p : null;

    private const double AddressUnit = 1e9;

    private readonly GpuProject project;
    private readonly List<Memory> memories = new();
    private readonly Dictionary<string, (int Memory, long Offset)> buffers = new(StringComparer.Ordinal);
    private readonly List<ImageObject> images = new();
    /// <summary>Image views: the image and whether it is viewed as a cube map.</summary>
    private readonly Dictionary<string, (string Image, bool Cube)> views = new(StringComparer.Ordinal);
    private readonly Dictionary<string, SamplerState> samplers = new(StringComparer.Ordinal);
    /// <summary>Framebuffers: their colour attachment's view (the render pass's colour attachment, else the first).</summary>
    private readonly Dictionary<string, string> framebuffers = new(StringComparer.Ordinal);
    /// <summary>Framebuffers whose render pass resolves the (multisampled) colour attachment: the resolve attachment's view.</summary>
    private readonly Dictionary<string, string> resolves = new(StringComparer.Ordinal);
    /// <summary>Render passes: the first subpass's colour attachment and resolve attachment (indices into the framebuffer's attachments).</summary>
    private readonly Dictionary<string, (int Color, int? Resolve)> renderPasses = new(StringComparer.Ordinal);
    private string? resolveView;
    /// <summary>Descriptor sets: binding → (image view, sampler).</summary>
    private readonly Dictionary<string, Dictionary<int, (string? View, string? Sampler)>> sets = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Image?> loaded = new(StringComparer.Ordinal);
    private int counter;
    private bool flip;
    private CppExec? exec;

    private string? framebuffer;
    private readonly Dictionary<int, (string, long)> vertexBuffers = new();
    private (string, long, int)? indexBuffer;
    private readonly Dictionary<int, string> boundSets = new();

    public List<FrameOp> Ops { get; } = new();
    public Func<int> DrawCount { get; set; } = () => 0;

    private readonly CppSource src;

    public VulkanDevice(GpuProject project, CppSource src)
    {
        this.project = project;
        this.src = src;
    }

    public void Attach(CppExec exec) => this.exec = exec;

    /// <summary>The window's size (the swap chain's extent).</summary>
    public int WindowWidth { get; init; } = 800;
    public int WindowHeight { get; init; } = 600;

    object IDeviceModel.Snapshot() => Snapshot();

    public DrawState Snapshot() => new(framebuffer, new Dictionary<int, (string, long)>(vertexBuffers), indexBuffer, new Dictionary<int, string>(boundSets), boundPipeline);

    private string New(string kind) => $"{kind}:{++counter}";

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

    private string? Handle(Expr e) => Eval(e)?.Text;

    private static Expr Strip(Expr e) => e is Unary { Op: "&" or "*" } u ? Strip(u.Operand) : e is Call { Function: ".data", Args: [var t] } ? t : e;

    private void Set(Expr target, ShaderValue value) => exec!.Runner.Assign(Strip(target), value);

    private static string? Text(ShaderValue? v, string field) => v?.Fields?.GetValueOrDefault(field)?.Text;

    private static double? Number(ShaderValue? v, string field) => v?.Fields?.GetValueOrDefault(field) is { V: { Length: > 0 } x } ? x[0] : null;

    private static ShaderValue? Field(ShaderValue? v, string field) => v?.Fields?.GetValueOrDefault(field);

    private static ShaderValue[] Items(ShaderValue? v) => v?.Items ?? (v is null ? [] : [v]);

    private static readonly bool Debug = Environment.GetEnvironmentVariable("GP_VK_DEBUG") is not null;

    public ShaderValue? Hook(string name, IReadOnlyList<Expr> args)
    {
        if (exec is null) return null;
        if (Debug) Console.Error.WriteLine($"[vk] {name}({string.Join(", ", args.Select(a => { var v = Eval(a); var t = v is null ? "?" : v.ToString(); return t.Length > 80 ? t[..80] + "…" : t; }))})");
        switch (name)
        {
            case "vkCreateBuffer" when args.Count >= 4:
                buffers[Set(args[3], "buf")] = (-1, 0);
                return ShaderValue.Str("VK_SUCCESS");
            case "vkAllocateMemory" when args.Count >= 4:
            {
                memories.Add(new Memory());
                Set(args[3], ShaderValue.Str("mem:" + memories.Count));
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkBindBufferMemory" when args.Count >= 4:
                if (Handle(args[1]) is { } b && MemoryIndex(Handle(args[2])) is int m) buffers[b] = (m, (long)Num(args[3]));
                return ShaderValue.Str("VK_SUCCESS");
            case "vkMapMemory" when args.Count >= 6:
                if (MemoryIndex(Handle(args[1])) is int mm) Set(args[5], ShaderValue.Scalar((mm + 1) * AddressUnit + Num(args[2])));
                return ShaderValue.Str("VK_SUCCESS");
            case "memcpy" when args.Count >= 2:
                Write(args[0], args[1], args.Count > 2 ? args[2] : null);
                return ShaderValue.Scalar(0);
            case "vkCmdCopyBuffer" when args.Count >= 5:
            {
                foreach (var region in Items(Eval(Strip(args[4]))))
                    Copy(Handle(args[1]), (long)(Number(region, "srcOffset") ?? 0), Handle(args[2]), (long)(Number(region, "dstOffset") ?? 0), (long)(Number(region, "size") ?? 0));
                return ShaderValue.Scalar(0);
            }
            case "vkCmdUpdateBuffer" when args.Count >= 5:
            {
                if (Handle(args[1]) is { } ub && buffers.TryGetValue(ub, out var place) && place.Memory >= 0 && Eval(Strip(args[4])) is { } data)
                {
                    var numbers = new List<double>();
                    CppExec.Flatten(data, numbers);
                    long at = place.Offset + (long)Num(args[2]);
                    for (int i = 0; i < numbers.Count; i++) memories[place.Memory].Bytes[at + i * 4] = numbers[i];
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
                var image = StbImage.Load(project, path, flip, 4);
                var key = $"pixels:{loaded.Count}:{path}";
                loaded[key] = image;
                if (image is not null)
                {
                    Set(args[1], ShaderValue.Scalar(image.Width));
                    Set(args[2], ShaderValue.Scalar(image.Height));
                    Set(args[3], ShaderValue.Scalar(image.Channels));
                }
                return ShaderValue.Str(key);
            }
            case "vkCreateImage" when args.Count >= 4:
            {
                var info = Eval(Strip(args[1]));
                var img = new ImageObject { Id = images.Count + 1 };
                images.Add(img);
                var extent = Field(info, "extent");
                img.Width = (int)(Number(extent, "width") ?? 0);
                img.Height = (int)(Number(extent, "height") ?? 0);
                img.Layers = (int)Math.Max(1, Number(info, "arrayLayers") ?? 1);
                img.Cube = (Text(info, "flags") ?? "").Contains("CUBE", StringComparison.Ordinal);
                var samples = Text(info, "samples") ?? "";
                var sm = System.Text.RegularExpressions.Regex.Match(samples, @"(\d+)_BIT");
                img.Samples = sm.Success ? int.Parse(sm.Groups[1].Value) : 1;
                var format = Text(info, "format") ?? "";
                img.Depth = format.Contains("_D16", StringComparison.Ordinal) || format.Contains("_D24", StringComparison.Ordinal) || format.Contains("_D32", StringComparison.Ordinal);
                img.Float = format.Contains("SFLOAT", StringComparison.Ordinal) && !img.Depth;
                Set(args[3], ShaderValue.Str(img.TargetId));
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkGetSwapchainImagesKHR" when args.Count >= 4 && args[3] is not Name { Id: "nullptr" }:
            {
                int count = (int)Math.Max(1, Num(args[2]));
                var list = new List<ShaderValue>();
                for (int i = 0; i < count; i++)
                {
                    var img = new ImageObject { Id = images.Count + 1, Window = true };
                    images.Add(img);
                    list.Add(ShaderValue.Str(img.TargetId));
                }
                Set(args[3], ShaderValue.Array(list.ToArray()));
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkCmdCopyBufferToImage" when args.Count >= 6:
            {
                if (ImageOf(Handle(args[2])) is not { } dst || Handle(args[1]) is not { } srcBuffer || !buffers.TryGetValue(srcBuffer, out var place) || place.Memory < 0) return ShaderValue.Scalar(0);
                var mem = memories[place.Memory];
                long layerBytes = (long)dst.Width * dst.Height * 4;
                foreach (var region in Items(Eval(Strip(args[5]))))
                {
                    long offset = place.Offset + (long)(Number(region, "bufferOffset") ?? 0);
                    var sub = Field(region, "imageSubresource");
                    int first = (int)(Number(sub, "baseArrayLayer") ?? 0), count = (int)Math.Max(1, Number(sub, "layerCount") ?? 1);
                    for (int l = 0; l < count; l++)
                    {
                        var image = mem.Images.TryGetValue(offset + l * layerBytes, out var key) && loaded.TryGetValue(key, out var im) ? im : null;
                        while (dst.LayerImages.Count <= first + l) dst.LayerImages.Add(null);
                        dst.LayerImages[first + l] = image;
                    }
                }
                return ShaderValue.Scalar(0);
            }
            case "vkCreateImageView" when args.Count >= 4:
            {
                var info = Eval(Strip(args[1]));
                var view = Set(args[3], "view");
                views[view] = (Text(info, "image") ?? "", (Text(info, "viewType") ?? "").Contains("CUBE", StringComparison.Ordinal));
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkCreateSampler" when args.Count >= 4:
            {
                var info = Eval(Strip(args[1]));
                var sampler = Set(args[3], "smp");
                samplers[sampler] = TextureBinding.FromFields(f => info?.Fields?.GetValueOrDefault(f)?.Text, d3d: false);
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkCreateRenderPass" when args.Count >= 4:
            {
                var info = Eval(Strip(args[1]));
                var subpass = Items(Field(info, "pSubpasses")).FirstOrDefault();
                int color = (int)(Number(Items(Field(subpass, "pColorAttachments")).FirstOrDefault(), "attachment") ?? 0);
                var resolve = Number(Items(Field(subpass, "pResolveAttachments")).FirstOrDefault(), "attachment");
                var rp = Set(args[3], "rp");
                renderPasses[rp] = (color, resolve is null ? null : (int)resolve);
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkCreateFramebuffer" when args.Count >= 4:
            {
                var info = Eval(Strip(args[1]));
                var attachments = Items(Field(info, "pAttachments"));
                var fb = Set(args[3], "fb");
                var pass = Text(info, "renderPass") is { } rpName && renderPasses.TryGetValue(rpName, out var r) ? r : (0, null);
                if (pass.Color < attachments.Length && attachments[pass.Color].Text is { } colorView) framebuffers[fb] = colorView;
                if (pass.Resolve is int ri && ri < attachments.Length && attachments[ri].Text is { } resolveTo) resolves[fb] = resolveTo;
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkAllocateDescriptorSets" when args.Count >= 3:
            {
                var info = Eval(Strip(args[1]));
                int count = (int)Math.Max(1, Number(info, "descriptorSetCount") ?? 1);
                if (args[2] is Call { Function: ".data" } || count > 1)
                    Set(args[2], ShaderValue.Array(Enumerable.Range(0, count).Select(_ => ShaderValue.Str(New("set"))).ToArray()));
                else Set(args[2], "set");
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkUpdateDescriptorSets" when args.Count >= 3:
            {
                foreach (var w in Items(Eval(Strip(args[2]))))
                {
                    if (Text(w, "dstSet") is not { } set || Field(w, "pImageInfo") is not { } info) continue;
                    var first = Items(info).FirstOrDefault();
                    if (!sets.TryGetValue(set, out var bindings)) sets[set] = bindings = new();
                    bindings[(int)(Number(w, "dstBinding") ?? 0)] = (Text(first, "imageView"), Text(first, "sampler"));
                }
                return ShaderValue.Scalar(0);
            }

            // ---------- the physical device and the swap chain ----------
            case "vkGetPhysicalDeviceProperties" when args.Count >= 2:
            {
                // The simulated device: up to 4 samples per pixel for colour and depth attachments.
                const string counts = "VK_SAMPLE_COUNT_1_BIT|VK_SAMPLE_COUNT_2_BIT|VK_SAMPLE_COUNT_4_BIT";
                var limits = new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
                {
                    ["framebufferColorSampleCounts"] = ShaderValue.Str(counts),
                    ["framebufferDepthSampleCounts"] = ShaderValue.Str(counts),
                    ["maxSamplerAnisotropy"] = ShaderValue.Scalar(16),
                };
                Set(args[1], ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal) { ["limits"] = ShaderValue.Struct(limits) }));
                return ShaderValue.Scalar(0);
            }
            case "vkEnumeratePhysicalDevices" when args.Count >= 3:
                // One GPU: the simulated one.
                if (args[2] is Name { Id: "nullptr" or "NULL" }) Set(args[1], ShaderValue.Scalar(1));
                else Set(args[2], ShaderValue.Array([ShaderValue.Str("gpu:1")]));
                return ShaderValue.Str("VK_SUCCESS");
            case "isDeviceSuitable":
                // The simulated GPU has the queues, extensions and swap chain support the tutorial asks for.
                return ShaderValue.Scalar(1);
            case "chooseSwapExtent":
                // The swap chain's images are the window's size.
                return ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal) { ["width"] = ShaderValue.Scalar(WindowWidth), ["height"] = ShaderValue.Scalar(WindowHeight) });
            case "glfwGetFramebufferSize" when args.Count >= 3:
                Set(args[1], ShaderValue.Scalar(WindowWidth));
                Set(args[2], ShaderValue.Scalar(WindowHeight));
                return ShaderValue.Scalar(0);

            case "vkCreateGraphicsPipelines" when args.Count >= 6:
            {
                var infos = Items(Eval(Strip(args[3])));
                int count = (int)Math.Max(1, Num(args[2]));
                var handles = new List<ShaderValue>();
                foreach (var info in infos.Take(count))
                {
                    var handle = New("pipe");
                    handles.Add(ShaderValue.Str(handle));
                    var input = Field(info, "pVertexInputState");
                    var attributes = new List<Attribute>();
                    foreach (var a in Items(Field(input, "pVertexAttributeDescriptions")).Take((int)(Number(input, "vertexAttributeDescriptionCount") ?? int.MaxValue)))
                    {
                        if (a.Fields is null) continue;
                        var format = Text(a, "format") ?? "";
                        int comps = System.Text.RegularExpressions.Regex.Matches(format, @"[RGBA]\d+").Count;
                        attributes.Add(new Attribute((int)(Number(a, "location") ?? 0), (int)(Number(a, "binding") ?? 0), (int)(Number(a, "offset") ?? 0), Math.Max(1, comps)));
                    }
                    var bindings = new Dictionary<int, (int, bool)>();
                    foreach (var bd in Items(Field(input, "pVertexBindingDescriptions")).Take((int)(Number(input, "vertexBindingDescriptionCount") ?? int.MaxValue)))
                        if (bd.Fields is not null)
                            bindings[(int)(Number(bd, "binding") ?? 0)] = ((int)(Number(bd, "stride") ?? 0), (Text(bd, "inputRate") ?? "").Contains("INSTANCE", StringComparison.Ordinal));
                    var samples = System.Text.RegularExpressions.Regex.Match(Text(Field(info, "pMultisampleState"), "rasterizationSamples") ?? "", @"(\d+)_BIT");
                    pipelines[handle] = new Pipeline(attributes, bindings, samples.Success ? int.Parse(samples.Groups[1].Value) : 1);
                }
                if (handles.Count == 1) Set(args[5], handles[0]);
                else if (handles.Count > 1) Set(args[5], ShaderValue.Array(handles.ToArray()));
                return ShaderValue.Str("VK_SUCCESS");
            }

            // ---------- recording ----------
            case "vkCmdBindPipeline" when args.Count >= 3:
                boundPipeline = Handle(args[2]);
                return null;   // the frame recorder records it too
            case "vkCmdBeginRenderPass" when args.Count >= 2:
            {
                var info = Eval(Strip(args[1]));
                framebuffer = Text(info, "framebuffer");
                resolveView = framebuffer is not null && resolves.TryGetValue(framebuffer, out var rv) ? rv : null;
                var target = TargetOf(framebuffer);
                foreach (var clear in Items(Field(info, "pClearValues")))
                {
                    if (Field(clear, "color") is { } color)
                    {
                        var rgba = new List<double>();
                        CppExec.Flatten(color, rgba);
                        if (rgba.Count >= 3) Ops.Add(new ClearOp(DrawCount(), target, rgba.Take(4).ToArray(), null, null));
                    }
                    if (Field(clear, "depthStencil") is { } ds)
                    {
                        var v = new List<double>();
                        CppExec.Flatten(ds, v);
                        Ops.Add(new ClearOp(DrawCount(), target, null, v.Count > 0 ? v[0] : 1.0, v.Count > 1 ? (int)v[1] : 0));
                    }
                }
                return ShaderValue.Scalar(0);
            }
            case "vkCmdEndRenderPass":
                // The subpass's resolve attachment gets the multisampled colour image, resolved (vulkan-tutorial's
                // multisampling: into the swap chain image).
                if (resolveView is not null)
                {
                    Ops.Add(new CopyOp(DrawCount(), TargetOf(framebuffer), ViewTarget(resolveView)));
                    resolveView = null;
                }
                return null;
            case "vkCmdBindVertexBuffers" when args.Count >= 5:
            {
                int first = (int)Num(args[1]), count = (int)Num(args[2]);
                var bufs = Items(Eval(Strip(args[3])));
                var offs = Eval(Strip(args[4]));
                var offList = new List<double>();
                if (offs is not null) CppExec.Flatten(offs, offList);
                for (int i = 0; i < count && i < bufs.Length; i++)
                    if (bufs[i].Text is { } vb) vertexBuffers[first + i] = (vb, i < offList.Count ? (long)offList[i] : 0);
                return ShaderValue.Scalar(0);
            }
            case "vkCmdBindIndexBuffer" when args.Count >= 4:
                if (Handle(args[1]) is { } ib)
                    indexBuffer = (ib, (long)Num(args[2]), (Eval(args[3])?.Text ?? "").Contains("UINT16", StringComparison.Ordinal) ? 2 : 4);
                return ShaderValue.Scalar(0);
            case "vkCmdBindDescriptorSets" when args.Count >= 6:
            {
                int first = (int)Num(args[3]);
                var bound = Items(Eval(Strip(args[5])));
                for (int i = 0; i < bound.Length && i < Math.Max(1, (int)Num(args[4])); i++)
                    if (bound[i].Text is { } s) boundSets[first + i] = s;
                return null;   // the frame recorder records it too
            }
        }
        return null;
    }

    private string Set(Expr target, string kind)
    {
        var handle = New(kind);
        Set(target, ShaderValue.Str(handle));
        return handle;
    }

    private static int? MemoryIndex(string? handle) =>
        handle is not null && handle.StartsWith("mem:", StringComparison.Ordinal) && int.TryParse(handle[4..], out var m) ? m - 1 : null;

    private ImageObject? ImageOf(string? handle) =>
        handle is not null && handle.StartsWith("img:", StringComparison.Ordinal) && int.TryParse(handle[4..], out var i) && i >= 1 && i <= images.Count ? images[i - 1] : null;

    public ImageObject? Image(string id) => ImageOf(id);

    /// <summary>The render target of a framebuffer: its colour image ("img:N"), null for a swap chain image (the window).</summary>
    public string? TargetOf(string? fb) => fb is not null && framebuffers.TryGetValue(fb, out var view) ? ViewTarget(view) : null;

    /// <summary>The render target behind an image view: its image ("img:N"), null for a swap chain image (the window).</summary>
    private string? ViewTarget(string view) => views.TryGetValue(view, out var v) && ImageOf(v.Image) is { Window: false } img ? img.TargetId : null;

    private void Write(Expr dst, Expr from, Expr? size)
    {
        var address = Eval(dst) is { V: { Length: > 0 } v } ? v[0] : 0;
        if (address < AddressUnit) return;
        int m = (int)(address / AddressUnit) - 1;
        if (m < 0 || m >= memories.Count) return;
        long offset = (long)(address - (m + 1) * AddressUnit);
        var value = Eval(Strip(from));
        if (value is null) return;
        if (value.Text is { } key && loaded.ContainsKey(key))
        {
            memories[m].Images[offset] = key;
            return;
        }
        var numbers = new List<double>();
        CppExec.Flatten(value, numbers);
        // 16-bit indices (std::vector<uint16_t> indices) take 2 bytes each.
        int bytes = Strip(from) is Name n && src.DeclaredType(n.Id) is { } type
            && System.Text.RegularExpressions.Regex.IsMatch(type, @"uint16|int16|short", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ? 2 : 4;
        long limit = size is null ? long.MaxValue : (long)Num(size) * bytes / 4;
        for (int i = 0; i < numbers.Count && (long)i * bytes < limit; i++) memories[m].Bytes[offset + (long)i * bytes] = numbers[i];
    }

    private void Copy(string? from, long fromOffset, string? to, long toOffset, long bytes)
    {
        if (from is null || to is null || !buffers.TryGetValue(from, out var s) || !buffers.TryGetValue(to, out var d) || s.Memory < 0 || d.Memory < 0) return;
        var src = memories[s.Memory];
        var dst = memories[d.Memory];
        long a = s.Offset + fromOffset, b = d.Offset + toOffset;
        foreach (var (k, v) in src.Bytes.Where(kv => kv.Key >= a && kv.Key < a + bytes).ToList()) dst.Bytes[k - a + b] = v;
        foreach (var (k, v) in src.Images.Where(kv => kv.Key >= a && kv.Key < a + bytes).ToList()) dst.Images[k - a + b] = v;
    }

    /// <summary>Numbers of a buffer at a byte offset (from where it is bound in its memory).</summary>
    public double[]? Read(string buffer, long byteOffset, int comps)
    {
        if (!buffers.TryGetValue(buffer, out var place) || place.Memory < 0) return null;
        var mem = memories[place.Memory];
        long at = place.Offset + byteOffset;
        if (!mem.Bytes.ContainsKey(at)) return null;
        var r = new double[comps];
        for (int k = 0; k < comps; k++) r[k] = mem.Bytes.TryGetValue(at + k * 4, out var x) ? x : 0;
        return r;
    }

    public double? ReadIndex(string buffer, long byteOffset) =>
        buffers.TryGetValue(buffer, out var place) && place.Memory >= 0 && memories[place.Memory].Bytes.TryGetValue(place.Offset + byteOffset, out var x) ? x : null;

    /// <summary>The texture behind a binding of a descriptor set: a loaded image, a cube map or a render target.</summary>
    public (Texture? Texture, CubeTexture? Cube)? TextureAt(string set, int binding)
    {
        if (!sets.TryGetValue(set, out var bindings) || !bindings.TryGetValue(binding, out var b) || b.View is null || !views.TryGetValue(b.View, out var view)) return null;
        var img = ImageOf(view.Image);
        if (img is null) return (null, null);
        var sampler = b.Sampler is not null && samplers.TryGetValue(b.Sampler, out var st) ? st : SamplerState.Default;
        if (view.Cube || img.Cube)
            return (null, new CubeTexture(img.LayerImages.Select(i => i is null ? null : new Texture(i, sampler) { Components = 4 }).ToList()));
        if (img.LayerImages.FirstOrDefault() is { } image) return (new Texture(image, sampler) { Components = image.Channels == 4 ? 4 : 3 }, null);
        var id = img.TargetId;
        bool depth = img.Depth;
        return (new Texture(() => Raster.Rasterizer.TargetImage(id, 0, depth), sampler) { Components = 4 }, null);
    }

    public bool HasSet(string set) => sets.ContainsKey(set);
}
