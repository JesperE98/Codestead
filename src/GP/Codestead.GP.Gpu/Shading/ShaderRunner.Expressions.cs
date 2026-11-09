using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

// Evaluating expressions: names, members and swizzles, indexing, operators and types.
public sealed partial class ShaderRunner
{
    private ShaderValue Eval(Expr e)
    {
        if (++steps > MaxSteps * 10) throw new ShaderRuntimeException("the shader runs too long for the simulator", e.Line);
        switch (e)
        {
            case Number n:
                return ShaderValue.Scalar(n.Value);
            case Name n:
                return Lookup(n.Id, n.Line);
            case Member m:
            {
                var owner = Eval(m.Target);
                if (owner.Iterator is { } iter && m.Field is "first" or "second")
                {
                    var cur = iter.Current ?? throw new ShaderRuntimeException("the iterator is at the end of the map", m.Line);
                    return m.Field == "first" ? ShaderValue.Scalar(cur.Key) : cur.Value;
                }
                if (owner.Fields is not null)
                    return owner.Fields.TryGetValue(m.Field, out var f) ? f : throw new ShaderRuntimeException($"no member named '{m.Field}'", m.Line);
                // C++ mode: a descriptor handle held as a number (handle.ptr).
                if (Lenient && m.Field == "ptr" && owner.V is { Length: 1 }) return owner;
                if (owner.V is not null && !owner.IsMatrix && Swizzle(m.Field) is { } idx)
                {
                    if (idx.Any(i => i >= owner.V.Length)) throw new ShaderRuntimeException($"vector has no component '.{m.Field}'", m.Line);
                    return idx.Length == 1 ? ShaderValue.Scalar(owner.V[idx[0]]) : ShaderValue.Vec(idx.Select(i => owner.V[i]).ToArray());
                }
                // .size() / .length() on arrays.
                throw new ShaderRuntimeException($"no member named '{m.Field}'", m.Line);
            }
            case IndexOf ix:
            {
                var owner = Eval(ix.Target);
                if (owner.Map is not null)
                    return owner.Map.TryGetValue(Eval(ix.At).X, out var mv) ? mv : ShaderValue.Scalar(0);
                int at = (int)Math.Floor(Eval(ix.At).X);
                if (owner.Items is not null)
                    return at >= 0 && at < owner.Items.Length ? owner.Items[at] : throw new ShaderRuntimeException($"array index {at} is out of range", ix.Line);
                if (owner.IsMatrix)
                    return at >= 0 && at < owner.Cols ? ShaderValue.Vec(owner.V!.Skip(at * owner.Cols).Take(owner.Cols).ToArray()) : throw new ShaderRuntimeException($"matrix index {at} is out of range", ix.Line);
                if (owner.V is not null)
                    return at >= 0 && at < owner.V.Length ? ShaderValue.Scalar(owner.V[at]) : throw new ShaderRuntimeException($"index {at} is out of range", ix.Line);
                throw new ShaderRuntimeException("this value cannot be indexed", ix.Line);
            }
            case Unary u:
            {
                if (u.Op is "post++" or "post--" or "++" or "--")
                {
                    var old = Eval(u.Operand);
                    if (old.Iterator is { } it)
                    {
                        var moved = new ShaderValue { Iterator = it with { Position = it.Position + (u.Op.EndsWith("++", StringComparison.Ordinal) ? 1 : -1) } };
                        Store(u.Operand, moved);
                        return u.Op.StartsWith("post", StringComparison.Ordinal) ? old : moved;
                    }
                    var changed = BinaryOp(u.Op.EndsWith("++", StringComparison.Ordinal) ? "+" : "-", old, ShaderValue.Scalar(1), u.Line);
                    Store(u.Operand, changed);
                    return u.Op.StartsWith("post", StringComparison.Ordinal) ? old : changed;
                }
                var v = Eval(u.Operand);
                if (v.V is null) throw new ShaderRuntimeException($"invalid operand to '{u.Op}'", u.Line);
                return u.Op switch
                {
                    "-" => new ShaderValue { V = v.V.Select(x => -x).ToArray(), Cols = v.Cols },
                    "!" => ShaderValue.Scalar(v.X == 0 ? 1 : 0),
                    _ => v,
                };
            }
            case Binary b:
            {
                if (b.Op == "&&") return ShaderValue.Scalar(Truthy(Eval(b.Left)) && Truthy(Eval(b.Right)) ? 1 : 0);
                if (b.Op == "||") return ShaderValue.Scalar(Truthy(Eval(b.Left)) || Truthy(Eval(b.Right)) ? 1 : 0);
                return BinaryOp(b.Op, Eval(b.Left), Eval(b.Right), b.Line);
            }
            case Conditional c:
                return Truthy(Eval(c.Condition)) ? Eval(c.Then) : Eval(c.Else);
            case InitList list:
            {
                var items = list.Items.Select(Eval).ToList();
                // { 1, 2, 3 } of scalars is a vector; anything else an array.
                if (items.All(i => i.V is { Length: 1 }) && items.Count <= 4) return ShaderValue.Vec(items.Select(i => i.X).ToArray());
                return ShaderValue.Array(items.ToArray());
            }
            case Call c:
                return CallExpr(c);
            default:
                throw new ShaderRuntimeException("unsupported expression", e.Line);
        }
    }

