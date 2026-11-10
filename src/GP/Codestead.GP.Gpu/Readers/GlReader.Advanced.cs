using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// The calls of learnopengl.com's "Advanced OpenGL" part: the depth function and mask, the stencil test, blending,
// the colour mask, framebuffer objects and renderbuffers, blits, cube maps, uniform buffer objects, buffer updates
// (glBufferSubData, glMapBuffer, glCopyBufferSubData), instancing and point sizes.
public sealed partial class GlReader
{
    /// <summary>Handles a call of the advanced part; false when it is not one of them.</summary>
    private bool AdvancedCall(string name, IReadOnlyList<string> a, string? lhs, int line)
    {
        string A(int i) => i < a.Count ? a[i].Trim() : "";
        switch (name)
        {
            case "glDepthFunc":
                gl.DepthFunc = CompareOf(A(0));
                return true;
            case "glDepthMask":
                gl.DepthMask = IsTrue(A(0));
                return true;
            case "glStencilFunc" or "glStencilFuncSeparate":
            {
                int o = name == "glStencilFuncSeparate" ? 1 : 0;
                gl.Stencil = gl.Stencil with { Func = CompareOf(A(o)), Ref = Int(A(o + 1)) ?? 0, ReadMask = Int(A(o + 2)) ?? 0xFF };
                return true;
            }
            case "glStencilOp" or "glStencilOpSeparate":
            {
                int o = name == "glStencilOpSeparate" ? 1 : 0;
                gl.Stencil = gl.Stencil with { StencilFail = StencilOpOf(A(o)), DepthFail = StencilOpOf(A(o + 1)), Pass = StencilOpOf(A(o + 2)) };
                return true;
            }
            case "glStencilMask" or "glStencilMaskSeparate":
                gl.Stencil = gl.Stencil with { WriteMask = Int(A(name == "glStencilMask" ? 0 : 1)) ?? 0xFF };
                return true;
            case "glBlendFunc":
                gl.BlendState = gl.BlendState with { SrcColor = FactorOf(A(0)), DstColor = FactorOf(A(1)), SrcAlpha = FactorOf(A(0)), DstAlpha = FactorOf(A(1)) };
                return true;
            case "glBlendFuncSeparate":
                gl.BlendState = gl.BlendState with { SrcColor = FactorOf(A(0)), DstColor = FactorOf(A(1)), SrcAlpha = FactorOf(A(2)), DstAlpha = FactorOf(A(3)) };
                return true;
            case "glBlendEquation":
                gl.BlendState = gl.BlendState with { ColorOp = BlendOpOf(A(0)), AlphaOp = BlendOpOf(A(0)) };
                return true;
            case "glBlendEquationSeparate":
                gl.BlendState = gl.BlendState with { ColorOp = BlendOpOf(A(0)), AlphaOp = BlendOpOf(A(1)) };
                return true;
            case "glBlendColor":
                gl.BlendState = gl.BlendState with { Constant = a.Select(x => Eval(x)?.X ?? 0).ToArray() };
                return true;
            case "glColorMask":
                gl.ColorMask = Enumerable.Range(0, 4).Select(i => IsTrue(A(i))).ToArray();
                return true;
            case "glPointSize":
                gl.PointSize = Eval(A(0))?.X ?? 1;
                return true;

            // ---------- framebuffers ----------
            case "glGenFramebuffers":
                foreach (var n in Names(A(0), A(1))) gl.Framebuffers[n] = new GlState.FramebufferObject();
                return true;
            case "glBindFramebuffer":
            {
                var fbo = Obj(A(1)) is "0" ? null : Obj(A(1));
                if (A(0).Contains("GL_READ_FRAMEBUFFER", StringComparison.Ordinal)) gl.ReadFramebuffer = fbo;
                else if (A(0).Contains("GL_DRAW_FRAMEBUFFER", StringComparison.Ordinal)) gl.DrawFramebuffer = fbo;
                else gl.ReadFramebuffer = gl.DrawFramebuffer = fbo;
                return true;
            }
            case "glGenRenderbuffers":
                foreach (var n in Names(A(0), A(1))) gl.Renderbuffers[n] = new GlState.Renderbuffer();
                return true;
            case "glBindRenderbuffer":
                gl.CurrentRenderbuffer = Obj(A(1)) is "0" ? null : Obj(A(1));
                return true;
            case "glRenderbufferStorage" or "glRenderbufferStorageMultisample":
            {
                if (gl.CurrentRenderbuffer is not { } rb || !gl.Renderbuffers.TryGetValue(rb, out var r)) return true;
                int o = name == "glRenderbufferStorage" ? 1 : 2;
                r.Samples = name == "glRenderbufferStorage" ? 1 : Int(A(1)) ?? 1;
                r.Format = A(o);
                r.Width = Int(A(o + 1)) ?? 0;
                r.Height = Int(A(o + 2)) ?? 0;
                return true;
            }
            case "glFramebufferRenderbuffer":
            {
                if (BoundFramebuffer(A(0)) is not { } fb) return true;
                var rbo = gl.Renderbuffers.GetValueOrDefault(Obj(A(3)));
                if (A(1).Contains("DEPTH_STENCIL", StringComparison.Ordinal)) fb.Depth = fb.Stencil = true;
                else if (A(1).Contains("DEPTH", StringComparison.Ordinal)) fb.Depth = true;
                else if (A(1).Contains("STENCIL", StringComparison.Ordinal)) fb.Stencil = true;
                if (rbo is not null)
                {
                    fb.Samples = Math.Max(fb.Samples, rbo.Samples);
                    if (fb.Width == 0) (fb.Width, fb.Height) = (rbo.Width, rbo.Height);
                    if (A(1).Contains("COLOR_ATTACHMENT", StringComparison.Ordinal))
                        fb.Colors[AttachmentIndex(A(1))] = new GlState.TextureObject { Width = rbo.Width, Height = rbo.Height, Samples = rbo.Samples, Float = IsFloatFormat(rbo.Format), MinFilter = "GL_LINEAR" };
                }
                return true;
            }
            case "glFramebufferTexture2D" or "glFramebufferTexture":
            {
                if (BoundFramebuffer(A(0)) is not { } fb) return true;
                var texArg = name == "glFramebufferTexture2D" ? A(3) : A(2);
                if (!gl.TextureObjects.TryGetValue(Obj(texArg), out var tex)) return true;
                var fboName = A(0).Contains("READ", StringComparison.Ordinal) ? gl.ReadFramebuffer! : gl.DrawFramebuffer!;
                // A face of a cube map (GL_TEXTURE_CUBE_MAP_POSITIVE_X + i) or a mip level: the attachment changes from
                // draw to draw, so each draw goes to the texture's own target for that face and level.
                int cubeFace = -1, level = Int(A(name == "glFramebufferTexture2D" ? 4 : 3)) ?? 0;
                if (name == "glFramebufferTexture2D" && Regex.Match(A(2), @"GL_TEXTURE_CUBE_MAP_(POSITIVE|NEGATIVE)_([XYZ])\s*(?:\+\s*(.+))?$") is { Success: true } faceOf)
                    cubeFace = "XYZ".IndexOf(faceOf.Groups[2].Value[0]) * 2 + (faceOf.Groups[1].Value == "NEGATIVE" ? 1 : 0) + (faceOf.Groups[3].Success ? Int(faceOf.Groups[3].Value) ?? 0 : 0);
                if (!A(1).Contains("DEPTH", StringComparison.Ordinal) && (cubeFace >= 0 || level > 0 || fb.PerTexture))
                {
                    fb.PerTexture = true;
                    fb.TargetTexture = Obj(texArg);
                    fb.TargetFace = cubeFace;
                    fb.TargetLevel = level;
                    fb.Colors.Clear();
                    fb.Colors[0] = tex;
                    (fb.Width, fb.Height) = (Math.Max(1, tex.Width >> level), Math.Max(1, tex.Height >> level));
                    tex.Framebuffer = "tex:" + fb.TargetTexture;
                    tex.Attachment = 0;
                    tex.TargetLevels = Math.Max(tex.TargetLevels, level + 1);
                    return true;
                }
                tex.Framebuffer = fboName;
                fb.Samples = Math.Max(fb.Samples, tex.Samples);
                // glFramebufferTexture (not …2D) attaches every layer: a cube map's six faces.
                if (name == "glFramebufferTexture" && tex.IsCube) fb.Layers = 6;
                if (fb.Width == 0) (fb.Width, fb.Height) = (tex.Width, tex.Height);
                if (A(1).Contains("DEPTH", StringComparison.Ordinal))
                {
                    fb.Depth = true;
                    if (A(1).Contains("STENCIL", StringComparison.Ordinal)) fb.Stencil = true;
                    tex.IsDepth = true;
                }
                else
                {
                    tex.Attachment = AttachmentIndex(A(1));
                    fb.Colors[tex.Attachment] = tex;
                }
                return true;
            }
            case "glCheckFramebufferStatus":
                return true;
            case "glDrawBuffer" or "glDrawBuffers" or "glReadBuffer":
                return true;
            case "glBlitFramebuffer":
                if (inLoop)
                {
                    // The mask says what is copied: GL_COLOR_BUFFER_BIT, GL_DEPTH_BUFFER_BIT (or both).
                    var mask = a.Count > 8 ? A(8) : "GL_COLOR_BUFFER_BIT";
                    scene.Ops.Add(new CopyOp(scene.Draws.Count, gl.ReadFramebuffer, gl.DrawFramebuffer,
                        mask.Contains("COLOR", StringComparison.Ordinal), mask.Contains("DEPTH", StringComparison.Ordinal) || mask.Contains("STENCIL", StringComparison.Ordinal)));
                }
                return true;
            case "glTexImage2DMultisample":
            {
                if (BoundTexture is not { } tex) return true;
                tex.Samples = Int(A(1)) ?? 1;
                tex.Float = IsFloatFormat(A(2));
                tex.Width = Int(A(3)) ?? 0;
                tex.Height = Int(A(4)) ?? 0;
                tex.MinFilter = "GL_LINEAR";
                return true;
            }

            // ---------- instancing, buffers, uniform blocks ----------
            case "glVertexAttribDivisor":
            {
                if (Vao is not { } vao) return true;
                int loc = Int(A(0)) ?? 0;
                if (!vao.Attributes.TryGetValue(loc, out var attr)) vao.Attributes[loc] = attr = new GlState.Attribute();
                attr.Divisor = Int(A(1)) ?? 0;
                return true;
            }
            case "glDrawArraysInstanced":
                Draw(A(0), null, Int(A(1)) ?? 0, Int(A(2)) ?? 0, name, line, Int(A(3)) ?? 1);
                return true;
            case "glDrawElementsInstanced":
                Draw(A(0), A(2), Int(A(3)) ?? 0, Int(A(1)) ?? 0, name, line, Int(A(4)) ?? 1);
                return true;
            case "glGetUniformBlockIndex":
                if (lhs is not null && CppSource.StringArg(A(1)) is { } block) gl.BlockIndices[lhs] = block;
                return true;
            case "glUniformBlockBinding":
            {
                if (!gl.Programs.TryGetValue(Obj(A(0)), out var program)) return true;
                var quoted = Regex.Match(A(1), "\"([^\"]+)\"");
                var blockName = gl.BlockIndices.GetValueOrDefault(Obj(A(1))) ?? (quoted.Success ? quoted.Groups[1].Value : null);
                if (blockName is not null) program.BlockBindings[blockName] = Int(A(2)) ?? 0;
                return true;
            }
            case "glBindBufferBase" or "glBindBufferRange":
                if (A(0).Contains("GL_UNIFORM_BUFFER", StringComparison.Ordinal))
                    gl.UniformBindings[Int(A(1)) ?? 0] = (Obj(A(2)), name == "glBindBufferRange" ? Int(A(3)) ?? 0 : 0);
                return true;
            case "glBufferSubData":
            {
                var target = BufferOf(A(0));
                if (target is null) return true;
                int offset = Int(A(1)) ?? 0;
                if (A(0).Contains("GL_UNIFORM_BUFFER", StringComparison.Ordinal))
                {
                    var expr = Regex.Replace(A(3), @"^(?:glm::)?value_ptr\s*\((.*)\)$", "$1").TrimStart('&');
                    if (Eval(expr) is { } value)
                    {
                        if (!gl.BufferWrites.TryGetValue(target, out var writes)) gl.BufferWrites[target] = writes = new SortedDictionary<int, ShaderValue>();
                        writes[offset] = value;
                    }
                    return true;
                }
                if (Numbers(DataName(A(3))) is { } numbers)
                {
                    var data = gl.Buffers.GetValueOrDefault(target) ?? new List<double>();
                    int start = offset / 4;
                    while (data.Count < start + numbers.Count) data.Add(0);
                    for (int i = 0; i < numbers.Count; i++) data[start + i] = numbers[i];
                    gl.Buffers[target] = data;
                }
                return true;
            }
            case "glMapBuffer" or "glMapBufferRange":
                if (lhs is not null && BufferOf(A(0)) is { } mapped) gl.Mapped[lhs] = mapped;
                return true;
            case "glUnmapBuffer":
                return true;
            case "glCopyBufferSubData":
            {
                var from = BufferOf(A(0));
                var to = BufferOf(A(1));
                if (from is null || to is null || gl.Buffers.GetValueOrDefault(from) is not { } source) return true;
                int readAt = (Int(A(2)) ?? 0) / 4, writeAt = (Int(A(3)) ?? 0) / 4, count = (Int(A(4)) ?? 0) / 4;
                var data = gl.Buffers.GetValueOrDefault(to) ?? new List<double>();
                while (data.Count < writeAt + count) data.Add(0);
                for (int i = 0; i < count && readAt + i < source.Count; i++) data[writeAt + i] = source[readAt + i];
                gl.Buffers[to] = data;
                return true;
            }
        }
        return false;
    }

