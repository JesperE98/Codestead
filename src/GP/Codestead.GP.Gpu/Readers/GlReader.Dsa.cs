using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// Direct state access (OpenGL 4.5): the calls name the object they change (glNamedBufferStorage(VBO, …),
// glTextureParameteri(texture, …)) instead of the one bound to a target, and the separate vertex attribute format of
// OpenGL 4.3 (an attribute reads a buffer binding point: glVertexArrayAttribBinding / glVertexArrayVertexBuffer).
public sealed partial class GlReader
{
    /// <summary>The texture a glTexture* call names: the texture calls of the bind-to-edit API work on it meanwhile.</summary>
    private GlState.TextureObject? namedTexture;

    /// <summary>Handles a direct state access call; false when it is not one of them.</summary>
    private bool DsaCall(string name, IReadOnlyList<string> a, int line)
    {
        string A(int i) => i < a.Count ? a[i].Trim() : "";
        switch (name)
        {
            // ---------- objects ----------
            case "glCreateBuffers":
                Call("glGenBuffers", a, null, line);
                return true;
            case "glCreateVertexArrays":
                Call("glGenVertexArrays", a, null, line);
                return true;
            case "glCreateFramebuffers":
                Call("glGenFramebuffers", a, null, line);
                return true;
            case "glCreateRenderbuffers":
                Call("glGenRenderbuffers", a, null, line);
                return true;
            case "glCreateTextures":
            {
                // glCreateTextures(target, n, &texture): made for its target now (a cube map is one from the start).
                Call("glGenTextures", [A(1), A(2)], null, line);
                if (A(0).Contains("CUBE_MAP", StringComparison.Ordinal))
                    foreach (var n in Names(A(1), A(2)))
                        if (gl.TextureObjects.TryGetValue(n, out var cube)) cube.IsCube = true;
                return true;
            }

            // ---------- buffers ----------
            case "glNamedBufferStorage" or "glNamedBufferData":
            {
                var buffer = BufferName(A(0));
                if (!gl.Buffers.ContainsKey(buffer)) return true;
                gl.Buffers[buffer] = A(2) is "NULL" or "nullptr" or "0"
                    ? Enumerable.Repeat(0.0, Math.Max(0, (Int(A(1)) ?? 0) / 4)).ToList()
                    : Numbers(DataName(A(2)));
                return true;
            }
            case "glNamedBufferSubData":
            {
                var buffer = BufferName(A(0));
                if (!gl.Buffers.ContainsKey(buffer)) return true;
                int offset = Int(A(1)) ?? 0;
                var expr = Regex.Replace(A(3), @"^(?:glm::)?value_ptr\s*\((.*)\)$", "$1").TrimStart('&');
                // A uniform block's member (by its byte offset), and the numbers (vertex or index data).
                if (Eval(expr) is { } value)
                {
                    if (!gl.BufferWrites.TryGetValue(buffer, out var writes)) gl.BufferWrites[buffer] = writes = new SortedDictionary<int, ShaderValue>();
                    writes[offset] = value;
                }
                if (Numbers(DataName(A(3))) is { } numbers)
                {
                    var data = gl.Buffers.GetValueOrDefault(buffer) ?? new List<double>();
                    int start = offset / 4;
                    while (data.Count < start + numbers.Count) data.Add(0);
                    for (int i = 0; i < numbers.Count; i++) data[start + i] = numbers[i];
                    gl.Buffers[buffer] = data;
                }
                return true;
            }

            // ---------- vertex arrays ----------
            case "glVertexArrayElementBuffer":
                if (NamedVao(A(0)) is { } withIndices) withIndices.ElementBuffer = Obj(A(1)) is "0" ? null : BufferName(A(1));
                return true;
            case "glEnableVertexArrayAttrib" or "glDisableVertexArrayAttrib":
                if (NamedVao(A(0)) is { } toggled) AttributeOf(toggled, Int(A(1)) ?? 0).Enabled = name == "glEnableVertexArrayAttrib";
                return true;
            case "glVertexArrayAttribFormat":
                if (NamedVao(A(0)) is { } formatted) Format(formatted, Int(A(1)) ?? 0, Int(A(2)) ?? 4, Int(A(5)) ?? 0);
                return true;
            case "glVertexAttribFormat":
                if (Vao is { } current) Format(current, Int(A(0)) ?? 0, Int(A(1)) ?? 4, Int(A(4)) ?? 0);
                return true;
            case "glVertexArrayAttribBinding":
                if (NamedVao(A(0)) is { } bound) BindAttribute(bound, Int(A(1)) ?? 0, Int(A(2)) ?? 0);
                return true;
            case "glVertexAttribBinding":
                if (Vao is { } currentBinding) BindAttribute(currentBinding, Int(A(0)) ?? 0, Int(A(1)) ?? 0);
                return true;
            case "glVertexArrayVertexBuffer":
                if (NamedVao(A(0)) is { } withBuffer) SetBufferBinding(withBuffer, Int(A(1)) ?? 0, A(2), Int(A(3)) ?? 0, Int(A(4)) ?? 0);
                return true;
            case "glBindVertexBuffer":
                if (Vao is { } currentBuffer) SetBufferBinding(currentBuffer, Int(A(0)) ?? 0, A(1), Int(A(2)) ?? 0, Int(A(3)) ?? 0);
                return true;
            case "glVertexArrayBindingDivisor" or "glVertexBindingDivisor":
            {
                var vao = name == "glVertexArrayBindingDivisor" ? NamedVao(A(0)) : Vao;
                int o = name == "glVertexArrayBindingDivisor" ? 1 : 0;
                if (vao is null) return true;
                int index = Int(A(o)) ?? 0;
                if (!vao.Bindings.TryGetValue(index, out var binding)) vao.Bindings[index] = binding = new GlState.BufferBinding();
                binding.Divisor = Int(A(o + 1)) ?? 0;
                Resolve(vao);
                return true;
            }

            // ---------- textures ----------
            case "glTextureParameteri" or "glTextureParameterf" or "glTextureParameteriv" or "glTextureParameterfv":
                OnTexture(A(0), () => Call(name.Replace("glTexture", "glTex"), ["GL_TEXTURE_2D", A(1), A(2)], null, line));
                return true;
            case "glTextureStorage2D":
                // Immutable storage: the size and format; the image comes with glTextureSubImage2D.
                if (gl.TextureObjects.TryGetValue(ObjOf(A(0), gl.TextureObjects.ContainsKey), out var stored))
                {
                    stored.StorageFormat = A(2);
                    stored.Width = Int(A(3)) ?? 0;
                    stored.Height = Int(A(4)) ?? 0;
                    stored.Float = IsFloatFormat(A(2));
                    stored.IsDepth = A(2).Contains("DEPTH", StringComparison.Ordinal);
                    stored.Srgb = A(2).Contains("SRGB", StringComparison.Ordinal);
                }
                return true;
            case "glTextureSubImage2D":
                // The data of level 0 (a whole image) as glTexImage2D would upload it, in the storage's format.
                if (Int(A(1)) is 0 or null)
                    OnTexture(A(0), () => TexImage(["GL_TEXTURE_2D", "0", namedTexture?.StorageFormat ?? A(6), A(4), A(5), "0", A(6), A(7), A(8)], line));
                return true;
            case "glGenerateTextureMipmap":
                OnTexture(A(0), () => Call("glGenerateMipmap", ["GL_TEXTURE_2D"], null, line));
                return true;
            case "glBindTextureUnit":
            {
                // glBindTextureUnit(unit, texture): the texture on that unit, for its kind of sampler.
                int unit = Int(A(0)) ?? 0;
                if (Obj(A(1)) is "0")
                {
                    gl.Units.Remove(unit);
                    gl.Units2D.Remove(unit);
                    gl.UnitsCube.Remove(unit);
                    return true;
                }
                var texture = ObjOf(A(1), gl.TextureObjects.ContainsKey);
                gl.Units[unit] = texture;
                bool cube = gl.TextureObjects.TryGetValue(texture, out var t) && t.IsCube;
                (cube ? gl.UnitsCube : gl.Units2D)[unit] = texture;
                return true;
            }
        }
        return false;
    }

