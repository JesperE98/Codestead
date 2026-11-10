using System.Globalization;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

/// <summary>
/// Parses the subset of GLSL and HLSL that the course uses (globals, structs, uniform blocks, cbuffers and functions
/// with declarations, assignments, if, for and return) – and single C++ expressions such as
/// <c>sin(timeValue) / 2.0f + 0.5f</c>. Statements are in ShaderParser.Statements.cs, expressions in
/// ShaderParser.Expressions.cs.
/// </summary>
public sealed partial class ShaderParser
{
    private readonly List<ShaderToken> tokens;
    private int pos;

    private ShaderParser(List<ShaderToken> tokens) => this.tokens = tokens;

    /// <summary>C++ mode: a statement that does not parse is skipped (up to its ';' or block) instead of failing.</summary>
    private bool lenient;

    /// <summary>Parses C++ statements (a function body without its braces), skipping what the subset does not cover.</summary>
    public static List<Stmt> ParseStatementsLenient(string source)
    {
        var p = new ShaderParser(ShaderLexer.Tokenize(source)) { lenient = true };
        var list = new List<Stmt>();
        while (p.Peek.Kind != ShaderTokenKind.End) list.AddRange(p.StatementOrSkip());
        return list;
    }

    /// <summary>Parses a whole shader.</summary>
    public static ShaderProgram ParseProgram(string source)
    {
        var p = new ShaderParser(ShaderLexer.Tokenize(source));
        var program = p.Program();
        program.Source = source;
        return program;
    }

    /// <summary>Parses one expression (e.g. the right-hand side of a C++ assignment).</summary>
    public static Expr ParseExpression(string source)
    {
        var p = new ShaderParser(ShaderLexer.Tokenize(source));
        var e = p.Expression();
        if (p.Peek.Kind != ShaderTokenKind.End) throw new ShaderSyntaxException($"unexpected '{p.Peek.Text}'", p.Peek.Line);
        return e;
    }

    private ShaderToken Peek => tokens[pos];

    private ShaderToken PeekAt(int offset) => tokens[Math.Min(pos + offset, tokens.Count - 1)];

    private ShaderToken Next() => tokens[pos < tokens.Count - 1 ? pos++ : pos];

    private bool Accept(string text)
    {
        if (!Peek.Is(text)) return false;
        pos++;
        return true;
    }

    private ShaderToken Expect(string text)
    {
        if (!Peek.Is(text)) throw new ShaderSyntaxException(Peek.Kind == ShaderTokenKind.End ? $"expected '{text}' at end of input" : $"expected '{text}' before '{Peek.Text}'", Peek.Line);
        return Next();
    }

    private string Identifier()
    {
        if (Peek.Kind != ShaderTokenKind.Identifier) throw new ShaderSyntaxException(Peek.Kind == ShaderTokenKind.End ? "expected an identifier at end of input" : $"expected an identifier before '{Peek.Text}'", Peek.Line);
        return Next().Text;
    }

    private static readonly HashSet<string> Qualifiers = new(StringComparer.Ordinal)
    {
        "in", "out", "inout", "uniform", "const", "static", "flat", "smooth", "noperspective", "centroid", "highp", "mediump", "lowp",
        "linear", "nointerpolation", "readonly", "writeonly", "buffer", "shared", "groupshared", "precise", "invariant", "row_major", "column_major",
        "unsigned", "signed", "constexpr", "volatile", "inline",
    };

    private static readonly HashSet<string> Primitives = new(StringComparer.Ordinal)
    {
        "points", "lines", "lines_adjacency", "triangles", "triangles_adjacency", "line_strip", "triangle_strip",
    };

    private string? hlslInputPrimitive, hlslOutputPrimitive;

    /// <summary>The names the code uses (ShaderProgram.Names).</summary>
    private readonly HashSet<string> names = new(StringComparer.Ordinal);

    /// <summary>Integer constants declared so far (const int NR_LIGHTS = 32;), for array sizes.</summary>
    private readonly Dictionary<string, int> constInts = new(StringComparer.Ordinal);

    private ShaderProgram Program()
    {
        var program = new ShaderProgram();
        while (Peek.Kind != ShaderTokenKind.End)
        {
            if (Accept(";")) continue;
            if (Peek.Is("[")) // HLSL attribute: [numthreads(8, 8, 1)], [RootSignature(...)]
            {
                SkipBalanced("[", "]");
                continue;
            }
            if (Peek.Is("precision"))
            {
                while (!Accept(";")) Next();
                continue;
            }
            if (Peek.Is("struct"))
            {
                program.Structs.Add(StructDecl());
                continue;
            }
            if (Peek.Is("cbuffer") || Peek.Is("tbuffer"))
            {
                int line = Next().Line;
                var name = Identifier();
                var register = SkipRegister();
                var fields = Fields();
                Accept(";");
                program.Globals.Add(new Global("uniform", name, "", null, false, fields, null, 0, line, register));
                continue;
            }
            Global(program);
        }
        program.InputPrimitive ??= hlslInputPrimitive;
        program.OutputPrimitive ??= hlslOutputPrimitive;
        program.Names.UnionWith(names);
        return program;
    }

