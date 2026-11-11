using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Raster;

// The tessellation stages: the control shader (GLSL tessellation control / HLSL hull shader and its patch constant
// function) once per patch, the fixed-function tessellator, and the evaluation shader (GLSL tessellation evaluation /
// HLSL domain shader) once per vertex it makes.
public static partial class Rasterizer
{
    private sealed partial class Stages
    {
        private ShaderRunner? tcs, tes;
        private List<Global> tcsInputs = new(), tcsOutputs = new(), tesInputs = new(), tesOutputs = new();

        public bool HasTessellation => tes is not null;

        /// <summary>Makes the runners of the tessellation stages (from the constructor), with the draw's uniforms.</summary>
        private void TessellationStages(TextureReads textures, double time, Dictionary<string, ShaderValue> uniforms)
        {
            if (draw.TessEvalShader is not { } evaluation) return;
            tes = new ShaderRunner(evaluation) { Time = time, Sample = textures.Sample, SampleCube = textures.SampleCube, SampleCubeLod = textures.SampleCubeLod, TextureImage = textures.Size };
            tesInputs = evaluation.Globals.Where(g => g.Storage == "in").ToList();
            tesOutputs = evaluation.Globals.Where(g => g.Storage == "out").ToList();
            if (draw.TessControlShader is { } control)
            {
                tcs = new ShaderRunner(control) { Time = time, Sample = textures.Sample, SampleCube = textures.SampleCube, SampleCubeLod = textures.SampleCubeLod, TextureImage = textures.Size };
                tcsInputs = control.Globals.Where(g => g.Storage == "in").ToList();
                tcsOutputs = control.Globals.Where(g => g.Storage == "out").ToList();
            }
            foreach (var (k, v) in uniforms)
            {
                SetUniform(tes, k, v);
                if (tcs is not null) SetUniform(tcs, k, v);
            }
        }

        /// <summary>A control point after the control stage, and what the patch as a whole carries (its levels, patch outputs).</summary>
        private sealed record Patch(List<ShadedVertex> Points, List<ShaderValue> Structs, double[] Outer, double[] Inner, Dictionary<string, ShaderValue> PatchValues, ShaderValue? Constants);

        /// <summary>One patch (the vertex shader's outputs of its control points) → the primitives the tessellator makes.</summary>
        public List<(Topology Kind, ShadedVertex[] Vertices)> Tessellate(ShadedVertex[] input, int patchId)
        {
            var patch = draw.Hlsl ? HullStage(input, patchId) : ControlStage(input, patchId);
            var evaluation = draw.TessEvalShader!;
            // The domain, spacing and winding: GLSL's evaluation shader layout; HLSL's hull shader attributes.
            string domain, spacing;
            bool cw, points;
            if (draw.Hlsl)
            {
                var hs = draw.TessControlShader;
                string? Attr(string name) => (hs?.Attribute(draw.TessControlEntry, name) ?? evaluation.Attribute(draw.TessEvalEntry, name))?.FirstOrDefault()?.Trim('"');
                domain = Attr("domain") ?? "quad";
                spacing = Tessellator.Spacing(Attr("partitioning"));
                var topology = Attr("outputtopology") ?? "triangle_cw";
                cw = topology == "triangle_cw";
                points = topology == "point";
                domain = domain switch { "tri" => "triangles", "isoline" => "isolines", _ => "quads" };
                if (topology == "line") domain = "isolines";
            }
            else
            {
                domain = evaluation.TessDomain ?? "triangles";
                spacing = Tessellator.Spacing(evaluation.TessSpacing);
                cw = evaluation.TessCw;
                points = evaluation.TessPointMode;
            }
            var result = new List<(Topology, ShadedVertex[])>();
            if (patch is null) return result;
            if (domain == "isolines")
            {
                // Isolines: outer[0] lines (v = 0, 1/n, …), each cut into outer[1] segments along u.
                int lines = (int)Math.Clamp(Math.Ceiling(patch.Outer.ElementAtOrDefault(0) - 1e-9), 0, 64);
                int segments = (int)Math.Clamp(Math.Ceiling(patch.Outer.ElementAtOrDefault(1) - 1e-9), 0, 64);
                for (int l = 0; l < lines; l++)
                {
                    ShadedVertex? last = null;
                    for (int s = 0; s <= segments; s++)
                    {
                        var v = Evaluate(patch, (double)s / segments, (double)l / lines, 0, patchId);
                        if (points) result.Add((Topology.Points, [v]));
                        else if (last is not null) result.Add((Topology.Lines, [last, v]));
                        last = v;
                    }
                }
                return result;
            }
            var mesh = domain == "quads" ? Tessellator.Quad(patch.Outer, patch.Inner, spacing, cw) : Tessellator.Triangle(patch.Outer, patch.Inner, spacing, cw);
            if (mesh is null) return result;
            var shaded = new ShadedVertex?[mesh.Points.Count];
            ShadedVertex At(int i)
            {
                if (shaded[i] is { } done) return done;
                var (u, v) = mesh.Points[i];
                return shaded[i] = Evaluate(patch, u, v, domain == "triangles" ? 1 - u - v : 0, patchId);
            }
            if (points)
            {
                for (int i = 0; i < mesh.Points.Count; i++) result.Add((Topology.Points, [At(i)]));
                return result;
            }
            foreach (var t in mesh.Triangles) result.Add((Topology.Triangles, [At(t[0]), At(t[1]), At(t[2])]));
            return result;
        }

