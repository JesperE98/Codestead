using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Raster;

// The programmable stages: the vertex shader per vertex and the fragment shader per pixel, for GLSL (main with
// in/out globals and gl_Position) and HLSL (entry points with semantics).
public static partial class Rasterizer
{
    private sealed class Stages
    {
        private readonly DrawCall draw;
        private readonly ShaderRunner vs;
        private readonly ShaderRunner fs;
        private readonly int height;
        private readonly double scale;
        private readonly bool yDown;
        private readonly List<Global> vsInputs;
        private readonly List<Global> vsOutputs;
        private readonly List<Global> fsInputs;
        private readonly Global? fsOutput;
        /// <summary>The fragment shader's outputs by colour attachment (layout(location = n) out …).</summary>
        private readonly Global?[] fsOutputs;
        /// <summary>
        /// The GLSL fragment shader's outputs as they start: every fragment starts from them, so an output a shader
        /// leaves unwritten reads the same whichever fragment the runner shaded before (fragments run on several threads).
        /// </summary>
        private readonly (string Id, ShaderValue Value)[] fsInitialOutputs;
        private readonly ShaderRunner? gs;
        private readonly List<Global> gsInputs = new();
        private readonly List<Global> gsOutputs = new();

        public bool HasGeometry => gs is not null;

        /// <summary>The fragment shader writes its own depth (gl_FragDepth, an SV_Depth output).</summary>
        public bool WritesDepth { get; }

        /// <summary>The depth the last fragment wrote (0–1), when <see cref="WritesDepth"/>.</summary>
        public double? FragDepth { get; private set; }

        /// <summary>A worker's record of the rows it changed in the current batch (null on the draw's own thread).</summary>
        public RowLog? Log { get; set; }

        /// <summary>
        /// The stages of a draw with its uniforms (draw.Uniforms(time), worked out once per draw) and the textures it
        /// samples (the draw's own, or guarded ones for worker threads: <see cref="TextureReads.Shared"/>).
        /// </summary>
        public Stages(DrawCall draw, Dictionary<string, ShaderValue> uniforms, TextureReads textures, double time, int height, double scale, bool yDown)
        {
            this.draw = draw;
            this.height = height;
            this.scale = scale;
            this.yDown = yDown;
            vs = new ShaderRunner(draw.VertexShader) { Time = time, Sample = textures.Sample, SampleCube = textures.SampleCube, TextureSize = textures.Size };
            fs = new ShaderRunner(draw.FragmentShader) { Time = time, Sample = textures.Sample, SampleCube = textures.SampleCube, TextureSize = textures.Size };
            if (draw.GeometryShader is { } geometry)
            {
                gs = new ShaderRunner(geometry) { Time = time, Sample = textures.Sample, SampleCube = textures.SampleCube, TextureSize = textures.Size };
                gsInputs = geometry.Globals.Where(g => g.Storage == "in").ToList();
                gsOutputs = geometry.Globals.Where(g => g.Storage == "out").ToList();
            }
            foreach (var (k, v) in uniforms)
            {
                SetUniform(vs, k, v);
                SetUniform(fs, k, v);
                if (gs is not null) SetUniform(gs, k, v);
            }
            WritesDepth = draw.Hlsl
                ? draw.FragmentShader.Structs.Any(st => st.Fields.Any(f => string.Equals(f.Semantic, "SV_Depth", StringComparison.OrdinalIgnoreCase)))
                    || string.Equals(draw.FragmentShader.FindFunction(draw.FragmentEntry)?.Semantic, "SV_Depth", StringComparison.OrdinalIgnoreCase)
                : draw.FragmentShader.Names.Contains("gl_FragDepth");
            vsInputs = draw.VertexShader.Globals.Where(g => g.Storage == "in").ToList();
            vsOutputs = draw.VertexShader.Globals.Where(g => g.Storage == "out").ToList();
            fsInputs = draw.FragmentShader.Globals.Where(g => g.Storage == "in").ToList();
            var outs = draw.FragmentShader.Globals.Where(g => g.Storage == "out").ToList();
            fsOutput = outs.OrderBy(g => g.Location ?? 0).FirstOrDefault();
            fsOutputs = new Global?[outs.Count == 0 ? 0 : outs.Select((g, i) => g.Location ?? i).Max() + 1];
            for (int i = 0; i < outs.Count; i++) fsOutputs[outs[i].Location ?? i] = outs[i];
            fsInitialOutputs = outs.Where(g => g.Block is null && fs.Globals.ContainsKey(g.Id)).Select(g => (g.Id, fs.Globals[g.Id].Clone())).ToArray();
            if (!draw.Hlsl)
            {
                if (draw.VertexShader.FindFunction("main") is null) throw new ShaderRuntimeException("the vertex shader has no main()", 0);
                if (draw.FragmentShader.FindFunction("main") is null) throw new ShaderRuntimeException("the fragment shader has no main()", 0);
                // A depth-only pass (a shadow map: an off-screen target, glDrawBuffer(GL_NONE)) needs no colour output.
                if (fsOutput is null && draw.Target is null) throw new ShaderRuntimeException("the fragment shader has no output (out vec4 …)", 0);
            }
        }