    /// <summary>memcpy(ptr, data, size) into a buffer mapped with glMapBuffer.</summary>
    private void Memcpy(IReadOnlyList<string> a)
    {
        if (a.Count < 2 || !gl.Mapped.TryGetValue(Obj(a[0]), out var buffer)) return;
        if (Numbers(DataName(a[1])) is { } numbers) gl.Buffers[buffer] = numbers.ToList();
    }

    /// <summary>The buffer bound to a target (GL_ARRAY_BUFFER, GL_ELEMENT_ARRAY_BUFFER, GL_UNIFORM_BUFFER, the copy targets).</summary>
    private string? BufferOf(string target) => target switch
    {
        _ when target.Contains("ELEMENT_ARRAY", StringComparison.Ordinal) => Vao?.ElementBuffer,
        _ when target.Contains("UNIFORM", StringComparison.Ordinal) => gl.UniformBuffer,
        _ when target.Contains("COPY_READ", StringComparison.Ordinal) => gl.CopyReadBuffer,
        _ when target.Contains("COPY_WRITE", StringComparison.Ordinal) => gl.CopyWriteBuffer,
        _ => gl.ArrayBuffer,
    };

    private GlState.FramebufferObject? BoundFramebuffer(string target)
    {
        var name = target.Contains("READ", StringComparison.Ordinal) ? gl.ReadFramebuffer : gl.DrawFramebuffer;
        return name is not null && gl.Framebuffers.TryGetValue(name, out var fb) ? fb : null;
    }