    /// <summary>Runs a bind-to-edit texture call on the texture a direct state access call names.</summary>
    private void OnTexture(string texture, Action call)
    {
        if (!gl.TextureObjects.TryGetValue(ObjOf(texture, gl.TextureObjects.ContainsKey), out var tex)) return;
        var saved = namedTexture;
        namedTexture = tex;
        try
        {
            call();
        }
        finally
        {
            namedTexture = saved;
        }
    }

    private GlState.VertexArray? NamedVao(string arg) => gl.VertexArrays.TryGetValue(ObjOf(arg, gl.VertexArrays.ContainsKey), out var vao) ? vao : null;

    private static GlState.Attribute AttributeOf(GlState.VertexArray vao, int location)
    {
        if (!vao.Attributes.TryGetValue(location, out var attr)) vao.Attributes[location] = attr = new GlState.Attribute();
        return attr;
    }

    private void Format(GlState.VertexArray vao, int location, int size, int relativeOffset)
    {
        var attr = AttributeOf(vao, location);
        attr.Size = size;
        attr.RelativeOffset = relativeOffset;
        // An attribute reads binding point = its location until glVertexArrayAttribBinding says otherwise.
        attr.BindingIndex ??= location;
        Resolve(vao);
    }

    private void BindAttribute(GlState.VertexArray vao, int location, int binding)
    {
        AttributeOf(vao, location).BindingIndex = binding;
        Resolve(vao);
    }

    private void SetBufferBinding(GlState.VertexArray vao, int index, string buffer, int offset, int stride)
    {
        if (!vao.Bindings.TryGetValue(index, out var binding)) vao.Bindings[index] = binding = new GlState.BufferBinding();
        binding.Buffer = Obj(buffer) is "0" ? null : BufferName(buffer);
        binding.OffsetBytes = offset;
        binding.StrideBytes = stride;
        Resolve(vao);
    }

    /// <summary>
    /// Each attribute with a separate format reads like a glVertexAttribPointer attribute: its binding point's buffer,
    /// stride and divisor, at the binding's offset plus its own.
    /// </summary>
    private static void Resolve(GlState.VertexArray vao)
    {
        foreach (var attr in vao.Attributes.Values)
        {
            if (attr.BindingIndex is not int index || !vao.Bindings.TryGetValue(index, out var binding)) continue;
            attr.Buffer = binding.Buffer;
            attr.StrideBytes = binding.StrideBytes;
            attr.OffsetBytes = binding.OffsetBytes + attr.RelativeOffset;
            attr.Divisor = binding.Divisor;
        }
    }
}