        /// <summary>
        /// Sets a uniform by its name as the program uses it: a global ("transform"), a field of a struct or block
        /// ("material.shininess", "ubo.view"), an array element ("pointLights[0].position"), or a field of a block found
        /// by the field's name alone (push constants and cbuffers).
        /// </summary>
        private static void SetUniform(ShaderRunner runner, string key, ShaderValue value)
        {
            var parts = System.Text.RegularExpressions.Regex.Matches(key, @"(\w+)|\[(\d+)\]").Select(m => m.Groups[1].Success ? m.Groups[1].Value : "#" + m.Groups[2].Value).ToList();
            if (parts.Count == 0) return;
            if (runner.Globals.TryGetValue(parts[0], out var root))
            {
                if (parts.Count == 1)
                {
                    Assign(runner.Globals, parts[0], value);
                    return;
                }
                var owner = root;
                for (int i = 1; i < parts.Count; i++)
                {
                    bool last = i == parts.Count - 1;
                    if (parts[i].StartsWith('#'))
                    {
                        int at = int.Parse(parts[i][1..]);
                        if (owner.Items is null || at >= owner.Items.Length) return;
                        if (last)
                        {
                            owner.Items[at] = value;
                            return;
                        }
                        owner = owner.Items[at];
                    }
                    else
                    {
                        if (owner.Fields is null) return;
                        if (last)
                        {
                            Assign(owner.Fields, parts[i], value);
                            return;
                        }
                        if (!owner.Fields.TryGetValue(parts[i], out var next)) return;
                        owner = next;
                    }
                }
                return;
            }
            var name = parts[^1];
            foreach (var g in runner.Globals.Values)
                if (g.Fields is not null && g.Fields.ContainsKey(name))
                {
                    Assign(g.Fields, name, value);
                    return;
                }
        }

        private static void Assign(Dictionary<string, ShaderValue> into, string name, ShaderValue value)
        {
            if (into.TryGetValue(name, out var old) && old.V is not null && value.V is not null && !old.IsMatrix && !value.IsMatrix && old.V.Length != value.V.Length)
                value = ShaderValue.Vec(value.Padded(old.V.Length));
            into[name] = value;
        }

        private static ShaderValue Sized(string type, ShaderValue? v)
        {
            int n = Math.Max(1, ShaderRunnerTypes.Components(type));
            // Missing components of a vertex attribute are filled in as (0, 0, 0, 1).
            return ShaderValue.Vec((v ?? ShaderValue.Vec()).Padded(n));
        }

        public ShadedVertex Vertex(int index, int instance)
        {
            var data = index >= 0 && index < draw.Vertices.Count ? draw.Vertices[index] : new Dictionary<string, ShaderValue>();
            if (draw.InstanceVertices is { Count: > 0 } perInstance)
            {
                // Per-instance attributes: the same values for every vertex of an instance.
                var extra = perInstance[Math.Min(perInstance.Count - 1, instance / Math.Max(1, draw.InstanceDivisor))];
                data = new Dictionary<string, ShaderValue>(data, StringComparer.Ordinal);
                foreach (var (k, v) in extra) data[k] = v;
            }
            return draw.Hlsl ? HlslVertex(data, index, instance) : GlslVertex(data, index, instance);
        }