    /// <summary>The render target a draw goes to (registered in the scene), or null for the window.</summary>
    private string? DrawTarget()
    {
        if (gl.DrawFramebuffer is not { } id || !gl.Framebuffers.TryGetValue(id, out var fb)) return null;
        if (fb.PerTexture && fb.TargetTexture is { } texture && gl.TextureObjects.TryGetValue(texture, out var tex))
        {
            // The texture's own target: "tex:name" (level 0), "tex:name~2" (mip level 2), "…@3" for cube face 3.
            var levelId = LevelTarget(texture, fb.TargetLevel);
            scene.Targets[levelId] = new RenderTarget(levelId, Math.Max(1, tex.Width >> fb.TargetLevel), Math.Max(1, tex.Height >> fb.TargetLevel), 1, fb.Depth, fb.Stencil, 1, tex.Float);
            return fb.TargetFace > 0 ? levelId + "@" + fb.TargetFace : levelId;
        }
        int colors = fb.Colors.Count == 0 ? 0 : fb.Colors.Keys.Max() + 1;
        scene.Targets[id] = new RenderTarget(id, fb.Width, fb.Height, colors, fb.Depth, fb.Stencil, fb.Samples, fb.Colors.Values.Any(c => c.Float), fb.Layers);
        return id;
    }