    private void SkipBalanced(string open, string close)
    {
        int depth = 0;
        do
        {
            var t = Next();
            if (t.Is(open)) depth++;
            else if (t.Is(close)) depth--;
            else if (t.Kind == ShaderTokenKind.End) return;
        } while (depth > 0);
    }

    /// <summary>": register(b0)" or ": register(b0, space1)" after an HLSL resource: the register's number, or null.</summary>
    private int? SkipRegister()
    {
        if (!(Peek.Is(":") && PeekAt(1).Is("register"))) return null;
        Next();
        Next();
        int? number = null;
        if (Peek.Is("(") && PeekAt(1).Kind == ShaderTokenKind.Identifier)
        {
            var m = System.Text.RegularExpressions.Regex.Match(PeekAt(1).Text, @"^[a-zA-Z](\d+)$");
            if (m.Success) number = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
        }
        SkipBalanced("(", ")");
        return number;
    }

    private Struct StructDecl()
    {
        Expect("struct");
        var name = Identifier();
        var fields = Fields();
        Accept(";");
        return new Struct(name, fields);
    }

    /// <summary>{ type name [N] [: SEMANTIC]; … }</summary>
    private List<Field> Fields()
    {
        Expect("{");
        var fields = new List<Field>();
        while (!Accept("}"))
        {
            if (Peek.Kind == ShaderTokenKind.End) throw new ShaderSyntaxException("expected '}' at end of input", Peek.Line);
            while (Peek.Kind == ShaderTokenKind.Identifier && Qualifiers.Contains(Peek.Text)) Next();
            if (Peek.Is("layout"))
            {
                Next();
                SkipBalanced("(", ")");
            }
            var type = TypeName();
            do
            {
                var id = Identifier();
                int size = ArraySuffix();
                string? semantic = null;
                if (Accept(":")) semantic = Identifier();
                fields.Add(new Field(type, id, semantic, size));
            } while (Accept(","));
            Expect(";");
        }
        return fields;
    }

    /// <summary>A type name, with template arguments (Texture2D&lt;float4&gt;, matrix&lt;float, 4, 4&gt;).</summary>
    /// <summary>The template arguments of the last type name read (std::array&lt;VkClearValue, 2&gt; → "VkClearValue", "2").</summary>
    private List<List<ShaderToken>> templateArgs = new();

    private string TypeName()
    {
        var type = Identifier();
        templateArgs = new();
        if (Peek.Is("<"))
        {
            int depth = 0;
            var current = new List<ShaderToken>();
            do
            {
                var t = Next();
                if (t.Is("<")) depth++;
                else if (t.Is(">")) depth--;
                if (depth == 1 && t.Is(",") || depth == 0 && t.Is(">"))
                {
                    templateArgs.Add(current);
                    current = new();
                }
                else if (!(depth == 1 && t.Is("<"))) current.Add(t);
            } while (depth > 0 && Peek.Kind != ShaderTokenKind.End);
        }
        // A nested C++ type: std::map<float, glm::vec3>::reverse_iterator.
        while (Peek.Is("::") && PeekAt(1).Kind == ShaderTokenKind.Identifier)
        {
            Next();
            type += "::" + Next().Text;
        }
        return type;
    }

    /// <summary>[N] after a name: N (0 = not an array, -1 = size from the initializer).</summary>
    private int ArraySuffix()
    {
        if (!Accept("[")) return 0;
        if (Accept("]")) return -1;
        var n = Next();
        Expect("]");
        // A size named by a constant: const int NR_LIGHTS = 32; uniform Light lights[NR_LIGHTS];
        if (n.Kind != ShaderTokenKind.Number && constInts.TryGetValue(n.Text, out var named)) return named;
        return n.Kind == ShaderTokenKind.Number ? (int)double.Parse(n.Text, CultureInfo.InvariantCulture) : -1;
    }