    /// <summary>The component indices of a swizzle (.xyz, .rgba, .stpq), or null.</summary>
    internal static int[]? Swizzle(string s)
    {
        if (s.Length is 0 or > 4) return null;
        var r = new int[s.Length];
        foreach (var set in new[] { "xyzw", "rgba", "stpq" })
        {
            bool ok = true;
            for (int i = 0; i < s.Length && ok; i++)
            {
                r[i] = set.IndexOf(s[i]);
                ok = r[i] >= 0;
            }
            if (ok) return r;
        }
        return null;
    }

    private ShaderValue BinaryOp(string op, ShaderValue a, ShaderValue b, int line)
    {
        // C++ strings: "offsets[" + std::to_string(i) + "]".
        if (op == "+" && (a.Text is not null || b.Text is not null) && Lenient)
            return ShaderValue.Str((a.Text ?? a.ToString()) + (b.Text ?? b.ToString()));
        // C++ API flags (VK_SAMPLE_COUNT_4_BIT, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_GEOMETRY_BIT): a set of
        // names, "A|B"; & keeps the names in both (none: 0), | joins them.
        if (Lenient && op is "|" or "&" && (a.Text is not null || b.Text is not null) && (a.Text is not null || a.X == 0) && (b.Text is not null || b.X == 0))
        {
            var left = (a.Text ?? "").Split('|', StringSplitOptions.RemoveEmptyEntries);
            var right = (b.Text ?? "").Split('|', StringSplitOptions.RemoveEmptyEntries);
            var flags = op == "|" ? left.Union(right).ToArray() : left.Intersect(right).ToArray();
            return flags.Length == 0 ? ShaderValue.Scalar(0) : ShaderValue.Str(string.Join("|", flags));
        }
        // C++ pointer arithmetic on an array (vertices.data() + 36): the elements from there on.
        if (Lenient && op == "+" && a.Items is not null && b.V is { Length: 1 })
            return ShaderValue.Array(a.Items.Skip((int)Math.Max(0, b.X)).ToArray());
        if (a.Iterator is { } ia && b.Iterator is { } ib && op is "==" or "!=")
            return ShaderValue.Scalar((ia.Position == ib.Position) == (op == "==") ? 1 : 0);
        if (a.V is null || b.V is null) throw new ShaderRuntimeException($"invalid operands to binary '{op}'", line);
        if (op == "*" && (a.IsMatrix || b.IsMatrix)) return MatrixMultiply(a, b, line);
        if (op is "==" or "!=" or "<" or ">" or "<=" or ">=")
        {
            bool r = op switch
            {
                "==" => a.V.SequenceEqual(b.V),
                "!=" => !a.V.SequenceEqual(b.V),
                "<" => a.X < b.X,
                ">" => a.X > b.X,
                "<=" => a.X <= b.X,
                _ => a.X >= b.X,
            };
            return ShaderValue.Scalar(r ? 1 : 0);
        }
        int n = Math.Max(a.V.Length, b.V.Length);
        if (a.V.Length != 1 && b.V.Length != 1 && a.V.Length != b.V.Length)
            throw new ShaderRuntimeException($"cannot combine a {Describe(a)} and a {Describe(b)} with '{op}'", line);
        var r2 = new double[n];
        for (int i = 0; i < n; i++)
        {
            double x = a.V[a.V.Length == 1 ? 0 : i], y = b.V[b.V.Length == 1 ? 0 : i];
            r2[i] = op switch
            {
                "+" => x + y,
                "-" => x - y,
                "*" => x * y,
                "/" => y == 0 ? 0 : x / y,
                "%" => y == 0 ? 0 : x % y,
                "&" => (long)x & (long)y,
                "|" => (long)x | (long)y,
                "^" => (long)x ^ (long)y,
                _ => throw new ShaderRuntimeException($"unsupported operator '{op}'", line),
            };
        }
        return new ShaderValue { V = r2, Cols = a.IsMatrix ? a.Cols : b.Cols };
    }