    private static string LevelTarget(string texture, int level) => level > 0 ? $"tex:{texture}~{level}" : "tex:" + texture;

    /// <summary>
    /// glGenerateMipmap on a texture that was drawn into (learnopengl's environment cube map after the capture): every
    /// smaller level is the average of the level above, made now – between the draws before and after the call.
    /// </summary>
    private void GenerateTargetMips(GlState.TextureObject tex)
    {
        if (tex.Framebuffer is not { } target || !target.StartsWith("tex:", StringComparison.Ordinal) || !scene.Targets.ContainsKey(target)) return;
        var texture = target[4..];
        int levels = 1 + (int)Math.Floor(Math.Log2(Math.Max(1, Math.Max(tex.Width, tex.Height))));
        for (int level = 1; level < levels; level++)
        {
            var id = LevelTarget(texture, level);
            scene.Targets[id] = new RenderTarget(id, Math.Max(1, tex.Width >> level), Math.Max(1, tex.Height >> level), 1, false, false, 1, tex.Float);
            for (int face = 0; face < (tex.IsCube ? 6 : 1); face++)
            {
                string Face(string of) => face > 0 ? of + "@" + face : of;
                scene.Ops.Add(new CopyOp(scene.Draws.Count, Face(LevelTarget(texture, level - 1)), Face(id), Average: true));
            }
        }
        tex.TargetLevels = Math.Max(tex.TargetLevels, levels);
    }

