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

        public Stages(DrawCall draw, double time, int height, double scale, bool yDown)
        {
            this.draw = draw;
            this.height = height;
            this.scale = scale;
            this.yDown = yDown;
            vs = new ShaderRunner(draw.VertexShader) { Time = time, Sample = draw.Textures };
            fs = new ShaderRunner(draw.FragmentShader) { Time = time, Sample = draw.Textures };
            var uniforms = draw.Uniforms(time);
            foreach (var (k, v) in uniforms)
            {
                SetUniform(vs, k, v);
                SetUniform(fs, k, v);
            }
            vsInputs = draw.VertexShader.Globals.Where(g => g.Storage == "in").ToList();
            vsOutputs = draw.VertexShader.Globals.Where(g => g.Storage == "out").ToList();
            fsInputs = draw.FragmentShader.Globals.Where(g => g.Storage == "in").ToList();
            fsOutput = draw.FragmentShader.Globals.Where(g => g.Storage == "out").OrderBy(g => g.Location ?? 0).FirstOrDefault();
            if (!draw.Hlsl)
            {
                if (draw.VertexShader.FindFunction("main") is null) throw new ShaderRuntimeException("the vertex shader has no main()", 0);
                if (draw.FragmentShader.FindFunction("main") is null) throw new ShaderRuntimeException("the fragment shader has no main()", 0);
                if (fsOutput is null) throw new ShaderRuntimeException("the fragment shader has no output (out vec4 …)", 0);
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
            return draw.Hlsl ? HlslVertex(data, index, instance) : GlslVertex(data, index, instance);
        }

        private ShadedVertex GlslVertex(Dictionary<string, ShaderValue> data, int index, int instance)
        {
            for (int i = 0; i < vsInputs.Count; i++)
            {
                var g = vsInputs[i];
                int loc = g.Location ?? i;
                vs.Globals[g.Id] = Sized(g.Type, data.TryGetValue(loc.ToString(), out var v) ? v : null);
            }
            vs.Globals["gl_VertexID"] = vs.Globals["gl_VertexIndex"] = ShaderValue.Scalar(index);
            vs.Globals["gl_InstanceID"] = vs.Globals["gl_InstanceIndex"] = ShaderValue.Scalar(instance);
            vs.Globals["gl_Position"] = ShaderValue.Vec(0, 0, 0, 1);
            vs.Call("main", []);
            var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            for (int i = 0; i < vsOutputs.Count; i++)
            {
                var g = vsOutputs[i];
                var value = vs.Globals[g.Id].Clone();
                outputs[g.Id] = value;
                outputs["@" + (g.Location ?? i)] = value;
            }
            return new ShadedVertex(vs.Globals["gl_Position"].Padded(4), outputs);
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

        public double[]? Fragment(ShadedVertex[] vs3, double p0, double p1, double p2, double x, double y, double z, double invW)
        {
            Dictionary<string, ShaderValue> Interp()
            {
                var d = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                foreach (var (k, a) in vs3[0].Outputs)
                {
                    if (a.V is null || a.IsMatrix || !vs3[1].Outputs.TryGetValue(k, out var b) || !vs3[2].Outputs.TryGetValue(k, out var c) || b.V is null || c.V is null)
                    {
                        d[k] = a;
                        continue;
                    }
                    var r = new double[a.V.Length];
                    for (int i = 0; i < r.Length; i++) r[i] = p0 * a.V[i] + p1 * b.V[Math.Min(i, b.V.Length - 1)] + p2 * c.V[Math.Min(i, c.V.Length - 1)];
                    d[k] = ShaderValue.Vec(r);
                }
                return d;
            }
            var varyings = Interp();
            // Window coordinates of the real window: OpenGL counts y from the bottom, Vulkan and DirectX from the top.
            double fx = x * scale, fy = (yDown || draw.Hlsl ? y : height - y) * scale;
            var fragCoord = ShaderValue.Vec(fx, fy, z, invW);
            return draw.Hlsl ? HlslFragment(varyings, fragCoord) : GlslFragment(varyings, fragCoord);
        }

        private double[]? GlslFragment(Dictionary<string, ShaderValue> varyings, ShaderValue fragCoord)
        {
            for (int i = 0; i < fsInputs.Count; i++)
            {
                var g = fsInputs[i];
                var key = draw.MatchByLocation ? "@" + (g.Location ?? i) : g.Id;
                fs.Globals[g.Id] = varyings.TryGetValue(key, out var v) ? v : fs.Default(g.Type);
            }
            fs.Globals["gl_FragCoord"] = fragCoord;
            var r = fs.Call("main", []);
            _ = r;
            if (fs.Discarded)
            {
                ResetDiscard();
                return null;
            }
            return fs.Globals[fsOutput!.Id].Padded(4);
        }

        private double[]? HlslFragment(Dictionary<string, ShaderValue> varyings, ShaderValue fragCoord)
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
                        else if (field.Semantic is not null && varyings.TryGetValue("@" + Semantic(field.Semantic), out var v)) fields[field.Id] = v;
                        else fields[field.Id] = varyings.TryGetValue(field.Id, out var v2) ? v2 : fs.Default(field.Type);
                    }
                    args.Add(ShaderValue.Struct(fields));
                }
                else if (IsPosition(p.Semantic)) args.Add(fragCoord);
                else args.Add(p.Semantic is not null && varyings.TryGetValue("@" + Semantic(p.Semantic), out var v) ? v : fs.Default(p.Type));
            }
            var result = fs.Call(f.Id, args);
            if (fs.Discarded)
            {
                ResetDiscard();
                return null;
            }
            return (result ?? ShaderValue.Vec(0, 0, 0, 1)).Padded(4);
        }

        private void ResetDiscard() => fs.ClearDiscard();
    }
}
