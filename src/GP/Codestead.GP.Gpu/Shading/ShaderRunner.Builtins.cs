using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

// Calls: constructors, built-in functions of GLSL and HLSL, texture sampling, the shader's own functions,
// and the few C++ calls the simulator understands (glfwGetTime, the size of a container).
public sealed partial class ShaderRunner
{
    private ShaderValue CallExpr(Call c)
    {
        var name = c.Function;
        if (name == "string") return ShaderValue.Str(((Name)c.Args[0]).Id);
        if (c.ArrayConstructor) return ShaderValue.Array(c.Args.Select(a => Coerce(name, Eval(a))).ToArray());
        if (name.StartsWith('.'))
        {
            if (Lenient && Hook?.Invoke(name, c.Args) is { } methodHooked) return methodHooked;
            return Method(name[1..], c);
        }
        if (name is "glfwGetTime")
        {
            UsedTime = true;
            return ShaderValue.Scalar(Time);
        }
        // DirectXMath stores into its first argument: XMStoreFloat4x4(&constants.transform, m).
        if (name.StartsWith("XMStoreFloat", StringComparison.Ordinal) && c.Args.Count == 2)
        {
            Store(c.Args[0], Eval(c.Args[1]));
            return ShaderValue.Scalar(0);
        }
        if (name is "sizeof") return ShaderValue.Scalar(SizeOf(c.Args.FirstOrDefault()));

        // The shader's own functions and structs.
        if (program.FindFunction(name) is { } f)
        {
            var args = c.Args.Select(Eval).ToList();
            var r = Invoke(f, args);
            return r ?? ShaderValue.Scalar(0);
        }
        if (program.FindStruct(name) is { } st)
        {
            var args = c.Args.Select(Eval).ToList();
            var fields = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            for (int i = 0; i < st.Fields.Count; i++) fields[st.Fields[i].Id] = i < args.Count ? Coerce(st.Fields[i].Type, args[i]) : Default(st.Fields[i].Type);
            return ShaderValue.Struct(fields);
        }

        int m = MatrixSize(name);
        if (m > 0) return MatrixConstructor(m, c.Args.Select(Eval).ToList(), c.Line);
        int n = ComponentCount(name);
        if (n > 0) return VectorConstructor(name, n, c.Args.Select(Eval).ToList(), c.Line);

        // C++ mode: the API calls go to the hook before their arguments are evaluated (they name API objects).
        if (Lenient && Hook?.Invoke(name, c.Args) is { } hooked) return hooked;
        var a = c.Args.Select(Eval).ToList();
        if (MatrixFunction(name, a, c.Line) is { } matrix) return matrix;
        ShaderValue Map(Func<double, double> fn) => Need(1) ? new ShaderValue { V = a[0].V!.Select(fn).ToArray() } : throw Arity();
        ShaderValue Zip(Func<double, double, double> fn) => Need(2) ? Componentwise(a[0], a[1], fn, c.Line) : throw Arity();
        bool Need(int count) => a.Count == count && a.All(x => x.V is not null);
        ShaderRuntimeException Arity() => new($"wrong arguments to '{name}'", c.Line);

        switch (name)
        {
            case "sin": return Map(Math.Sin);
            case "cos": return Map(Math.Cos);
            case "tan": return Map(Math.Tan);
            case "asin": return Map(Math.Asin);
            case "acos": return Map(Math.Acos);
            case "atan" or "atan2" when a.Count == 2: return Zip(Math.Atan2);
            case "atan": return Map(Math.Atan);
            case "radians": return Map(x => x * Math.PI / 180);
            case "degrees": return Map(x => x * 180 / Math.PI);
            case "XMConvertToRadians": return Map(x => x * Math.PI / 180);
            case "exp": return Map(Math.Exp);
            case "exp2": return Map(x => Math.Pow(2, x));
            case "log": return Map(Math.Log);
            case "log2": return Map(Math.Log2);
            case "sqrt": return Map(Math.Sqrt);
            case "inversesqrt" or "rsqrt": return Map(x => 1 / Math.Sqrt(x));
            case "abs" or "fabs": return Map(Math.Abs);
            case "sign": return Map(x => Math.Sign(x));
            case "floor": return Map(Math.Floor);
            case "ceil": return Map(Math.Ceiling);
            case "round": return Map(Math.Round);
            case "trunc": return Map(Math.Truncate);
            case "fract" or "frac": return Map(x => x - Math.Floor(x));
            case "saturate": return Map(x => Math.Clamp(x, 0, 1));
            case "pow": return Zip(Math.Pow);
            case "mod": return Zip((x, y) => x - y * Math.Floor(x / y));
            case "fmod": return Zip((x, y) => x % y);
            case "min" or "fmin": return Zip(Math.Min);
            case "max" or "fmax": return Zip(Math.Max);
            case "step": return Zip((edge, x) => x < edge ? 0 : 1);
            case "clamp" when a.Count == 3:
                return Componentwise(Componentwise(a[0], a[1], Math.Max, c.Line), a[2], Math.Min, c.Line);
            case "mix" or "lerp" when a.Count == 3:
            {
                var d = Componentwise(a[1], a[0], (x, y) => x - y, c.Line);
                return Componentwise(a[0], Componentwise(d, a[2], (x, y) => x * y, c.Line), (x, y) => x + y, c.Line);
            }
            case "smoothstep" when a.Count == 3:
            {
                var t = Componentwise(Componentwise(a[2], a[0], (x, y) => x - y, c.Line), Componentwise(a[1], a[0], (x, y) => x - y, c.Line), (x, y) => y == 0 ? 0 : Math.Clamp(x / y, 0, 1), c.Line);
                return new ShaderValue { V = t.V!.Select(x => x * x * (3 - 2 * x)).ToArray() };
            }
            case "length": return Need(1) ? ShaderValue.Scalar(Math.Sqrt(a[0].V!.Sum(x => x * x))) : throw Arity();
            case "distance": return Need(2) ? ShaderValue.Scalar(Math.Sqrt(a[0].V!.Zip(a[1].V!, (x, y) => (x - y) * (x - y)).Sum())) : throw Arity();
            case "dot": return Need(2) ? ShaderValue.Scalar(a[0].V!.Zip(a[1].V!, (x, y) => x * y).Sum()) : throw Arity();
            case "normalize":
            {
                if (!Need(1)) throw Arity();
                double len = Math.Sqrt(a[0].V!.Sum(x => x * x));
                return ShaderValue.Vec(a[0].V!.Select(x => len == 0 ? 0 : x / len).ToArray());
            }
            case "cross":
            {
                if (!Need(2)) throw Arity();
                var p = a[0].Padded(3);
                var q = a[1].Padded(3);
                return ShaderValue.Vec(p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]);
            }
            case "reflect":
            {
                if (!Need(2)) throw Arity();
                double d = a[0].V!.Zip(a[1].V!, (x, y) => x * y).Sum();
                return ShaderValue.Vec(a[0].V!.Zip(a[1].V!, (i, nn) => i - 2 * d * nn).ToArray());
            }
            case "transpose":
                if (a.Count != 1 || !a[0].IsMatrix) throw Arity();
                return Transpose(a[0]);
            case "mul":
                // HLSL: mul(vector, matrix) treats the vector as a row; mul(matrix, vector) as a column.
                if (a.Count != 2) throw Arity();
                return MatrixMultiply(a[0], a[1], c.Line);
            case "texture" or "texture2D":
                if (a.Count < 2) throw Arity();
                return SampleTexture(c.Args[0], a[1]);
            default:
                if (Lenient) return ShaderValue.Scalar(0);
                throw new ShaderRuntimeException($"'{name}' was not declared in this scope", c.Line);
        }
    }

    /// <summary>sizeof in bytes, counting every number as 4 bytes (float, int, uint32_t); a 16-bit index type is 2.</summary>
    private double SizeOf(Expr? e)
    {
        if (e is Name n)
        {
            if (n.Id is "float" or "int" or "GLfloat" or "GLint" or "GLuint" or "uint32_t" or "int32_t" or "unsigned" or "UINT" or "DWORD") return 4;
            if (n.Id is "uint16_t" or "UINT16" or "GLushort" or "short" or "unsigned short") return 2;
            if (n.Id is "double" or "uint64_t" or "size_t") return 8;
            int comps = ComponentCount(n.Id);
            if (comps > 0) return 4 * comps;
            int m = MatrixSize(n.Id);
            if (m > 0) return 4 * m * m;
        }
        if (e is null) return 0;
        try
        {
            return 4 * CountNumbers(Eval(e));
        }
        catch (ShaderRuntimeException)
        {
            return 0;
        }
    }

    private static int CountNumbers(ShaderValue v) =>
        v.V?.Length ?? v.Items?.Sum(CountNumbers) ?? v.Fields?.Values.Sum(CountNumbers) ?? 0;

    private ShaderValue Method(string method, Call c)
    {
        switch (method)
        {
            case "Sample" or "SampleLevel" when c.Args.Count >= 3:
                return SampleTexture(c.Args[0], Eval(c.Args[2]));
            case "size" or "length" or "Length" or "count":
            {
                var target = Eval(c.Args[0]);
                return ShaderValue.Scalar(target.Items?.Length ?? target.V?.Length ?? 0);
            }
            case "data" or "c_str":
                return Eval(c.Args[0]);
            default:
                if (Lenient) return ShaderValue.Scalar(0);
                throw new ShaderRuntimeException($"no member function '{method}'", c.Line);
        }
    }

    private ShaderValue SampleTexture(Expr texture, ShaderValue uv)
    {
        var id = texture switch
        {
            Name n => n.Id,
            Member m => m.Field,
            IndexOf { Target: Name n } => n.Id,
            _ => "",
        };
        var rgba = Sample?.Invoke(id, uv.Padded(2)[0], uv.Padded(2)[1]) ?? [1, 0, 1, 1];
        return ShaderValue.Vec(rgba);
    }

    private static ShaderValue Componentwise(ShaderValue a, ShaderValue b, Func<double, double, double> fn, int line)
    {
        if (a.V is null || b.V is null) throw new ShaderRuntimeException("expected numbers", line);
        int n = Math.Max(a.V.Length, b.V.Length);
        var r = new double[n];
        for (int i = 0; i < n; i++) r[i] = fn(a.V[a.V.Length == 1 ? 0 : Math.Min(i, a.V.Length - 1)], b.V[b.V.Length == 1 ? 0 : Math.Min(i, b.V.Length - 1)]);
        return ShaderValue.Vec(r);
    }

    private static ShaderValue VectorConstructor(string type, int n, List<ShaderValue> args, int line)
    {
        var parts = new List<double>();
        foreach (var a in args)
        {
            if (a.V is null) throw new ShaderRuntimeException($"cannot build a {type} from this value", line);
            parts.AddRange(a.V);
        }
        if (parts.Count == 0) return ShaderValue.Vec(new double[n]);
        if (parts.Count == 1) return ShaderValue.Vec(Enumerable.Repeat(parts[0], n).ToArray());
        if (parts.Count < n) throw new ShaderRuntimeException($"too few components to construct '{type}'", line);
        return ShaderValue.Vec(parts.Take(n).ToArray());
    }

    private static ShaderValue MatrixConstructor(int n, List<ShaderValue> args, int line)
    {
        if (args.Count == 0) return ShaderValue.Identity(n);
        if (args.Count == 1 && args[0].V is { Length: 1 })
        {
            var r = ShaderValue.Identity(n);
            return ShaderValue.Matrix(n, r.V!.Select(x => x * args[0].X).ToArray());
        }
        if (args.Count == 1 && args[0].IsMatrix)
        {
            var src = args[0];
            var r = ShaderValue.Identity(n).V!;
            for (int col = 0; col < Math.Min(n, src.Cols); col++)
                for (int row = 0; row < Math.Min(n, src.Cols); row++) r[col * n + row] = src.V![col * src.Cols + row];
            return ShaderValue.Matrix(n, r);
        }
        var flat = args.SelectMany(a => a.V ?? throw new ShaderRuntimeException("cannot build a matrix from this value", line)).ToArray();
        if (flat.Length != n * n) throw new ShaderRuntimeException($"a mat{n} needs {n * n} components", line);
        return ShaderValue.Matrix(n, flat);
    }
}