        private ShadedVertex GlslVertex(Dictionary<string, ShaderValue> data, int index, int instance)
        {
            for (int i = 0; i < vsInputs.Count; i++)
            {
                var g = vsInputs[i];
                int loc = g.Location ?? i;
                if (g.Type is "mat4" or "mat3" or "mat2")
                {
                    // A matrix attribute takes one location per column (learnopengl's instanced aInstanceMatrix).
                    int n = g.Type[3] - '0';
                    var cols = new double[n * n];
                    for (int c = 0; c < n; c++)
                    {
                        var col = (data.TryGetValue((loc + c).ToString(), out var cv) ? cv : null)?.Padded(n) ?? new double[n];
                        for (int r = 0; r < n; r++) cols[c * n + r] = col[r];
                    }
                    vs.Globals[g.Id] = ShaderValue.Matrix(n, cols);
                    continue;
                }
                vs.Globals[g.Id] = Sized(g.Type, data.TryGetValue(loc.ToString(), out var v) ? v : null);
            }
            vs.Globals["gl_VertexID"] = vs.Globals["gl_VertexIndex"] = ShaderValue.Scalar(index);
            vs.Globals["gl_InstanceID"] = vs.Globals["gl_InstanceIndex"] = ShaderValue.Scalar(instance);
            vs.Globals["gl_Position"] = ShaderValue.Vec(0, 0, 0, 1);
            vs.Globals["gl_PointSize"] = ShaderValue.Scalar(double.NaN);
            vs.Call("main", []);
            var size = vs.Globals["gl_PointSize"].X;
            return new ShadedVertex(vs.Globals["gl_Position"].Padded(4), Outputs(vs, vsOutputs), double.IsNaN(size) ? null : size);
        }

        /// <summary>The outputs of a GLSL stage, by name, by "@location" and, for an interface block, by "block:Type".</summary>
        private static Dictionary<string, ShaderValue> Outputs(ShaderRunner runner, List<Global> globals)
        {
            var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            for (int i = 0; i < globals.Count; i++)
            {
                var g = globals[i];
                var key = g.Block is not null && g.Id == "" ? null : g.Id;
                ShaderValue value;
                if (key is null)
                    value = ShaderValue.Struct(g.Block!.ToDictionary(f => f.Id, f => runner.Globals.TryGetValue(f.Id, out var v) ? v.Clone() : ShaderValue.Scalar(0)));
                else if (!runner.Globals.TryGetValue(key, out var v)) continue;
                else value = v.Clone();
                if (key is not null) outputs[key] = value;
                outputs["@" + (g.Location ?? i)] = value;
                if (g.Block is not null) outputs["block:" + g.Type] = value;
            }
            return outputs;
        }

        /// <summary>The key a GLSL stage's input is matched by: the block name, the location (Vulkan) or the name.</summary>
        private string InputKey(Global g, int i) =>
            g.Block is not null && !draw.MatchByLocation ? "block:" + g.Type : draw.MatchByLocation ? "@" + (g.Location ?? i) : g.Id;

        /// <summary>Sets a GLSL stage's input (a block without an instance name puts its fields in the globals).</summary>
        private static void SetInput(ShaderRunner runner, Global g, ShaderValue value)
        {
            if (g.Block is not null && g.Id == "" && value.Fields is not null)
            {
                foreach (var (k, v) in value.Fields) runner.Globals[k] = v;
                return;
            }
            runner.Globals[g.Id] = value;
        }

        private ShadedVertex HlslVertex(Dictionary<string, ShaderValue> data, int index, int instance)
        {
            var f = draw.VertexShader.FindFunction(draw.VertexEntry) ?? throw new ShaderRuntimeException($"the vertex shader has no function '{draw.VertexEntry}'", 0);
            var args = new List<ShaderValue>();
            foreach (var p in f.Params)
            {
                if (draw.VertexShader.FindStruct(p.Type) is { } st)
                    args.Add(ShaderValue.Struct(st.Fields.ToDictionary(fl => fl.Id, fl => FromSemantic(fl.Type, fl.Semantic, data, index, instance))));
                else args.Add(FromSemantic(p.Type, p.Semantic, data, index, instance));
            }
            var result = vs.Call(f.Id, args) ?? throw new ShaderRuntimeException($"'{f.Id}' returns nothing", f.Line);
            var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            double[]? clip = null;
            if (result.Fields is not null && draw.VertexShader.FindStruct(f.ReturnType) is { } rs)
            {
                foreach (var field in rs.Fields)
                {
                    var value = result.Fields[field.Id];
                    if (IsPosition(field.Semantic)) clip = value.Padded(4);
                    outputs[field.Id] = value;
                    if (field.Semantic is not null) outputs["@" + Semantic(field.Semantic)] = value;
                }
            }
            else if (IsPosition(f.Semantic)) clip = result.Padded(4);
            return new ShadedVertex(clip ?? throw new ShaderRuntimeException($"'{f.Id}' returns no SV_POSITION", f.Line), outputs);
        }