    /// <summary>GL_COLOR_ATTACHMENT1, or GL_COLOR_ATTACHMENT0 + i in learnopengl's loop (the offset worked out now).</summary>
    private int AttachmentIndex(string attachment) =>
        Regex.Match(attachment, @"GL_COLOR_ATTACHMENT(\d+)(?:\s*\+\s*(.+))?$") is { Success: true } m
            ? int.Parse(m.Groups[1].Value) + (m.Groups[2].Success ? (int)Math.Round(Eval(m.Groups[2].Value)?.X ?? 0) : 0) : 0;

    private static bool IsFloatFormat(string format) => Regex.IsMatch(format, @"16F|32F|R11F", RegexOptions.CultureInvariant);

    private static bool IsTrue(string v) => v.Trim() is "GL_TRUE" or "true" or "1";

    internal static CompareFunc CompareOf(string v) => v.Trim() switch
    {
        "GL_NEVER" => CompareFunc.Never,
        "GL_LESS" => CompareFunc.Less,
        "GL_EQUAL" => CompareFunc.Equal,
        "GL_LEQUAL" => CompareFunc.LessEqual,
        "GL_GREATER" => CompareFunc.Greater,
        "GL_NOTEQUAL" => CompareFunc.NotEqual,
        "GL_GEQUAL" => CompareFunc.GreaterEqual,
        _ => CompareFunc.Always,
    };

    private static StencilOp StencilOpOf(string v) => v.Trim() switch
    {
        "GL_ZERO" => StencilOp.Zero,
        "GL_REPLACE" => StencilOp.Replace,
        "GL_INCR" => StencilOp.Increment,
        "GL_INCR_WRAP" => StencilOp.IncrementWrap,
        "GL_DECR" => StencilOp.Decrement,
        "GL_DECR_WRAP" => StencilOp.DecrementWrap,
        "GL_INVERT" => StencilOp.Invert,
        _ => StencilOp.Keep,
    };