        private static ShaderValue Position(ShadedVertex v) => ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
        {
            ["gl_Position"] = ShaderValue.Vec(v.Clip),
            ["gl_PointSize"] = ShaderValue.Scalar(v.PointSize ?? 1),
        });

        /// <summary>The value a stage's output default starts as: its type's zero, a block's fields' zeros.</summary>
        private static ShaderValue Zero(ShaderRunner runner, Global g) =>
            g.Block is not null ? ShaderValue.Struct(g.Block.ToDictionary(f => f.Id, f => runner.Default(f.Type, f.ArraySize))) : runner.Default(g.Type);

        /// <summary>GLSL: the tessellation control shader, once per output control point (gl_InvocationID).</summary>
        private Patch? ControlStage(ShadedVertex[] input, int patchId)
        {
            if (tcs is null)
            {
                // No control stage (OpenGL allows it): the vertex shader's outputs go on; the default levels are 1.
                return new Patch(input.ToList(), [], [1, 1, 1, 1], [1, 1], new(StringComparer.Ordinal), null);
            }
            var control = draw.TessControlShader!;
            int n = input.Length, outN = control.TessVertices > 0 ? control.TessVertices : n;
            tcs.Globals["gl_in"] = ShaderValue.Array(input.Select(Position).ToArray());
            for (int i = 0; i < tcsInputs.Count; i++)
            {
                var g = tcsInputs[i];
                var key = InputKey(g, i);
                tcs.Globals[g.Id == "" ? g.Type : g.Id] = ShaderValue.Array(input.Select(v => v.Outputs.TryGetValue(key, out var o) ? o : Zero(tcs, g)).ToArray());
            }
            // Per-vertex outputs: arrays of one element per output control point; patch outputs: one value.
            foreach (var g in tcsOutputs)
                tcs.Globals[g.Id == "" ? g.Type : g.Id] = g.ArraySize != 0 ? ShaderValue.Array(Enumerable.Range(0, outN).Select(_ => Zero(tcs, g)).ToArray()) : Zero(tcs, g);
            tcs.Globals["gl_out"] = ShaderValue.Array(Enumerable.Range(0, outN).Select(_ => ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["gl_Position"] = ShaderValue.Vec(0, 0, 0, 1),
                ["gl_PointSize"] = ShaderValue.Scalar(1),
            })).ToArray());
            // Levels the shader does not write read 1 (the default levels).
            tcs.Globals["gl_TessLevelOuter"] = ShaderValue.Array([ShaderValue.Scalar(1), ShaderValue.Scalar(1), ShaderValue.Scalar(1), ShaderValue.Scalar(1)]);
            tcs.Globals["gl_TessLevelInner"] = ShaderValue.Array([ShaderValue.Scalar(1), ShaderValue.Scalar(1)]);
            tcs.Globals["gl_PatchVerticesIn"] = ShaderValue.Integer(n);
            tcs.Globals["gl_PrimitiveID"] = ShaderValue.Integer(patchId);
            for (int invocation = 0; invocation < outN; invocation++)
            {
                tcs.Globals["gl_InvocationID"] = ShaderValue.Integer(invocation);
                tcs.Call("main", []);
            }
            var glOut = tcs.Globals["gl_out"].Items!;
            var points = new List<ShadedVertex>();
            var patchValues = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            for (int k = 0; k < outN; k++)
            {
                var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                for (int i = 0; i < tcsOutputs.Count; i++)
                {
                    var g = tcsOutputs[i];
                    var all = tcs.Globals[g.Id == "" ? g.Type : g.Id];
                    if (g.ArraySize == 0)
                    {
                        if (k == 0) foreach (var key in Keys(g, i)) patchValues[key] = all.Clone();
                        continue;
                    }
                    var value = all.Items is { } items && k < items.Length ? items[k].Clone() : Zero(tcs, g);
                    foreach (var key in Keys(g, i)) outputs[key] = value;
                }
                var position = glOut[k].Fields is { } f && f.TryGetValue("gl_Position", out var p) ? p.Padded(4) : [0, 0, 0, 1];
                var size = glOut[k].Fields is { } f2 && f2.TryGetValue("gl_PointSize", out var ps) ? ps.X : 1;
                points.Add(new ShadedVertex(position, outputs, size));
            }
            double[] Levels(string name, int count) => Enumerable.Range(0, count).Select(i => tcs.Globals[name].Items is { } l && i < l.Length ? l[i].X : 1).ToArray();
            return new Patch(points, [], Levels("gl_TessLevelOuter", 4), Levels("gl_TessLevelInner", 2), patchValues, null);
        }

        /// <summary>The keys a GLSL output is found by in the next stage: its name, "@location" and "block:Type".</summary>
        private static IEnumerable<string> Keys(Global g, int i)
        {
            if (!(g.Block is not null && g.Id == "")) yield return g.Id;
            yield return "@" + (g.Location ?? i);
            if (g.Block is not null) yield return "block:" + g.Type;
        }

        /// <summary>GLSL: the tessellation evaluation shader at (u, v[, w]) of the patch.</summary>
        private ShadedVertex Evaluate(Patch patch, double u, double v, double w, int patchId)
        {
            if (draw.Hlsl) return DomainStage(patch, u, v, w, patchId);
            var runner = tes!;
            runner.Globals["gl_in"] = ShaderValue.Array(patch.Points.Select(Position).ToArray());
            for (int i = 0; i < tesInputs.Count; i++)
            {
                var g = tesInputs[i];
                var key = InputKey(g, i);
                runner.Globals[g.Id == "" ? g.Type : g.Id] = g.ArraySize != 0
                    ? ShaderValue.Array(patch.Points.Select(p => p.Outputs.TryGetValue(key, out var o) ? o.Clone() : Zero(runner, g)).ToArray())
                    : patch.PatchValues.TryGetValue(key, out var pv) ? pv.Clone() : Zero(runner, g);
            }
            runner.Globals["gl_TessLevelOuter"] = ShaderValue.Array(patch.Outer.Select(ShaderValue.Scalar).ToArray());
            runner.Globals["gl_TessLevelInner"] = ShaderValue.Array(patch.Inner.Select(ShaderValue.Scalar).ToArray());
            runner.Globals["gl_PatchVerticesIn"] = ShaderValue.Integer(patch.Points.Count);
            runner.Globals["gl_PrimitiveID"] = ShaderValue.Integer(patchId);
            runner.Globals["gl_TessCoord"] = ShaderValue.Vec(u, v, w);
            runner.Globals["gl_Position"] = ShaderValue.Vec(0, 0, 0, 1);
            runner.Globals["gl_PointSize"] = ShaderValue.Scalar(double.NaN);
            runner.Call("main", []);
            var size = runner.Globals["gl_PointSize"].X;
            return new ShadedVertex(runner.Globals["gl_Position"].Padded(4), Outputs(runner, tesOutputs), double.IsNaN(size) ? null : size);
        }

        /// <summary>An HLSL struct of a stage's outputs (VS → hull input, hull → domain input) from a vertex's outputs.</summary>
        private static ShaderValue StructOf(ShaderProgram program, string type, ShadedVertex v, ShaderRunner runner)
        {
            if (program.FindStruct(type) is not { } st) return ShaderValue.Vec(v.Clip);
            return ShaderValue.Struct(st.Fields.ToDictionary(f => f.Id, f =>
                f.Semantic is not null && v.Outputs.TryGetValue("@" + Semantic(f.Semantic), out var bySemantic) ? bySemantic
                : v.Outputs.TryGetValue(f.Id, out var byName) ? byName
                : IsPosition(f.Semantic) ? ShaderValue.Vec(v.Clip) : runner.Default(f.Type, f.ArraySize)));
        }

        /// <summary>InputPatch&lt;T&gt; / OutputPatch&lt;T&gt; → T.</summary>
        private static string? PatchElement(string type, string kind) =>
            type.StartsWith(kind + "<", StringComparison.Ordinal) ? type[(kind.Length + 1)..^1] : null;

        /// <summary>
        /// HLSL: the hull shader's entry point once per output control point (SV_OutputControlPointID), then its patch
        /// constant function once (SV_TessFactor, SV_InsideTessFactor).
        /// </summary>
        private Patch? HullStage(ShadedVertex[] input, int patchId)
        {
            var hull = draw.TessControlShader;
            if (hull is null || tcs is null) return new Patch(input.ToList(), [], [1, 1, 1, 1], [1, 1], new(StringComparer.Ordinal), null);
            var entry = hull.FindFunction(draw.TessControlEntry) ?? throw new ShaderRuntimeException($"the hull shader has no function '{draw.TessControlEntry}'", 0);
            int outN = int.TryParse(hull.Attribute(entry.Id, "outputcontrolpoints")?.FirstOrDefault(), out var declared) ? declared : input.Length;
            ShaderValue InputPatch(string type) => ShaderValue.Array(input.Select(v => StructOf(hull, PatchElement(type, "InputPatch") ?? "", v, tcs)).ToArray());
            var structs = new List<ShaderValue>();
            var points = new List<ShadedVertex>();
            for (int i = 0; i < outN; i++)
            {
                var args = entry.Params.Select(p =>
                    PatchElement(p.Type, "InputPatch") is not null ? InputPatch(p.Type)
                    : string.Equals(p.Semantic, "SV_OutputControlPointID", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Integer(i)
                    : string.Equals(p.Semantic, "SV_PrimitiveID", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Integer(patchId)
                    : tcs.Default(p.Type)).ToList();
                var result = tcs.Call(entry.Id, args) ?? ShaderValue.Struct(new(StringComparer.Ordinal));
                structs.Add(result);
                var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                double[]? clip = null;
                if (result.Fields is not null && hull.FindStruct(entry.ReturnType) is { } rs)
                    foreach (var field in rs.Fields)
                    {
                        if (!result.Fields.TryGetValue(field.Id, out var value)) continue;
                        outputs[field.Id] = value;
                        if (field.Semantic is not null) outputs["@" + Semantic(field.Semantic)] = value;
                        if (IsPosition(field.Semantic) || clip is null && field.Semantic?.StartsWith("POSITION", StringComparison.OrdinalIgnoreCase) == true) clip = value.Padded(4);
                    }
                points.Add(new ShadedVertex(clip ?? [0, 0, 0, 1], outputs));
            }
            // The patch constant function.
            var constantName = hull.Attribute(entry.Id, "patchconstantfunc")?.FirstOrDefault()?.Trim('"');
            ShaderValue? constants = null;
            double[] outer = [1, 1, 1, 1], inner = [1, 1];
            if (constantName is not null && hull.FindFunction(constantName) is { } constant)
            {
                var args = constant.Params.Select(p =>
                    PatchElement(p.Type, "InputPatch") is not null ? InputPatch(p.Type)
                    : PatchElement(p.Type, "OutputPatch") is not null ? ShaderValue.Array(structs.Select(s => s.Clone()).ToArray())
                    : string.Equals(p.Semantic, "SV_PrimitiveID", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Integer(patchId)
                    : tcs.Default(p.Type)).ToList();
                constants = tcs.Call(constant.Id, args);
                if (constants?.Fields is not null && hull.FindStruct(constant.ReturnType) is { } cs)
                    foreach (var field in cs.Fields)
                    {
                        if (!constants.Fields.TryGetValue(field.Id, out var value)) continue;
                        var numbers = new List<double>();
                        Flatten(value, numbers);
                        if (string.Equals(field.Semantic, "SV_TessFactor", StringComparison.OrdinalIgnoreCase)) outer = numbers.ToArray();
                        else if (string.Equals(field.Semantic, "SV_InsideTessFactor", StringComparison.OrdinalIgnoreCase)) inner = numbers.ToArray();
                    }
            }
            return new Patch(points, structs, outer, inner, new(StringComparer.Ordinal), constants);
        }

        private static void Flatten(ShaderValue v, List<double> into)
        {
            if (v.V is not null) into.AddRange(v.V);
            else if (v.Items is not null) foreach (var i in v.Items) Flatten(i, into);
        }

        /// <summary>HLSL: the domain shader at (u, v[, w]) (SV_DomainLocation) with the patch's control points and constants.</summary>
        private ShadedVertex DomainStage(Patch patch, double u, double v, double w, int patchId)
        {
            var domain = draw.TessEvalShader!;
            var runner = tes!;
            var f = domain.FindFunction(draw.TessEvalEntry) ?? throw new ShaderRuntimeException($"the domain shader has no function '{draw.TessEvalEntry}'", 0);
            var args = new List<ShaderValue>();
            foreach (var p in f.Params)
            {
                if (string.Equals(p.Semantic, "SV_DomainLocation", StringComparison.OrdinalIgnoreCase))
                    args.Add(ShaderRunnerTypes.Components(p.Type) >= 3 ? ShaderValue.Vec(u, v, w) : ShaderValue.Vec(u, v));
                else if (PatchElement(p.Type, "OutputPatch") is { } element)
                    args.Add(ShaderValue.Array(patch.Structs.Count > 0 ? patch.Structs.Select(s => s.Clone()).ToArray() : patch.Points.Select(pt => StructOf(domain, element, pt, runner)).ToArray()));
                else if (string.Equals(p.Semantic, "SV_PrimitiveID", StringComparison.OrdinalIgnoreCase)) args.Add(ShaderValue.Integer(patchId));
                else if (patch.Constants is not null && domain.FindStruct(p.Type) is not null) args.Add(patch.Constants.Clone());
                else args.Add(runner.Default(p.Type));
            }
            var result = runner.Call(f.Id, args) ?? throw new ShaderRuntimeException($"'{f.Id}' returns nothing", f.Line);
            var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            double[]? clip = null;
            if (result.Fields is not null && domain.FindStruct(f.ReturnType) is { } rs)
                foreach (var field in rs.Fields)
                {
                    if (!result.Fields.TryGetValue(field.Id, out var value)) continue;
                    if (IsPosition(field.Semantic)) clip = value.Padded(4);
                    outputs[field.Id] = value;
                    if (field.Semantic is not null) outputs["@" + Semantic(field.Semantic)] = value;
                }
            else if (IsPosition(f.Semantic)) clip = result.Padded(4);
            return new ShadedVertex(clip ?? throw new ShaderRuntimeException($"'{f.Id}' returns no SV_POSITION", f.Line), outputs);
        }
    }
}