        private static bool IsPosition(string? semantic) => semantic is not null && semantic.Equals("SV_POSITION", StringComparison.OrdinalIgnoreCase);

        /// <summary>POSITION → POSITION0, TEXCOORD1 stays.</summary>
        internal static string Semantic(string s) => char.IsDigit(s[^1]) ? s.ToUpperInvariant() : s.ToUpperInvariant() + "0";

        private static ShaderValue FromSemantic(string type, string? semantic, Dictionary<string, ShaderValue> data, int index, int instance)
        {
            if (semantic is null) return Sized(type, null);
            if (semantic.Equals("SV_VertexID", StringComparison.OrdinalIgnoreCase)) return ShaderValue.Scalar(index);
            if (semantic.Equals("SV_InstanceID", StringComparison.OrdinalIgnoreCase)) return ShaderValue.Scalar(instance);
            return Sized(type, data.TryGetValue(Semantic(semantic), out var v) ? v : null);
        }

        public double[]?[]? Fragment(ShadedVertex[] vs3, double p0, double p1, double p2, double x, double y, double z, double invW, bool front)
        {
            Dictionary<string, ShaderValue> Interp()
            {
                var d = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                foreach (var (k, a) in vs3[0].Outputs)
                {
                    if (!vs3[1].Outputs.TryGetValue(k, out var b) || !vs3[2].Outputs.TryGetValue(k, out var c))
                    {
                        d[k] = a;
                        continue;
                    }
                    d[k] = Interpolate(a, b, c, p0, p1, p2);
                }
                return d;
            }
            var varyings = Interp();
            // Window coordinates of the real window: OpenGL counts y from the bottom, Vulkan and DirectX from the top.
            double fx = x * scale, fy = (yDown || draw.Hlsl ? y : height - y) * scale;
            var fragCoord = ShaderValue.Vec(fx, fy, z, invW);
            return draw.Hlsl ? HlslFragment(varyings, fragCoord, front) : GlslFragment(varyings, fragCoord, front);
        }

        /// <summary>
        /// Perspective-correct interpolation of numbers, struct fields and array items. Equal values stay exactly equal
        /// (flat integers such as a material index).
        /// </summary>
        private static ShaderValue Interpolate(ShaderValue a, ShaderValue b, ShaderValue c, double p0, double p1, double p2)
        {
            if (a.V is not null && !a.IsMatrix && b.V is not null && c.V is not null)
            {
                if (a.V.AsSpan().SequenceEqual(b.V) && a.V.AsSpan().SequenceEqual(c.V)) return a;
                var r = new double[a.V.Length];
                for (int i = 0; i < r.Length; i++) r[i] = p0 * a.V[i] + p1 * b.V[Math.Min(i, b.V.Length - 1)] + p2 * c.V[Math.Min(i, c.V.Length - 1)];
                return ShaderValue.Vec(r);
            }
            if (a.Fields is not null && b.Fields is not null && c.Fields is not null)
                return ShaderValue.Struct(a.Fields.ToDictionary(kv => kv.Key,
                    kv => b.Fields.TryGetValue(kv.Key, out var fb) && c.Fields.TryGetValue(kv.Key, out var fc) ? Interpolate(kv.Value, fb, fc, p0, p1, p2) : kv.Value));
            if (a.Items is not null && b.Items is not null && c.Items is not null && a.Items.Length == b.Items.Length && a.Items.Length == c.Items.Length)
                return ShaderValue.Array(a.Items.Select((x, i) => Interpolate(x, b.Items[i], c.Items[i], p0, p1, p2)).ToArray());
            return a;
        }

        private double[]?[]? GlslFragment(Dictionary<string, ShaderValue> varyings, ShaderValue fragCoord, bool front)
        {
            for (int i = 0; i < fsInputs.Count; i++)
            {
                var g = fsInputs[i];
                if (varyings.TryGetValue(InputKey(g, i), out var v)) SetInput(fs, g, v);
                else if (g.Block is null) fs.Globals[g.Id] = fs.Default(g.Type);
            }
            fs.Globals["gl_FragCoord"] = fragCoord;
            fs.Globals["gl_FrontFacing"] = ShaderValue.Scalar(front ? 1 : 0);
            foreach (var (id, value) in fsInitialOutputs) fs.Globals[id] = value.Clone();
            // gl_FragDepth starts as the fragment's own depth (in window depth 0–1).
            if (WritesDepth) fs.Globals["gl_FragDepth"] = ShaderValue.Scalar(fragCoord.V![2]);
            fs.Call("main", []);
            if (WritesDepth) FragDepth = fs.Globals.TryGetValue("gl_FragDepth", out var fd) ? fd.X : fragCoord.V![2];
            if (fs.Discarded)
            {
                ResetDiscard();
                return null;
            }
            return fsOutputs.Select(o => o is null ? null : fs.Globals[o.Id].V is { } v ? v.ToArray() : null).ToArray();
        }

