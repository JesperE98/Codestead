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
        // A shader's maths and constructors, the calls a fragment makes most: straight to the result.
        if (!Lenient && FastCall(c, name) is { } fast) return fast;
        // C++: std::fmaxf, std::sqrt … are the maths functions themselves.
        if (Lenient && name.StartsWith("std::", StringComparison.Ordinal) && name.Length > 5) name = name[5..];
        if (name.StartsWith('.'))
        {
            if (Lenient && Hook?.Invoke(name, c.Args) is { } methodHooked) return methodHooked;
            return Method(name[1..], c);
        }
        if (name is "EmitVertex" or "EndPrimitive" && Emit is not null)
        {
            Emit(name, null);
            return ShaderValue.Scalar(0);
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
        // offsetof(Vertex, texCoord): the bytes of the fields before it (4 per number, no padding).
        if (name is "offsetof" && c.Args is [Name structName, Name fieldName] && program.FindStruct(structName.Id) is { } offStruct)
        {
            int at = 0;
            foreach (var member in offStruct.Fields)
            {
                if (member.Id == fieldName.Id) return ShaderValue.Scalar(at);
                at += 4 * CountNumbers(Default(member.Type)) * Math.Max(1, member.ArraySize);
            }
            return ShaderValue.Scalar(0);
        }
        if (Lenient && name == "__newarray" && c.Args is [Name elementType, var countExpr])
        {
            int newCount = (int)Math.Max(0, Math.Min(100000, Eval(countExpr).X));
            return ShaderValue.Array(Enumerable.Range(0, newCount).Select(_ => Default(elementType.Id)).ToArray());
        }
        // The C library's random numbers, as glibc makes them (the same sequence for the same seed on Linux).
        if (Lenient && name is "srand" && c.Args.Count == 1)
        {
            random = new GlibcRandom((uint)Eval(c.Args[0]).X);
            return ShaderValue.Scalar(0);
        }
        if (Lenient && name is "rand" && c.Args.Count == 0) return ShaderValue.Scalar((random ??= new GlibcRandom(1)).Next());
        if (Lenient && name is "to_string" && c.Args.Count == 1)
        {
            var x = Eval(c.Args[0]);
            return ShaderValue.Str(x.Text ?? (x.X == Math.Floor(x.X) && Math.Abs(x.X) < 1e15 ? ((long)x.X).ToString(System.Globalization.CultureInfo.InvariantCulture) : x.X.ToString("0.000000", System.Globalization.CultureInfo.InvariantCulture)));
        }
        // _countof(array): the number of elements of a C array (MSVC's macro, used by the D3D12 samples).
        if (name is "_countof" && c.Args.Count == 1)
        {
            try
            {
                var arr = Eval(c.Args[0]);
                return ShaderValue.Scalar(arr.Items?.Length ?? arr.Map?.Count ?? arr.V?.Length ?? 0);
            }
            catch (ShaderRuntimeException) when (Lenient)
            {
                return ShaderValue.Scalar(0);
            }
        }

        // The shader's own functions and structs.
        if (program.FindFunction(name) is { } f) return CallFunction(f, c);
        if (program.FindStruct(name) is { } st)
        {
            var args = c.Args.Select(Eval).ToList();
            var fields = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            for (int i = 0; i < st.Fields.Count; i++) fields[st.Fields[i].Id] = i < args.Count ? Coerce(st.Fields[i].Type, args[i]) : Default(st.Fields[i].Type);
            return ShaderValue.Struct(fields);
        }

        int m = MatrixSize(name);
        if (m > 0)
        {
            var made = MatrixConstructor(m, c.Args.Select(Eval).ToList(), c.Line);
            // HLSL's float4x4(…) and DirectXMath's XMFLOAT4X4(…) take the matrix row by row, GLSL's mat4(…) column by
            // column (one matrix argument is a cast either way).
            bool rows = name is "float4x4" or "float3x3" or "float2x2" or "XMFLOAT4X4" or "XMFLOAT3X3" or "XMMATRIX";
            return rows && c.Args.Count > 1 ? Transpose(made) : made;
        }
        int n = ComponentCount(name);
        // int(x), uint(x): the whole part, as an integer.
        if (n == 1 && ShaderValue.IsIntType(name) && c.Args.Count == 1 && Eval(c.Args[0]) is { V: { Length: > 0 } } whole) return ShaderValue.Integer(Math.Truncate(whole.X));
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
            case "min" or "fmin" or "fminf": return Zip(Math.Min);
            case "max" or "fmax" or "fmaxf": return Zip(Math.Max);
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
            case "refract":
            {
                // refract(I, N, eta): the GLSL/HLSL formula; a zero vector past the critical angle.
                if (a.Count != 3 || a.Any(x => x.V is null)) throw Arity();
                var i = a[0].V!;
                var nn = a[1].V!;
                double eta = a[2].X, d = i.Zip(nn, (x, y) => x * y).Sum();
                double k = 1 - eta * eta * (1 - d * d);
                if (k < 0) return ShaderValue.Vec(new double[i.Length]);
                double factor = eta * d + Math.Sqrt(k);
                return ShaderValue.Vec(i.Select((x, j) => eta * x - factor * nn[Math.Min(j, nn.Length - 1)]).ToArray());
            }
            case "transpose":
                if (a.Count != 1 || !a[0].IsMatrix) throw Arity();
                return Transpose(a[0]);
            case "mul":
                // HLSL: mul(vector, matrix) treats the vector as a row; mul(matrix, vector) as a column.
                if (a.Count != 2) throw Arity();
                return MatrixMultiply(a[0], a[1], c.Line);
            case "texture" or "texture2D" or "textureCube":
                if (a.Count < 2) throw Arity();
                return SampleTexture(c.Args[0], a[1]);
            case "textureLod":
                // textureLod(sampler, coordinates, lod): the mip level is given (a cube map's pre-filtered levels).
                if (a.Count < 2) throw Arity();
                return SampleTexture(c.Args[0], a[1], null, a.Count >= 3 ? a[2].X : null);
            case "texelFetch":
            {
                // texelFetch(sampler, ivec2 texel, lod): the texel's centre.
                if (a.Count < 2) throw Arity();
                var size = TextureSize?.Invoke(PathOf(c.Args[0])) ?? (1, 1);
                var p = a[1].Padded(2);
                return SampleTexture(c.Args[0], ShaderValue.Vec((Math.Floor(p[0]) + 0.5) / size.Width, (Math.Floor(p[1]) + 0.5) / size.Height), null, 0);
            }
            case "textureSize":
            {
                if (a.Count < 1) throw Arity();
                var size = TextureSize?.Invoke(PathOf(c.Args[0])) ?? (1, 1);
                return ShaderValue.Vec(size.Width, size.Height);
            }
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
            // A struct of the program (sizeof(Vertex)): its fields' numbers.
            if (program.FindStruct(n.Id) is not null) return 4 * CountNumbers(Default(n.Id));
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
            case "Append" when Emit is not null && c.Args.Count >= 2:
                Emit("Append", Eval(c.Args[1]));
                return ShaderValue.Scalar(0);
            case "RestartStrip" when Emit is not null:
                Emit("RestartStrip", null);
                return ShaderValue.Scalar(0);
            case "Sample" or "SampleLevel" when c.Args.Count >= 3:
                // HLSL names the sampler: the texture is looked up as "texture|sampler". SampleLevel gives the mip level.
                return SampleTexture(c.Args[0], Eval(c.Args[2]), PathOf(c.Args[1]), method == "SampleLevel" && c.Args.Count >= 4 ? Eval(c.Args[3]).X : null);
            case "size" or "length" or "Length" or "count":
            {
                var target = Eval(c.Args[0]);
                return ShaderValue.Scalar(target.Map?.Count ?? target.Items?.Length ?? target.V?.Length ?? 0);
            }
            case "begin" or "end" or "rbegin" or "rend" when Eval(c.Args[0]).Map is { } map:
                return new ShaderValue { Iterator = new MapIterator(map, method.EndsWith("end", StringComparison.Ordinal) && !method.EndsWith("begin", StringComparison.Ordinal) ? map.Count : 0, method.StartsWith('r')) };
            case "data" or "c_str":
                return Eval(c.Args[0]);
            case "Get" or "get" when Lenient && c.Args.Count == 1:
                // ComPtr<T>::Get(), unique_ptr<T>::get(): the pointer itself (a resource passed to a helper).
                try
                {
                    return Eval(c.Args[0]);
                }
                catch (ShaderRuntimeException)
                {
                    return ShaderValue.Scalar(0);
                }
            case "push_back" or "emplace_back" when Lenient && c.Args.Count >= 2:
            {
                // vector.push_back(x): the variable holds a new, longer array.
                var vec = Eval(c.Args[0]);
                var item = Eval(c.Args[1]).Clone();
                Store(c.Args[0], ShaderValue.Array([.. vec.Items ?? [], item]));
                return ShaderValue.Scalar(0);
            }
            case "GetDimensions" when c.Args.Count >= 3:
            {
                // HLSL Texture2D::GetDimensions(out width, out height): the texture's size in texels.
                var size = TextureSize?.Invoke(PathOf(c.Args[0])) ?? (1, 1);
                Store(c.Args[1], ShaderValue.Scalar(size.Width));
                Store(c.Args[2], ShaderValue.Scalar(size.Height));
                return ShaderValue.Scalar(0);
            }
            case "resize" when Lenient && c.Args.Count >= 2:
            {
                var vec = Eval(c.Args[0]);
                int n = (int)Math.Max(0, Math.Min(4096, Eval(c.Args[1]).X));
                var old = vec.Items ?? [];
                Store(c.Args[0], ShaderValue.Array(Enumerable.Range(0, n).Select(i => i < old.Length ? old[i] : ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal))).ToArray()));
                return ShaderValue.Scalar(0);
            }
            default:
                if (Lenient) return ShaderValue.Scalar(0);
                throw new ShaderRuntimeException($"no member function '{method}'", c.Line);
        }
    }

    private ShaderValue CallFunction(Function f, Call c)
    {
        var args = new ShaderValue[c.Args.Count];
        for (int i = 0; i < args.Length; i++) args[i] = Eval(c.Args[i]);
        return Invoke(f, args) ?? ShaderValue.Scalar(0);
    }

    private static readonly Func<double, double>[] UnaryMath =
    [
        Math.Sin, Math.Cos, Math.Tan, Math.Asin, Math.Acos, Math.Atan, x => x * Math.PI / 180, x => x * 180 / Math.PI, Math.Exp, x => Math.Pow(2, x),
        Math.Log, Math.Log2, Math.Sqrt, x => 1 / Math.Sqrt(x), Math.Abs, x => Math.Sign(x), Math.Floor, Math.Ceiling, Math.Round, Math.Truncate,
        x => x - Math.Floor(x), x => Math.Clamp(x, 0, 1),
    ];

    private static readonly Func<double, double, double>[] BinaryMath =
    [
        Math.Pow, (x, y) => x - y * Math.Floor(x / y), (x, y) => x % y, Math.Min, Math.Max, (edge, x) => x < edge ? 0 : 1, Math.Atan2,
    ];

    /// <summary>The built-in functions with a fast path: 0–99 one argument, 100–199 two, 200 and up their own code.</summary>
    private static readonly Dictionary<string, int> FastCalls = new(StringComparer.Ordinal)
    {
        ["sin"] = 0, ["cos"] = 1, ["tan"] = 2, ["asin"] = 3, ["acos"] = 4, ["atan"] = 5, ["radians"] = 6, ["degrees"] = 7, ["exp"] = 8, ["exp2"] = 9,
        ["log"] = 10, ["log2"] = 11, ["sqrt"] = 12, ["inversesqrt"] = 13, ["rsqrt"] = 13, ["abs"] = 14, ["fabs"] = 14, ["sign"] = 15, ["floor"] = 16, ["ceil"] = 17,
        ["round"] = 18, ["trunc"] = 19, ["fract"] = 20, ["frac"] = 20, ["saturate"] = 21,
        ["pow"] = 100, ["mod"] = 101, ["fmod"] = 102, ["min"] = 103, ["max"] = 104, ["step"] = 105, ["atan2"] = 106,
        ["clamp"] = 200, ["mix"] = 201, ["lerp"] = 201, ["length"] = 202, ["dot"] = 203, ["normalize"] = 204, ["cross"] = 205, ["reflect"] = 206,
        ["texture"] = 300, ["texture2D"] = 300, ["textureCube"] = 300, ["textureLod"] = 301,
    };

    /// <summary>
    /// A call of a built-in maths function, a vector constructor or one of the shader's own functions, without the
    /// lists and checks of the general path; null when the call is something else (the general path takes it).
    /// The results are the general path's.
    /// </summary>
    private ShaderValue? FastCall(Call c, string name)
    {
        if (c.ArrayConstructor || name.Length == 0 || name[0] == '.') return null;
        if (program.FindFunction(name) is { } own) return CallFunction(own, c);
        var args = c.Args;
        if (!FastCalls.TryGetValue(name, out int op))
        {
            // vec3(…), float4(…), float(x): the components in order (one number fills the vector).
            int n = ComponentCount(name);
            if (n == 0 || args.Count == 0 || program.FindStruct(name) is not null || MatrixSize(name) > 0 || (n == 1 && ShaderValue.IsIntType(name))) return null;
            if (args.Count == 1)
            {
                var only = Eval(args[0]);
                if (only.V is not { } v) throw new ShaderRuntimeException($"cannot build a {name} from this value", c.Line);
                var made = new double[n];
                if (v.Length == 1) Array.Fill(made, v[0]);
                else if (v.Length < n) throw new ShaderRuntimeException($"too few components to construct '{name}'", c.Line);
                else Array.Copy(v, made, n);
                return ShaderValue.Vec(made);
            }
            var parts = new double[n];
            int count = 0;
            for (int i = 0; i < args.Count; i++)
            {
                if (Eval(args[i]).V is not { } v) throw new ShaderRuntimeException($"cannot build a {name} from this value", c.Line);
                for (int k = 0; k < v.Length; k++, count++)
                    if (count < n) parts[count] = v[k];
            }
            if (count == 1) Array.Fill(parts, parts[0]);
            else if (count < n) throw new ShaderRuntimeException($"too few components to construct '{name}'", c.Line);
            return ShaderValue.Vec(parts);
        }
        if (program.FindStruct(name) is not null) return null;
        ShaderRuntimeException Arity() => new($"wrong arguments to '{name}'", c.Line);
        if (op < 100)
        {
            if (args.Count == 2 && op == 5) op = 106;
            else
            {
                if (args.Count != 1) return null;
                if (Eval(args[0]).V is not { } v) throw Arity();
                var fn = UnaryMath[op];
                var r = new double[v.Length];
                for (int i = 0; i < r.Length; i++) r[i] = fn(v[i]);
                return new ShaderValue { V = r };
            }
        }
        if (op < 200)
        {
            if (args.Count != 2) return null;
            var a = Eval(args[0]);
            var b = Eval(args[1]);
            if (a.V is null || b.V is null) throw Arity();
            return Componentwise(a, b, BinaryMath[op - 100], c.Line);
        }
        switch (op)
        {
            case 300 or 301:
            {
                if (args.Count < 2) return null;
                var at = Eval(args[1]);
                return SampleTexture(args[0], at, null, op == 301 && args.Count >= 3 ? Eval(args[2]).X : null);
            }
            case 200 or 201:
            {
                if (args.Count != 3) return null;
                ShaderValue a = Eval(args[0]), b = Eval(args[1]), t = Eval(args[2]);
                if (op == 200) return Componentwise(Componentwise(a, b, Math.Max, c.Line), t, Math.Min, c.Line);
                var d = Componentwise(b, a, static (x, y) => x - y, c.Line);
                return Componentwise(a, Componentwise(d, t, static (x, y) => x * y, c.Line), static (x, y) => x + y, c.Line);
            }
            case 202 or 204:
            {
                if (args.Count != 1) return null;
                if (Eval(args[0]).V is not { } v) throw Arity();
                double sum = 0;
                for (int i = 0; i < v.Length; i++) sum += v[i] * v[i];
                double len = Math.Sqrt(sum);
                if (op == 202) return ShaderValue.Scalar(len);
                var r = new double[v.Length];
                for (int i = 0; i < r.Length; i++) r[i] = len == 0 ? 0 : v[i] / len;
                return ShaderValue.Vec(r);
            }
            default:
            {
                if (args.Count != 2) return null;
                var a = Eval(args[0]).V;
                var b = Eval(args[1]).V;
                if (a is null || b is null) throw Arity();
                if (op == 205)
                {
                    double[] p = [a.Length > 0 ? a[0] : 0, a.Length > 1 ? a[1] : 0, a.Length > 2 ? a[2] : 0], q = [b.Length > 0 ? b[0] : 0, b.Length > 1 ? b[1] : 0, b.Length > 2 ? b[2] : 0];
                    return ShaderValue.Vec(p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]);
                }
                int n = Math.Min(a.Length, b.Length);
                double d = 0;
                for (int i = 0; i < n; i++) d += a[i] * b[i];
                if (op == 203) return ShaderValue.Scalar(d);
                var r = new double[n];
                for (int i = 0; i < n; i++) r[i] = a[i] - 2 * d * b[i];
                return ShaderValue.Vec(r);
            }
        }
    }

    private ShaderValue SampleTexture(Expr texture, ShaderValue uv, string? sampler = null, double? lod = null)
    {
        var id = sampler is null ? PathOf(texture) : PathOf(texture) + "|" + sampler;
        if (uv.Size >= 3 && lod is { } level && SampleCubeLod?.Invoke(id, uv.V![0], uv.V[1], uv.V[2], level) is { } mip) return ShaderValue.Vec(mip);
        if (uv.Size >= 3 && SampleCube?.Invoke(id, uv.V![0], uv.V[1], uv.V[2]) is { } cube) return ShaderValue.Vec(cube);
        var at = uv.Padded(2);
        if (Sample is null) return ShaderValue.Vec(1, 0, 1, 1);
        // A minified texture is read from its mip levels: where these coordinates go from pixel to pixel.
        Textures.Texture.Footprint = Footprint is { } footprint && lod is null ? footprint(at[0], at[1]) : null;
        try
        {
            return ShaderValue.Vec(Sample(id, at[0], at[1]));
        }
        finally
        {
            Textures.Texture.Footprint = null;
        }
    }

    /// <summary>The uniform name of a texture expression: texture1, material.diffuse, shadowMaps[2].</summary>
    private string PathOf(Expr e) => e switch
    {
        Name n => n.Id,
        Member m => PathOf(m.Target) + "." + m.Field,
        IndexOf { Target: var t } ix => PathOf(t) + "[" + (int)Math.Floor(Eval(ix.At).X) + "]",
        _ => "",
    };

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