    private static string Describe(ShaderValue v) => v.IsMatrix ? $"mat{v.Cols}" : v.Size == 1 ? "float" : $"vec{v.Size}";

    /// <summary>GLSL: matrices are column-major, mat * vec treats vec as a column, vec * mat as a row.</summary>
    private static ShaderValue MatrixMultiply(ShaderValue a, ShaderValue b, int line)
    {
        if (a.IsMatrix && b.IsMatrix)
        {
            int n = a.Cols;
            if (b.Cols != n) throw new ShaderRuntimeException("matrix sizes do not match", line);
            var r = new double[n * n];
            for (int c = 0; c < n; c++)
                for (int row = 0; row < n; row++)
                {
                    double s = 0;
                    for (int k = 0; k < n; k++) s += a.V![k * n + row] * b.V![c * n + k];
                    r[c * n + row] = s;
                }
            return ShaderValue.Matrix(n, r);
        }
        if (a.IsMatrix)
        {
            int n = a.Cols;
            if (b.Size == 1) return new ShaderValue { V = a.V!.Select(x => x * b.X).ToArray(), Cols = n };
            if (b.Size != n) throw new ShaderRuntimeException($"cannot multiply a mat{n} by a vec{b.Size}", line);
            var r = new double[n];
            for (int row = 0; row < n; row++)
                for (int k = 0; k < n; k++) r[row] += a.V![k * n + row] * b.V![k];
            return ShaderValue.Vec(r);
        }
        {
            int n = b.Cols;
            if (a.Size == 1) return new ShaderValue { V = b.V!.Select(x => x * a.X).ToArray(), Cols = n };
            if (a.Size != n) throw new ShaderRuntimeException($"cannot multiply a vec{a.Size} by a mat{n}", line);
            var r = new double[n];
            for (int c = 0; c < n; c++)
                for (int k = 0; k < n; k++) r[c] += a.V![k] * b.V![c * n + k];
            return ShaderValue.Vec(r);
        }
    }

    /// <summary>Number of components of a scalar or vector type (0 = not one).</summary>
    internal static int ComponentCount(string type)
    {
        switch (type)
        {
            case "float" or "double" or "int" or "uint" or "bool" or "half" or "min16float" or "FLOAT" or "UINT" or "INT" or "GLfloat" or "GLint" or "GLuint" or "unsigned" or "uint32_t" or "int32_t" or "uint16_t" or "size_t" or "auto" or "dword" or "DWORD":
                return 1;
        }
        foreach (var prefix in new[] { "vec", "ivec", "uvec", "bvec", "dvec", "float", "int", "uint", "half", "bool", "double", "XMFLOAT", "XMINT", "XMUINT", "min16float" })
            if (type.StartsWith(prefix, StringComparison.Ordinal) && type.Length == prefix.Length + 1 && type[^1] is >= '2' and <= '4')
                return type[^1] - '0';
        return 0;
    }

    /// <summary>The size of a square matrix type (mat4, float4x4, XMFLOAT4X4, XMMATRIX), or 0.</summary>
    internal static int MatrixSize(string type) => type switch
    {
        "mat2" or "float2x2" or "dmat2" => 2,
        "mat3" or "float3x3" or "XMFLOAT3X3" or "dmat3" => 3,
        "mat4" or "float4x4" or "XMFLOAT4X4" or "XMMATRIX" or "dmat4" => 4,
        _ => 0,
    };

    /// <summary>A value converted for a variable of a type: float x = vec.x keeps 1 component, vec4 v = 1.0 broadcasts.</summary>
    private ShaderValue Coerce(string type, ShaderValue v)
    {
        int n = ComponentCount(type);
        if (n == 0 || v.V is null || v.IsMatrix || v.V.Length == n) return v;
        if (v.V.Length == 1) return ShaderValue.Vec(Enumerable.Repeat(v.V[0], n).ToArray());
        if (v.V.Length > n) return ShaderValue.Vec(v.V.Take(n).ToArray());
        return ShaderValue.Vec(v.Padded(n));
    }
}