        private double[]?[]? HlslFragment(Dictionary<string, ShaderValue> varyings, ShaderValue fragCoord, bool front)
        {
            var f = draw.FragmentShader.FindFunction(draw.FragmentEntry) ?? throw new ShaderRuntimeException($"the pixel shader has no function '{draw.FragmentEntry}'", 0);
            var args = new List<ShaderValue>();
            foreach (var p in f.Params)
            {
                if (draw.FragmentShader.FindStruct(p.Type) is { } st)
                {
                    var fields = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                    foreach (var field in st.Fields)
                    {
                        if (IsPosition(field.Semantic)) fields[field.Id] = fragCoord;
                        else if (IsFrontFace(field.Semantic)) fields[field.Id] = ShaderValue.Scalar(front ? 1 : 0);
                        else if (field.Semantic is not null && varyings.TryGetValue("@" + Semantic(field.Semantic), out var v)) fields[field.Id] = v;
                        else fields[field.Id] = varyings.TryGetValue(field.Id, out var v2) ? v2 : fs.Default(field.Type);
                    }
                    args.Add(ShaderValue.Struct(fields));
                }
                else if (IsPosition(p.Semantic)) args.Add(fragCoord);
                else if (IsFrontFace(p.Semantic)) args.Add(ShaderValue.Scalar(front ? 1 : 0));
                else args.Add(p.Semantic is not null && varyings.TryGetValue("@" + Semantic(p.Semantic), out var v) ? v : fs.Default(p.Type));
            }
            var result = fs.Call(f.Id, args);
            if (fs.Discarded)
            {
                ResetDiscard();
                return null;
            }
            // float PSMain(…) : SV_Depth – the value is the depth, no colour.
            if (string.Equals(f.Semantic, "SV_Depth", StringComparison.OrdinalIgnoreCase))
            {
                FragDepth = result?.X ?? fragCoord.V![2];
                return [];
            }
            result ??= ShaderValue.Vec(0, 0, 0, 1);
            if (WritesDepth)
            {
                // An SV_Depth output (the point shadows' distance): the fragment's depth from now on.
                var depthField = draw.FragmentShader.FindStruct(f.ReturnType)?.Fields.FirstOrDefault(x => string.Equals(x.Semantic, "SV_Depth", StringComparison.OrdinalIgnoreCase));
                FragDepth = depthField is not null && result.Fields?.TryGetValue(depthField.Id, out var dv) == true ? dv.X : fragCoord.V![2];
            }
            // A struct with SV_Target0, SV_Target1 …: one colour per render target.
            if (result.Fields is not null && draw.FragmentShader.FindStruct(f.ReturnType) is { } rs)
            {
                var targets = new List<double[]?>();
                foreach (var field in rs.Fields)
                {
                    if (field.Semantic is null || !field.Semantic.StartsWith("SV_TARGET", StringComparison.OrdinalIgnoreCase)) continue;
                    int n = field.Semantic.Length > 9 && int.TryParse(field.Semantic[9..], out var k) ? k : 0;
                    while (targets.Count <= n) targets.Add(null);
                    targets[n] = result.Fields.TryGetValue(field.Id, out var v) && v.V is not null ? v.V.ToArray() : null;
                }
                return targets.ToArray();
            }
            return [result.V?.ToArray() ?? [0, 0, 0, 1]];
        }

        private static bool IsFrontFace(string? semantic) => semantic is not null && semantic.Equals("SV_IsFrontFace", StringComparison.OrdinalIgnoreCase);

        private void ResetDiscard() => fs.ClearDiscard();