    private void Global(ShaderProgram program)
    {
        int line = Peek.Line;
        int? location = null, binding = null;
        bool pushConstant = false;
        string? primitive = null;
        int? maxVertices = null;
        if (Accept("layout"))
        {
            Expect("(");
            while (!Accept(")"))
            {
                var key = Next();
                if (key.Kind == ShaderTokenKind.End) throw new ShaderSyntaxException("expected ')' at end of input", key.Line);
                if (key.Is("push_constant")) pushConstant = true;
                if (key.Kind == ShaderTokenKind.Identifier && Primitives.Contains(key.Text)) primitive = key.Text;
                if (key.Is("max_vertices") && Peek.Is("=") && PeekAt(1).Kind == ShaderTokenKind.Number) maxVertices = (int)double.Parse(PeekAt(1).Text, CultureInfo.InvariantCulture);
                if ((key.Is("location") || key.Is("binding")) && Accept("="))
                {
                    var v = Next();
                    if (v.Kind == ShaderTokenKind.Number)
                    {
                        var n = (int)double.Parse(v.Text, CultureInfo.InvariantCulture);
                        if (key.Is("location")) location = n;
                        else binding = n;
                    }
                }
            }
        }
        string storage = "";
        while (Peek.Kind == ShaderTokenKind.Identifier && Qualifiers.Contains(Peek.Text))
        {
            var q = Next().Text;
            if (q is "in" or "out" or "uniform" or "buffer") storage = q;
            else if (q == "const" && storage == "") storage = "const";
        }
        // "layout(local_size_x = 8) in;", and a geometry shader's "layout (points) in;" / "layout (triangle_strip, max_vertices = 3) out;"
        if (Accept(";"))
        {
            if (storage == "in" && primitive is not null) program.InputPrimitive = primitive;
            if (storage == "out" && primitive is not null) program.OutputPrimitive = primitive;
            if (storage == "out" && maxVertices is not null) program.MaxVertices = maxVertices.Value;
            return;
        }
        var type = TypeName();
        // A block: uniform Name { … } instance;
        if (Peek.Is("{"))
        {
            var fields = Fields();
            string instance = "";
            if (Peek.Kind == ShaderTokenKind.Identifier) instance = Identifier();
            ArraySuffix();
            Expect(";");
            program.Globals.Add(new Global(storage == "" ? "uniform" : storage, type, instance, location, pushConstant, fields, null, 0, line, binding));
            return;
        }
        var id = Identifier();
        if (Peek.Is("("))
        {
            program.Functions.Add(FunctionRest(type, id, line));
            return;
        }
        while (true)
        {
            int size = ArraySuffix();
            string? semantic = null;
            int? register = null;
            if (Peek.Is(":") && PeekAt(1).Is("register")) register = SkipRegister();
            else if (Accept(":")) semantic = Identifier();
            Expr? value = Accept("=") ? Initializer() : null;
            // HLSL resources (Texture2D, SamplerState …) and plain HLSL globals are uniforms.
            var st = storage == "" && (type.StartsWith("Texture", StringComparison.Ordinal) || type.StartsWith("Sampler", StringComparison.Ordinal) || type.StartsWith("RWTexture", StringComparison.Ordinal)) ? "uniform" : storage;
            program.Globals.Add(new Global(st, type, id, location, pushConstant, null, value, size, line, register ?? binding));
            // (HLSL: static const int N = 32; – the storage is "static" there)
            if (st is "const" or "static" && type is "int" or "uint" && value is Number constant) constInts[id] = (int)constant.Value;
            _ = semantic;
            if (!Accept(",")) break;
            id = Identifier();
        }
        Expect(";");
    }

    private Function FunctionRest(string returnType, string id, int line)
    {
        Expect("(");
        var ps = new List<Param>();
        if (!Accept(")"))
        {
            if (Peek.Is("void") && PeekAt(1).Is(")"))
            {
                Next();
                Next();
            }
            else
            {
                do
                {
                    bool isOut = false;
                    while (Peek.Kind == ShaderTokenKind.Identifier && Qualifiers.Contains(Peek.Text))
                        if (Next().Text is "out" or "inout") isOut = true;
                    // An HLSL geometry shader's input: "triangle VSOutput input[3]".
                    if (Peek.Kind == ShaderTokenKind.Identifier && Peek.Text is "point" or "line" or "triangle" or "lineadj" or "triangleadj"
                        && PeekAt(1).Kind == ShaderTokenKind.Identifier && PeekAt(2).Kind == ShaderTokenKind.Identifier)
                        hlslInputPrimitive = Next().Text switch { "point" => "points", "line" => "lines", "triangle" => "triangles", var x => x };
                    var type = TypeName();
                    if (type is "PointStream" or "LineStream" or "TriangleStream")
                        hlslOutputPrimitive = type switch { "PointStream" => "points", "LineStream" => "line_strip", _ => "triangle_strip" };
                    var name = Identifier();
                    ArraySuffix();
                    string? semantic = Accept(":") ? Identifier() : null;
                    ps.Add(new Param(type, name, semantic, isOut));
                } while (Accept(","));
                Expect(")");
            }
        }
        string? retSemantic = Accept(":") ? Identifier() : null;
        if (Accept(";")) return new Function(returnType, id, ps, retSemantic, [], line);
        var body = Block();
        return new Function(returnType, id, ps, retSemantic, body, line);
    }
}