    private static BlendFactor FactorOf(string v) => v.Trim() switch
    {
        "GL_ZERO" => BlendFactor.Zero,
        "GL_SRC_COLOR" => BlendFactor.SrcColor,
        "GL_ONE_MINUS_SRC_COLOR" => BlendFactor.OneMinusSrcColor,
        "GL_DST_COLOR" => BlendFactor.DstColor,
        "GL_ONE_MINUS_DST_COLOR" => BlendFactor.OneMinusDstColor,
        "GL_SRC_ALPHA" => BlendFactor.SrcAlpha,
        "GL_ONE_MINUS_SRC_ALPHA" => BlendFactor.OneMinusSrcAlpha,
        "GL_DST_ALPHA" => BlendFactor.DstAlpha,
        "GL_ONE_MINUS_DST_ALPHA" => BlendFactor.OneMinusDstAlpha,
        "GL_CONSTANT_COLOR" => BlendFactor.ConstantColor,
        "GL_ONE_MINUS_CONSTANT_COLOR" => BlendFactor.OneMinusConstantColor,
        "GL_CONSTANT_ALPHA" => BlendFactor.ConstantAlpha,
        "GL_ONE_MINUS_CONSTANT_ALPHA" => BlendFactor.OneMinusConstantAlpha,
        _ => BlendFactor.One,
    };

    private static BlendOp BlendOpOf(string v) => v.Trim() switch
    {
        "GL_FUNC_SUBTRACT" => BlendOp.Subtract,
        "GL_FUNC_REVERSE_SUBTRACT" => BlendOp.ReverseSubtract,
        "GL_MIN" => BlendOp.Min,
        "GL_MAX" => BlendOp.Max,
        _ => BlendOp.Add,
    };

    /// <summary>
    /// The values of a program's uniform blocks (layout (std140) uniform Matrices { … }): the block's binding point
    /// (glUniformBlockBinding, 0 by default), the buffer bound there, and the glBufferSubData writes at each member's
    /// std140 offset.
    /// </summary>
    private Dictionary<string, ShaderValue> BlockUniforms(GlState.ProgramObject program)
    {
        var d = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        var stages = new[] { program.Vertex, program.Geometry, program.Fragment }.Where(s => s is not null);
        foreach (var g in stages.SelectMany(s => s!.Globals).Where(g => g.Storage == "uniform" && g.Block is not null && !g.PushConstant))
        {
            int binding = program.BlockBindings.GetValueOrDefault(g.Type, 0);
            if (!gl.UniformBindings.TryGetValue(binding, out var buf) || !gl.BufferWrites.TryGetValue(buf.Buffer, out var writes)) continue;
            int offset = 0;
            foreach (var f in g.Block!)
            {
                var (align, size) = Std140(f.Type, f.ArraySize);
                offset = (offset + align - 1) / align * align;
                if (writes.TryGetValue(buf.Offset + offset, out var value)) d[g.Id == "" ? f.Id : g.Id + "." + f.Id] = value;
                offset += size;
            }
        }
        return d;
    }

    /// <summary>The std140 alignment and size of a member, in bytes.</summary>
    internal static (int Align, int Size) Std140(string type, int arraySize)
    {
        var (align, size) = type switch
        {
            "vec2" or "ivec2" or "uvec2" or "bvec2" => (8, 8),
            "vec3" or "ivec3" or "uvec3" or "bvec3" => (16, 12),
            "vec4" or "ivec4" or "uvec4" or "bvec4" => (16, 16),
            "mat2" => (16, 32),
            "mat3" => (16, 48),
            "mat4" => (16, 64),
            _ => (4, 4),
        };
        if (arraySize > 0)
        {
            int stride = (size + 15) / 16 * 16;
            return (16, stride * arraySize);
        }
        return (align, size);
    }
}
