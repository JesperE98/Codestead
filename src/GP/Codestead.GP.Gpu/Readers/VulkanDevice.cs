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
internal sealed partial class VulkanDevice : IDeviceModel
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
        public bool Cube, Depth, Float, Srgb;
        public string Format = "";
        public readonly List<Image?> LayerImages = new();
        public string TargetId => "img:" + Id;
        /// <summary>
        /// Mip levels that hold a picture: drawn into one by one (a view of one level in a framebuffer) or made from
        /// the level above (vkCmdBlitImage) – the render targets "img:N~level" hold levels 1 and up.
        /// </summary>
        public int TargetLevels = 1;
        /// <summary>The image is drawn into through views of single layers (one cube face per framebuffer).</summary>
        public bool PerLayer;
        /// <summary>A loaded image whose smaller mip levels were made with vkCmdBlitImage (vulkan-tutorial's generateMipmaps).</summary>
        public bool Mipmapped;

        public string LevelTarget(int level) => level > 0 ? $"{TargetId}~{level}" : TargetId;
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

    /// <summary>Every pipeline made: its handle → the SPIR-V files of its stages and its VkGraphicsPipelineCreateInfo.</summary>
    public Dictionary<string, (List<string> Files, ShaderValue Info)> CreatedPipelines { get; } = new(StringComparer.Ordinal);

    private readonly Dictionary<string, Pipeline> pipelines = new(StringComparer.Ordinal);
    private string? boundPipeline;

    public Pipeline? PipelineOf(string? handle) => handle is not null && pipelines.TryGetValue(handle, out var p) ? p : null;

    private const double AddressUnit = 1e9;

    private readonly GpuProject project;
    private readonly List<Memory> memories = new();
    private readonly Dictionary<string, (int Memory, long Offset)> buffers = new(StringComparer.Ordinal);
    private readonly List<ImageObject> images = new();
    /// <summary>Image views: the image and whether it is viewed as a cube map.</summary>
    private readonly Dictionary<string, (string Image, bool Cube, int Layer, int Level)> views = new(StringComparer.Ordinal);
    /// <summary>Image views with an sRGB format.</summary>
    private readonly HashSet<string> srgbViews = new(StringComparer.Ordinal);

    /// <summary>The swap chain's images have an sRGB format: what is drawn into them is encoded.</summary>
    public bool WindowSrgb { get; private set; }
    private readonly Dictionary<string, SamplerState> samplers = new(StringComparer.Ordinal);
    /// <summary>Framebuffers: their colour attachment's view (the render pass's colour attachment, else the first).</summary>
    private readonly Dictionary<string, string> framebuffers = new(StringComparer.Ordinal);
    /// <summary>Framebuffers whose render pass resolves the (multisampled) colour attachment: the resolve attachment's view.</summary>
    private readonly Dictionary<string, string> resolves = new(StringComparer.Ordinal);
    /// <summary>Render passes: the first subpass's colour attachment and resolve attachment (indices into the framebuffer's attachments).</summary>
    private readonly Dictionary<string, (int Color, int? Resolve, int[] Colors)> renderPasses = new(StringComparer.Ordinal);
    /// <summary>Per render pass: each attachment's loadOp, and which attachment is the depth one.</summary>
    private readonly Dictionary<string, (string[] LoadOps, int? Depth)> passLoads = new(StringComparer.Ordinal);
    /// <summary>Per framebuffer: its render pass and its attachments' views.</summary>
    private readonly Dictionary<string, (string? Pass, string?[] Views)> framebufferInfo = new(StringComparer.Ordinal);
    /// <summary>Which target drew into a depth image last (null: the window): a later pass that loads it continues from it.</summary>
    private readonly Dictionary<string, string?> depthOwner = new(StringComparer.Ordinal);
    /// <summary>
    /// The images behind a framebuffer's further colour attachments (multiple render targets: bloom's bright colour):
    /// image → (the target of the first colour attachment, the attachment number).
    /// </summary>
    private readonly Dictionary<string, (string Target, int Attachment)> attachmentOf = new(StringComparer.Ordinal);
    /// <summary>Per render target (its first colour image): how many colour attachments, and whether it has a depth attachment.</summary>
    private readonly Dictionary<string, (int Colors, bool Depth)> targetShape = new(StringComparer.Ordinal);

    public (int Colors, bool Depth)? ShapeOf(string target) => targetShape.TryGetValue(target, out var s) ? s : null;
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
        if (ValidationCall(name, args) is { } answered) return answered;
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
            case "stbi_load" or "stbi_loadf" when args.Count >= 5:
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
                // SFLOAT and UFLOAT (B10G11R11_UFLOAT_PACK32: an HDR target without sign or alpha) keep values above 1.
                img.Float = format.Contains("FLOAT", StringComparison.Ordinal) && !img.Depth;
                img.Srgb = format.Contains("_SRGB", StringComparison.Ordinal);
                img.Format = format;
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
                        // Pixels the program made itself (a glyph atlas): the bytes in the buffer, by the image's format.
                        if (image is null && BytesPerTexel(dst.Format) is int bpp and > 0 && dst.Width > 0 && dst.Height > 0)
                        {
                            long start = offset + (long)l * dst.Width * dst.Height * bpp;
                            if (mem.Bytes.ContainsKey(start) || mem.Bytes.Keys.Any(k => k >= start && k < start + (long)dst.Width * dst.Height * bpp))
                            {
                                int w = dst.Width, h = dst.Height;
                                var rgba = new byte[w * h * 4];
                                for (int t = 0; t < w * h; t++)
                                    for (int k = 0; k < 4; k++)
                                        rgba[t * 4 + k] = k < bpp ? (byte)Math.Clamp(mem.Bytes.TryGetValue(start + (long)t * bpp + k, out var texelByte) ? texelByte : 0, 0, 255) : (byte)(k == 3 ? 255 : 0);
                                image = new Image(w, h, bpp == 4 ? 4 : bpp, rgba);
                            }
                        }
                        while (dst.LayerImages.Count <= first + l) dst.LayerImages.Add(null);
                        dst.LayerImages[first + l] = image;
                    }
                }
                return ShaderValue.Scalar(0);
            }
            case "vkCmdBlitImage" when args.Count >= 7:
            {
                // A mip level made from the level above (vulkan-tutorial's generateMipmaps), of an image that was drawn
                // into: each layer's smaller copy is the average of the pixels it covers.
                if (ImageOf(Handle(args[1])) is not { Window: false } from || ImageOf(Handle(args[3])) is not { Window: false } to) return ShaderValue.Scalar(0);
                if (to.LayerImages.Any(i => i is not null) || from.LayerImages.Any(i => i is not null))
                {
                    // A loaded texture's levels made from level 0: sampled with mip levels from now on.
                    if (from == to) to.Mipmapped = true;
                    return ShaderValue.Scalar(0);
                }
                foreach (var region in Items(Eval(Strip(args[6]))))
                {
                    var srcSub = Field(region, "srcSubresource");
                    var dstSub = Field(region, "dstSubresource");
                    int srcLevel = (int)(Number(srcSub, "mipLevel") ?? 0), dstLevel = (int)(Number(dstSub, "mipLevel") ?? 0);
                    int srcLayer = (int)(Number(srcSub, "baseArrayLayer") ?? 0), dstLayer = (int)(Number(dstSub, "baseArrayLayer") ?? 0);
                    int layers = (int)Math.Max(1, Number(dstSub, "layerCount") ?? 1);
                    for (int l = 0; l < layers; l++)
                    {
                        string Layer(string level, int layer) => layer > 0 ? level + "@" + layer : level;
                        Ops.Add(new CopyOp(DrawCount(), Layer(from.LevelTarget(srcLevel), srcLayer + l), Layer(to.LevelTarget(dstLevel), dstLayer + l), Average: true));
                    }
                    to.TargetLevels = Math.Max(to.TargetLevels, dstLevel + 1);
                    if (layers > 1 || dstLayer > 0) to.PerLayer = true;
                }
                return ShaderValue.Scalar(0);
            }
            case "vkCreateImageView" when args.Count >= 4:
            {
                var info = Eval(Strip(args[1]));
                var view = Set(args[3], "view");
                // The first array layer (a cube map's face) and mip level the view shows: a framebuffer made with it draws
                // into that face and level.
                var range = Field(info, "subresourceRange");
                bool cubeView = (Text(info, "viewType") ?? "").Contains("CUBE", StringComparison.Ordinal);
                int baseLayer = (int)(Number(range, "baseArrayLayer") ?? 0), baseLevel = (int)(Number(range, "baseMipLevel") ?? 0);
                views[view] = (Text(info, "image") ?? "", cubeView, baseLayer, baseLevel);
                if (!cubeView && ImageOf(Text(info, "image")) is { Layers: > 1 } layered && (Number(range, "layerCount") ?? 1) <= 1) layered.PerLayer = true;
                if ((Text(info, "format") ?? "").Contains("_SRGB", StringComparison.Ordinal)) srgbViews.Add(view);
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
                var colorRefs = Items(Field(subpass, "pColorAttachments")).Take((int)(Number(subpass, "colorAttachmentCount") ?? int.MaxValue))
                    .Select(c => (int)(Number(c, "attachment") ?? 0)).ToArray();
                int color = colorRefs.Length > 0 ? colorRefs[0] : 0;
                var resolve = Number(Items(Field(subpass, "pResolveAttachments")).FirstOrDefault(), "attachment");
                var rp = Set(args[3], "rp");
                renderPasses[rp] = (color, resolve is null ? null : (int)resolve, colorRefs);
                var depthRef = Number(Field(subpass, "pDepthStencilAttachment"), "attachment");
                passLoads[rp] = (Items(Field(info, "pAttachments")).Select(a => Text(a, "loadOp") ?? "").ToArray(), depthRef is null ? null : (int)depthRef);
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkCreateFramebuffer" when args.Count >= 4:
            {
                var info = Eval(Strip(args[1]));
                var attachments = Items(Field(info, "pAttachments"));
                var fb = Set(args[3], "fb");
                framebufferInfo[fb] = (Text(info, "renderPass"), attachments.Select(a => a.Text).ToArray());
                var pass = Text(info, "renderPass") is { } rpName && renderPasses.TryGetValue(rpName, out var r) ? r : (0, null, [0]);
                if (pass.Color < attachments.Length && attachments[pass.Color].Text is { } colorView)
                {
                    framebuffers[fb] = colorView;
                    // A view of a mip level: that level is drawn into.
                    if (views.TryGetValue(colorView, out var cv) && cv.Level > 0 && ImageOf(cv.Image) is { } leveled) leveled.TargetLevels = Math.Max(leveled.TargetLevels, cv.Level + 1);
                }
                if (pass.Resolve is int ri && ri < attachments.Length && attachments[ri].Text is { } resolveTo) resolves[fb] = resolveTo;
                // The target's shape: its colour attachments (further ones are read as attachments 1, 2 … of it) and
                // whether any attachment is a depth image (a ping-pong blur pass has none: no depth test).
                if (TargetOf(fb) is { } target)
                {
                    for (int k = 1; k < pass.Colors.Length; k++)
                        if (pass.Colors[k] < attachments.Length && attachments[pass.Colors[k]].Text is { } extra && views.TryGetValue(extra, out var ev))
                            attachmentOf[ev.Image] = (target, k);
                    bool depth = attachments.Any(a => a.Text is { } av && views.TryGetValue(av, out var v) && ImageOf(v.Image) is { Depth: true });
                    // (Another framebuffer of the same image – a later pass without depth, weighted blended OIT's
                    // composite into the opaque image – keeps the depth buffer the first one gave it.)
                    targetShape[target] = targetShape.TryGetValue(target, out var before)
                        ? (Math.Max(before.Colors, Math.Max(1, pass.Colors.Length)), before.Depth || depth) : (Math.Max(1, pass.Colors.Length), depth);
                }
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
            case "chooseSwapSurfaceFormat" when exec.Runner is not null:
            {
                // The format the program asks for (availableFormat.format == VK_FORMAT_B8G8R8A8_UNORM): the simulated
                // surface offers it.
                var wanted = System.Text.RegularExpressions.Regex.Match(src.FunctionBody("chooseSwapSurfaceFormat") ?? "", @"\.format\s*==\s*(VK_FORMAT_\w+)");
                if (!wanted.Success) return null;
                return ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
                {
                    ["format"] = ShaderValue.Str(wanted.Groups[1].Value),
                    ["colorSpace"] = ShaderValue.Str("VK_COLOR_SPACE_SRGB_NONLINEAR_KHR"),
                });
            }
            case "vkCreateSwapchainKHR" when args.Count >= 2:
                WindowSrgb = (Text(Eval(Strip(args[1])), "imageFormat") ?? "").Contains("_SRGB", StringComparison.Ordinal);
                return null;
            case "vkGetPhysicalDeviceFormatProperties" when args.Count >= 3:
            {
                // The simulated GPU supports every format for what the tutorial asks of it.
                const string features = "VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT|VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT|VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT|VK_FORMAT_FEATURE_COLOR_ATTACHMENT_BIT|VK_FORMAT_FEATURE_COLOR_ATTACHMENT_BLEND_BIT|VK_FORMAT_FEATURE_TRANSFER_SRC_BIT|VK_FORMAT_FEATURE_TRANSFER_DST_BIT|VK_FORMAT_FEATURE_BLIT_SRC_BIT|VK_FORMAT_FEATURE_BLIT_DST_BIT";
                Set(args[2], ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
                {
                    ["linearTilingFeatures"] = ShaderValue.Str(features),
                    ["optimalTilingFeatures"] = ShaderValue.Str(features),
                    ["bufferFeatures"] = ShaderValue.Str("VK_FORMAT_FEATURE_VERTEX_BUFFER_BIT"),
                }));
                return ShaderValue.Scalar(0);
            }
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
                    CheckVertexInputs(info, attributes, handles.Count - 1);
                    // Its shaders (the files its modules were made of) and its create-info, for a program whose pipelines
                    // the reader cannot follow by name (kept in a std::map).
                    var stageFiles = Items(Field(info, "pStages")).Take((int)(Number(info, "stageCount") ?? int.MaxValue))
                        .Select(st => Text(st, "module") is { } module && moduleFiles.TryGetValue(module, out var file) ? file : null).Where(f => f is not null).Select(f => f!).ToList();
                    CreatedPipelines[handle] = (stageFiles, info.Clone());
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
                // Each attachment's loadOp: only CLEAR clears; a depth image loaded (LOAD) that another pass drew into
                // continues from that pass's depth (deferred shading's light cubes over the G-buffer's depth).
                bool clearColor = true, clearDepth = true;
                if (framebuffer is not null && framebufferInfo.TryGetValue(framebuffer, out var fbi) && fbi.Pass is { } passName && passLoads.TryGetValue(passName, out var loads))
                {
                    var colorIndex = renderPasses.TryGetValue(passName, out var rpi) ? rpi.Color : 0;
                    if (colorIndex < loads.LoadOps.Length && loads.LoadOps[colorIndex] is { Length: > 0 } colorLoad) clearColor = colorLoad.Contains("CLEAR", StringComparison.Ordinal);
                    if (loads.Depth is int di && di < loads.LoadOps.Length)
                    {
                        if (loads.LoadOps[di] is { Length: > 0 } depthLoad) clearDepth = depthLoad.Contains("CLEAR", StringComparison.Ordinal);
                        if (di < fbi.Views.Length && fbi.Views[di] is { } depthView && views.TryGetValue(depthView, out var dv))
                        {
                            if (!clearDepth && depthOwner.TryGetValue(dv.Image, out var owner) && owner != target)
                                Ops.Add(new CopyOp(DrawCount(), owner, target, Color: false, Depth: true));
                            depthOwner[dv.Image] = target;
                        }
                    }
                }
                // pClearValues[i] is attachment i's: a colour attachment's (colour k of the subpass: attachment k of the
                // target) when its loadOp clears, the depth attachment's.
                var passInfo = framebuffer is not null && framebufferInfo.TryGetValue(framebuffer, out var fbInfo) && fbInfo.Pass is { } pn
                    && renderPasses.TryGetValue(pn, out var rpInfo) && passLoads.TryGetValue(pn, out var passLoad) ? (rpInfo.Colors, passLoad.LoadOps, passLoad.Depth) : default;
                var clears = Items(Field(info, "pClearValues"));
                for (int i = 0; i < clears.Length; i++)
                {
                    var clear = clears[i];
                    int colorIndex = passInfo.Colors is null ? -1 : Array.IndexOf(passInfo.Colors, i);
                    bool known = passInfo.Colors is not null && (colorIndex >= 0 || passInfo.Depth == i);
                    bool loadClears = passInfo.LoadOps is null || i >= passInfo.LoadOps.Length || passInfo.LoadOps[i] is not { Length: > 0 } op || op.Contains("CLEAR", StringComparison.Ordinal);
                    if (Field(clear, "color") is { } color && (known ? colorIndex >= 0 && loadClears : clearColor))
                    {
                        var rgba = new List<double>();
                        CppExec.Flatten(color, rgba);
                        if (rgba.Count >= 3) Ops.Add(new ClearOp(DrawCount(), target, rgba.Take(4).ToArray(), null, null, known && passInfo.Colors!.Length > 1 ? colorIndex : null));
                    }
                    if (Field(clear, "depthStencil") is { } ds && (known ? passInfo.Depth == i && loadClears : clearDepth))
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
    private string? ViewTarget(string view)
    {
        if (!views.TryGetValue(view, out var v) || ImageOf(v.Image) is not { Window: false } img) return null;
        // "img:N", "img:N~2" for mip level 2, "…@3" for array layer (cube face) 3.
        var level = img.LevelTarget(v.Level);
        return v.Layer > 0 && !v.Cube ? level + "@" + v.Layer : level;
    }

    /// <summary>The image behind a target id ("img:N~2@3"), and the mip level it names.</summary>
    public (ImageObject Image, int Level)? TargetImage(string id)
    {
        var m = System.Text.RegularExpressions.Regex.Match(id, @"^(img:\d+)(?:~(\d+))?(?:@\d+)?$");
        return m.Success && ImageOf(m.Groups[1].Value) is { } img ? (img, m.Groups[2].Success ? int.Parse(m.Groups[2].Value) : 0) : null;
    }

    /// <summary>A recorded draw goes to an off-screen target (not to the window).</summary>
    public bool Offscreen(object? state) => state is DrawState { Framebuffer: { } fb } && TargetOf(fb) is not null;

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
        // 16-bit indices take 2 bytes each, bytes (std::vector<unsigned char>: a glyph atlas) 1.
        int bytes = 4;
        if (SourceName(Strip(from)) is { } n && src.DeclaredType(n) is { } type)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(type, @"uint16|int16|short", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) bytes = 2;
            else if (System.Text.RegularExpressions.Regex.IsMatch(type, @"char\b|uint8|int8|\bBYTE\b|stbi_uc|GLubyte", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) bytes = 1;
        }
        long limit = size is null ? long.MaxValue : bytes == 1 ? (long)Num(size) : (long)Num(size) * bytes / 4;
        for (int i = 0; i < numbers.Count && (long)i * bytes < limit; i++) memories[m].Bytes[offset + (long)i * bytes] = numbers[i];
    }

    /// <summary>The variable a memcpy source names: pixels, atlas.data(), &amp;atlas[0].</summary>
    private static string? SourceName(Expr e) => e switch
    {
        Name n => n.Id,
        Call { Function: ".data", Args: [var t] } => SourceName(t),
        IndexOf { Target: var t } => SourceName(t),
        Member m => m.Field,
        _ => null,
    };

    /// <summary>Bytes per texel of an 8-bit format the program fills itself (R8 … R8G8B8A8), or 0.</summary>
    private static int BytesPerTexel(string format) => format switch
    {
        _ when format.Contains("R8G8B8A8", StringComparison.Ordinal) || format.Contains("B8G8R8A8", StringComparison.Ordinal) => 4,
        _ when format.Contains("R8G8B8_", StringComparison.Ordinal) => 3,
        _ when format.Contains("R8G8_", StringComparison.Ordinal) => 2,
        _ when format.Contains("R8_", StringComparison.Ordinal) => 1,
        _ => 0,
    };

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
        // A further colour attachment of a target (bloom's bright colour): that attachment of the target's picture.
        if (attachmentOf.TryGetValue(view.Image, out var att))
            return (new Texture(() => Raster.Rasterizer.TargetImage(att.Target, att.Attachment, false), sampler) { Components = 4 }, null);
        if ((view.Cube || img.Cube) && img.LayerImages.All(i => i is null) && !img.Window)
        {
            // A cube map drawn into (point shadows: a 6-layer framebuffer, gl_Layer): face i is layer i of the target.
            bool cubeDepth = img.Depth;
            List<Texture?> Level(string target) => Enumerable.Range(0, 6).Select(face =>
                (Texture?)new Texture(() => Raster.Rasterizer.TargetImage(face == 0 ? target : target + "@" + face, 0, cubeDepth), sampler) { Components = 4 }).ToList();
            // Its mip levels, when they were drawn or made from level 0: read by textureLod.
            return (null, new CubeTexture(Level(img.TargetId))
            {
                Mips = img.TargetLevels > 1 ? Enumerable.Range(1, img.TargetLevels - 1).Select(level => (IReadOnlyList<Texture?>)Level(img.LevelTarget(level))).ToList() : null,
            });
        }
        if (view.Cube || img.Cube)
            return (null, new CubeTexture(img.LayerImages.Select(i => i is null ? null : new Texture(i, sampler) { Components = 4 }).ToList()));
        if (img.LayerImages.FirstOrDefault() is { } image)
            return (new Texture(image, sampler) { Components = image.Channels == 4 ? 4 : 3, Srgb = img.Srgb || srgbViews.Contains(b.View), Mipmapped = img.Mipmapped }, null);
        var id = img.TargetId;
        bool depth = img.Depth;
        return (new Texture(() => Raster.Rasterizer.TargetImage(id, 0, depth), sampler) { Components = 4 }, null);
    }

    public bool HasSet(string set) => sets.ContainsKey(set);
}