        /// <summary>
        /// Runs the geometry shader on one input primitive and returns the primitives it emits: points, the lines of a
        /// line strip or the triangles of a triangle strip (EndPrimitive / RestartStrip starts a new strip).
        /// </summary>
        public List<(Topology Kind, ShadedVertex[] Vertices)> Geometry(ShadedVertex[] input)
        {
            var geometry = draw.GeometryShader!;
            var strips = new List<List<ShadedVertex>> { new() };
            if (draw.Hlsl)
            {
                var f = geometry.FindFunction(draw.GeometryEntry) ?? throw new ShaderRuntimeException($"the geometry shader has no function '{draw.GeometryEntry}'", 0);
                var args = new List<ShaderValue>();
                foreach (var p in f.Params)
                {
                    if (p.Out)
                    {
                        args.Add(ShaderValue.Scalar(0));
                        continue;
                    }
                    var st = geometry.FindStruct(p.Type);
                    args.Add(ShaderValue.Array(input.Select(v => st is null ? ShaderValue.Vec(v.Clip)
                        : ShaderValue.Struct(st.Fields.ToDictionary(fl => fl.Id, fl => IsPosition(fl.Semantic) ? ShaderValue.Vec(v.Clip)
                            : v.Outputs.TryGetValue(fl.Id, out var o) ? o : fl.Semantic is not null && v.Outputs.TryGetValue("@" + Semantic(fl.Semantic), out var o2) ? o2 : gs!.Default(fl.Type)))).ToArray()));
                }
                gs!.Emit = (kind, value) =>
                {
                    if (kind == "RestartStrip")
                    {
                        strips.Add(new());
                        return;
                    }
                    if (value?.Fields is null) return;
                    var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                    double[]? clip = null;
                    int layer = 0;
                    var outStruct = geometry.Structs.FirstOrDefault(st => st.Fields.Select(x => x.Id).ToHashSet().SetEquals(value.Fields.Keys));
                    foreach (var (k, v) in value.Fields)
                    {
                        outputs[k] = v.Clone();
                        var semantic = outStruct?.Fields.FirstOrDefault(x => x.Id == k)?.Semantic;
                        if (IsPosition(semantic)) clip = v.Padded(4);
                        else if (string.Equals(semantic, "SV_RenderTargetArrayIndex", StringComparison.OrdinalIgnoreCase)) layer = (int)v.X;
                        else if (semantic is not null) outputs["@" + Semantic(semantic)] = outputs[k];
                    }
                    strips[^1].Add(new ShadedVertex(clip ?? [0, 0, 0, 1], outputs, null, layer));
                };
                gs.Call(f.Id, args);
            }
            else
            {
                gs!.Globals["gl_in"] = ShaderValue.Array(input.Select(v => ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
                {
                    ["gl_Position"] = ShaderValue.Vec(v.Clip),
                    ["gl_PointSize"] = ShaderValue.Scalar(v.PointSize ?? 1),
                })).ToArray());
                for (int i = 0; i < gsInputs.Count; i++)
                {
                    var g = gsInputs[i];
                    var key = InputKey(g, i);
                    gs.Globals[g.Id == "" ? g.Type : g.Id] = ShaderValue.Array(input.Select(v => v.Outputs.TryGetValue(key, out var o) ? o : gs.Default(g.Type)).ToArray());
                }
                gs.Globals["gl_PrimitiveIDIn"] = ShaderValue.Scalar(0);
                gs.Emit = (kind, _) =>
                {
                    if (kind == "EndPrimitive")
                    {
                        strips.Add(new());
                        return;
                    }
                    var position = gs.Globals.TryGetValue("gl_Position", out var p) ? p.Padded(4) : [0, 0, 0, 1];
                    int layer = gs.Globals.TryGetValue("gl_Layer", out var l) ? (int)l.X : 0;
                    strips[^1].Add(new ShadedVertex(position, Outputs(gs, gsOutputs), null, layer));
                };
                gs.Globals["gl_Position"] = ShaderValue.Vec(0, 0, 0, 1);
                gs.Globals["gl_Layer"] = ShaderValue.Scalar(0);
                gs.Call("main", []);
            }
            var result = new List<(Topology, ShadedVertex[])>();
            foreach (var strip in strips)
            {
                switch (geometry.OutputPrimitive)
                {
                    case "points":
                        result.AddRange(strip.Select(v => (Topology.Points, new[] { v })));
                        break;
                    case "line_strip":
                        for (int i = 0; i + 1 < strip.Count; i++) result.Add((Topology.Lines, new[] { strip[i], strip[i + 1] }));
                        break;
                    default:
                        for (int i = 0; i + 2 < strip.Count; i++)
                            result.Add((Topology.Triangles, i % 2 == 0 ? new[] { strip[i], strip[i + 1], strip[i + 2] } : new[] { strip[i + 1], strip[i], strip[i + 2] }));
                        break;
                }
            }
            return result;
        }
    }
}
