using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Reads an OpenGL program the way a driver would see it: walks main() call by call (GLFW, GLAD, shaders, buffers,
/// vertex arrays, uniforms, clears and draws) and records one frame of the render loop. The calls are handled in
/// GlReader.Calls.cs, the draw calls in GlReader.Draw.cs.
/// </summary>
public sealed partial class GlReader
{
    private readonly GpuProject project;
    private readonly CppSource src;
    private readonly Scene.Scene scene = new() { Api = Apis.OpenGL };
    private readonly GlState gl = new();
    private bool inLoop, glfwInit, gladLoaded, windowCreated;
    private readonly List<DrawCall> setupDraws = new();
    private readonly List<StbImage> images;
    private int statementOffset;

    private readonly CppExec env;

    private GlReader(GpuProject project, double time)
    {
        this.project = project;
        var main = project.MainFile;
        src = new CppSource(main, project.Files.TryGetValue(main, out var t) ? t : "");
        images = StbImage.All(src, project, scene);
        env = new CppExec(src, time, null, scene);
        // std::ifstream reads the project's files (a game's levels), FreeType its fonts.
        env.Runner.ReadText = project.Find;
        env.Runner.ReadBytes = project.FindAsset;
        // What the program prints (std::cout) is its output; its own code's API queries are answered here.
        env.Runner.Output = scene.Log.Add;
        env.ApiValue = ApiValue;
    }

    /// <summary>What the program does when its clock reads <paramref name="time"/> seconds.</summary>
    public static Scene.Scene Read(GpuProject project, double time = 1.0) => new GlReader(project, time).Run();

    // Values of arguments: the program's own variables first, then constants of the file.
    private ShaderValue? Eval(string expr) => env.Eval(expr) ?? src.Evaluate(expr, env.Runner.Time);

    private int? Int(string expr) => env.Int(expr) ?? src.Int(expr, env.Runner.Time);

    private List<double>? Numbers(string expr) => env.Numbers(expr) ?? src.Numbers(expr, env.Runner.Time);

    private static readonly Regex CallStart = new(@"(?<![\w.>])(?<name>gl[A-Z]\w*|glfw[A-Z]\w*|gladLoadGL(?:Loader)?|memcpy)\s*\(|(?<![\w.>])(?<obj>[A-Za-z_]\w*(?:\s*(?:\.|->)\s*[A-Za-z_]\w*|\[[^\[\]]*\])*)\s*(?:\.|->)\s*(?<method>use|setFloat|setInt|setBool|setVec2|setVec3|setVec4|setMat2|setMat3|setMat4|Draw)\s*\(", RegexOptions.CultureInvariant);
    private static readonly Regex AssignRe = new(@"^(?:[A-Za-z_][\w:<>]*(?:\s*[*&]+\s*|\s+))*(?<lhs>[A-Za-z_]\w*(?:(?:\.|->)\w+|\[[^\]=]*\])*)\s*=(?!=)\s*(?<rhs>[\s\S]+)$", RegexOptions.CultureInvariant);
    private static readonly Regex ModelRe = new(@"^Model\s+(?<name>\w+)\s*\(\s*""(?<path>[^""]+)""", RegexOptions.CultureInvariant);
    private readonly Dictionary<string, (Models.ObjModel Model, string Path)> models = new(StringComparer.Ordinal);

    private static readonly Regex ShaderClassRe = new(@"^Shader\s+(?<name>\w+)\s*\(\s*""(?<vs>[^""]+)""\s*,\s*""(?<fs>[^""]+)""(?:\s*,\s*""(?<gs>[^""]+)"")?", RegexOptions.CultureInvariant);

    private Scene.Scene Run()
    {
        if (!src.Functions.ContainsKey("main"))
        {
            scene.Notes.Add(SimNote.Error("noMain"));
            return scene;
        }
        var statements = CppStatements.Walk(src, "main").ToList();
        for (int index = 0; index < statements.Count; index++)
        {
            var st = statements[index];
            // A game (a key callback, deltaTime): the render loop runs frame by frame up to the time shown.
            if (st.Kind == "loop-start" && !inLoop && Stepped && LoopEnd(statements, index) is int end)
            {
                if (scene.SetupDraws == 0) (scene.SetupDraws, scene.SetupOps) = (scene.Draws.Count, scene.Ops.Count);
                scene.RenderLoop = windowCreated;
                inLoop = true;
                RunFrames(statements.GetRange(index + 1, end - index - 1));
                inLoop = false;
                index = end;
                continue;
            }
            switch (st.Kind)
            {
                case "loop-start":
                    // What was drawn into framebuffer objects so far is the program's setup, drawn once.
                    if (!inLoop && scene.SetupDraws == 0) (scene.SetupDraws, scene.SetupOps) = (scene.Draws.Count, scene.Ops.Count);
                    inLoop = true;
                    scene.RenderLoop = windowCreated;
                    continue;
                case "loop-end":
                    inLoop = false;
                    continue;
            }
            Statement(st);
            // Once the render loop is reached, the frame is what the loop does.
        }
        Finish();
        return scene;
    }

    private int inlineDepth;
    /// <summary>How deep the program's own drawing functions are followed: a recursive one (drawSelfAndChild over a scene
    /// graph) as deep as its data goes, up to this.</summary>
    private const int MaxInlineDepth = 32;
    private string?[]? inlineReturn;

    /// <summary>Runs a function of the program with its arguments; returns the name of the variable it returns.</summary>
    private string? Inline(string fn, IReadOnlyList<string> args)
    {
        // An overloaded function: the definition these arguments call.
        if (src.Functions.ContainsKey(fn + "#2"))
            fn = src.ChooseOverload(fn, args.Select(a => (ShaderAst.Expr)new ShaderAst.Name(a.Trim(), 0)).ToList(), e => Eval(((ShaderAst.Name)e).Id));
        var declared = src.ParametersOf(fn) ?? [];
        var parameters = declared.Select(p => p.Name).ToList();
        var values = args.Select(a => Eval(a)).ToList();
        // The parameters are globals while the function runs: what they named before comes back afterwards (a recursive
        // drawSelfAndChild(child, shader) leaves its caller's entity as it was).
        var outer = parameters.Where(p => p != "").Distinct().ToDictionary(p => p, p => env.Runner.Globals.GetValueOrDefault(p), StringComparer.Ordinal);
        for (int i = 0; i < parameters.Count; i++)
        {
            // A parameter not given takes its default value (DrawSprite(…, float rotate = 0.0f, glm::vec3 color = …)).
            var v = i < values.Count ? values[i] : declared[i].Default is { } fallback ? Eval(fallback) : null;
            // By value: a copy (a struct changed in the function stays as it was for the caller).
            if (v is not null) env.Runner.Globals[parameters[i]] = declared[i].Ref ? v : v.Clone();
        }
        // A parameter that receives a Shader or Model (renderScene(simpleDepthShader) with `const Shader& shader`)
        // names the caller's object while the function runs.
        var aliases = new Dictionary<string, string>(StringComparer.Ordinal);
        for (int i = 0; i < parameters.Count && i < args.Count; i++)
        {
            var target = ResolveAlias(Obj(args[i]));
            if (parameters[i] != "" && parameters[i] != target && (gl.Programs.ContainsKey(target) || models.ContainsKey(target))) aliases[parameters[i]] = target;
        }
        aliasStack.Add(aliases);
        var saved = inlineReturn;
        inlineReturn = new string?[1];
        inlineDepth++;
        try
        {
            foreach (var st in CppStatements.Walk(src, fn))
                if (st.Kind is "stmt" or "for" or "if" or "while") Statement(st);
            return inlineReturn[0];
        }
        finally
        {
            inlineDepth--;
            inlineReturn = saved;
            aliasStack.RemoveAt(aliasStack.Count - 1);
            foreach (var (p, v) in outer)
                if (v is null) env.Runner.Globals.Remove(p);
                else env.Runner.Globals[p] = v;
        }
    }

    /// <summary>
    /// After a followed function returned an expression: when the statement assigns or declares with that call as its
    /// value, the target gets the expression's value now (a struct returned by value is copied).
    /// </summary>
    private void PassReturnValue(string statement, string fn, string returned)
    {
        List<ShaderAst.Stmt> parsed;
        try
        {
            parsed = ShaderParser.ParseStatementsLenient(CppSource.Prepare(statement + ";"));
        }
        catch (ShaderSyntaxException)
        {
            return;
        }
        ShaderAst.Expr? target = parsed.FirstOrDefault() switch
        {
            ShaderAst.Assign { Op: "=", Value: ShaderAst.Call c } a when c.Function == fn => a.Target,
            ShaderAst.Declare { Value: ShaderAst.Call c } d when c.Function == fn => new ShaderAst.Name(d.Id, 0),
            _ => null,
        };
        if (target is null || env.Eval(returned) is not { } value) return;
        try
        {
            env.Runner.Assign(target, value.Clone());
        }
        catch (ShaderRuntimeException)
        {
        }
    }

    /// <summary>Images loaded while the program ran, by the name their variable now holds ("stbi#2").</summary>
    private readonly Dictionary<string, StbImage> loadedImages = new(StringComparer.Ordinal);

    /// <summary>
    /// stbi_load(…) has just run: the image it loaded (its path worked out now, when it is a helper's parameter) is
    /// remembered under a name of its own, which its variable holds – so glTexImage2D finds it in any function it is
    /// passed to (Generate(texture, width, height, data)).
    /// </summary>
    private void RememberImage(CppStatement st)
    {
        var load = images.FirstOrDefault(i => i.Offset >= st.Offset && i.Offset < st.Offset + st.Text.Length + 1 && i.Variable is not null);
        if (load is null) return;
        if (load.Image is null && load.File == "" && Eval(load.Arg)?.Text is { } path)
        {
            load = load with { File = path, Image = StbImage.Load(project, path, load.Flip, load.Wanted) };
            if (load.Image is null) scene.Notes.Add(SimNote.Error("textureFileMissing", ("file", path)));
        }
        var own = $"stbi#{loadedImages.Count + 1}";
        loadedImages[own] = load;
        try
        {
            env.Runner.Assign(new ShaderAst.Name(load.Variable!, 0), ShaderValue.Str(own));
            // The size stb_image reports through its out-parameters (&width, &height, &nrChannels).
            if (load.Image is { } img && Regex.Match(st.Text, @"stbi_loadf?\s*\(([^;]*)\)") is { Success: true } call && CppSource.SplitArgs(call.Groups[1].Value) is { Count: >= 4 } a)
            {
                foreach (var (arg, value) in new[] { (a[1], img.Width), (a[2], img.Height), (a[3], img.Channels) })
                    if (Regex.IsMatch(arg.Trim(), @"^&\s*[A-Za-z_][\w.]*$")) env.Runner.Assign(ShaderParser.ParseExpression(arg.Trim()[1..].Trim()), ShaderValue.Integer(value));
            }
        }
        catch (ShaderRuntimeException)
        {
        }
        catch (ShaderSyntaxException)
        {
        }
    }

    /// <summary>The helpers' parameters that stand for the caller's objects, innermost call last.</summary>
    private readonly List<Dictionary<string, string>> aliasStack = new();

    /// <summary>The object a name means here: a helper's parameter is the argument it was called with.</summary>
    private string ResolveAlias(string name)
    {
        for (int i = aliasStack.Count - 1; i >= 0; i--)
            if (aliasStack[i].TryGetValue(name, out var target)) name = target;
        return name;
    }

    /// <summary>A variable that now names the same OpenGL object as another (unsigned int diffuseMap = loadTexture(…)).</summary>
    private void Alias(string name, string existing)
    {
        if (gl.TextureObjects.TryGetValue(existing, out var t)) gl.TextureObjects[name] = t;
        if (gl.VertexArrays.TryGetValue(existing, out var v)) gl.VertexArrays[name] = v;
        if (gl.Buffers.TryGetValue(existing, out var b)) gl.Buffers[name] = b;
        if (gl.Programs.TryGetValue(existing, out var p)) gl.Programs[name] = p;
    }

    /// <summary>for (init; condition; step) { … }: runs the body while the condition holds (at most 1000 times).</summary>
    private void For(CppStatement loop)
    {
        var parts = CppSource.SplitArgs(loop.Text.Replace(";", ","));
        var header = loop.Text.Split(';');
        var each = Regex.Match(loop.Text, @"^\s*(?:const\s+)?[\w:<>,\s]*?[\s&*]+(\w+)\s*:\s*(.+)$");
        if (header.Length == 1 && each.Success)
        {
            // for (GameObject& tile : level.Bricks): the body for each element (the element itself: a change to a
            // member stays in the container, as with a reference).
            var container = env.Eval(each.Groups[2].Value.Trim());
            var items = container?.Items ?? container?.Map?.Values.ToArray() ?? container?.Text?.Select(ch => ShaderValue.Integer(ch)).ToArray() ?? [];
            foreach (var item in items.Take(4096))
            {
                env.Runner.Globals[each.Groups[1].Value] = item;
                foreach (var st in loop.Body ?? []) Statement(st);
            }
            return;
        }
        if (header.Length != 3) return;
        env.Run(header[0] + ";");
        for (int n = 0; n < 1000; n++)
        {
            if (header[1].Trim() != "" && (env.Eval(header[1]) is not { } c || c.X == 0)) return;
            foreach (var st in loop.Body ?? []) Statement(st);
            env.Run(header[2] + ";");
        }
        _ = parts;
    }

    /// <summary>
    /// Whether a condition on one variable holds, when the reader knows: an OpenGL object's name is not 0 once the
    /// object exists (if (cubeVAO == 0) builds learnopengl's cube once), a bool variable has its value (if (!oddRow)).
    /// Null: not known (a pointer from stb_image, a status code …).
    /// </summary>
    private bool? Decide(string condition)
    {
        var m = Regex.Match(condition, @"^\s*(!?)\s*([A-Za-z_]\w*)\s*(?:([!=]=)\s*(0|true|false|NULL|nullptr)\s*)?$");
        // Any other condition: its value when the program's own variables give one (if (!tile.Destroyed),
        // if (nrComponents == 1)); a pointer, a handle or an API result is not known.
        if (!m.Success) return env.Eval(condition) is { V: { Length: 1 } decided, Iterator: null } ? decided[0] != 0 : null;
        var name = m.Groups[2].Value;
        bool? value = gl.VertexArrays.ContainsKey(name) || gl.Buffers.ContainsKey(name) || gl.TextureObjects.ContainsKey(name) || gl.Framebuffers.ContainsKey(name)
            || gl.Renderbuffers.ContainsKey(name) || gl.Programs.ContainsKey(name) ? true
            : src.DeclaredType(name) is { } type && (type == "bool" || ShaderValue.IsIntType(type) || type is "float" or "double" or "GLboolean")
                && env.Eval(name) is { V: { Length: 1 } v } ? v[0] != 0 : null;
        if (value is not { } truth) return null;
        if (m.Groups[3].Success)
        {
            bool compared = m.Groups[4].Value == "true";
            truth = (truth == compared) == (m.Groups[3].Value == "==");
        }
        return m.Groups[1].Value == "!" ? !truth : truth;
    }

    /// <summary>The API calls (gl*, glfw*, Shader methods) in a piece of code, without running its C++ again.</summary>
    private void ApiCalls(string text, int offset)
    {
        statementOffset = offset;
        foreach (Match m in CallStart.Matches(text))
        {
            int open = m.Index + m.Length - 1;
            int close = CppSource.MatchBracket(text, open);
            if (close < 0) continue;
            var args = CppSource.SplitArgs(text[(open + 1)..close]);
            int line = src.LineAt(offset + m.Index);
            if (m.Groups["method"].Success) ShaderMethod(m.Groups["obj"].Value, m.Groups["method"].Value, args, line);
            else Call(m.Groups["name"].Value, args, null, line);
        }
    }

    private void Statement(CppStatement st)
    {
        if (st.Kind == "for")
        {
            For(st);
            return;
        }
        if (st.Kind == "if")
        {
            // The condition's API calls first (if (glCheckFramebufferStatus(…) != …)), then the branch it picks:
            // decided, that branch; not decided, the body, as for any other if.
            ApiCalls(st.Text, st.Offset);
            foreach (var inner in (Decide(st.Text) == false ? st.Else : st.Body) ?? []) Statement(inner);
            return;
        }
        if (st.Kind == "while")
        {
            for (int n = 0; n < 10000; n++)
            {
                ApiCalls(st.Text, st.Offset);
                if (Decide(st.Text) != true) break;
                foreach (var inner in st.Body ?? []) Statement(inner);
            }
            return;
        }
        var text = ExpandMacros(st.Text, src.LineAt(st.Offset));
        statementOffset = st.Offset;
        // The program's own variables (GL calls do nothing here; they are followed below).
        env.Run(text + ";");
        if (text.Contains("stbi_load", StringComparison.Ordinal)) RememberImage(st);
        if (inlineReturn is not null && Regex.Match(text, @"^return\s+([\s\S]+)$") is { Success: true } ret) inlineReturn[0] = ret.Groups[1].Value.Trim();
        // The program's own functions that make GL calls (learnopengl's loadTexture): followed as if written here.
        foreach (Match call in Regex.Matches(text, @"(?<![\w.>])(\w+)\s*\("))
        {
            var fn = call.Groups[1].Value;
            if (fn == "main" || inlineDepth > MaxInlineDepth || !src.Functions.ContainsKey(fn) || !src.CallsApi(fn)) continue;
            int open = call.Index + call.Length - 1;
            int close = CppSource.MatchBracket(text, open);
            if (close < 0) continue;
            var returned = Inline(fn, CppSource.SplitArgs(text[(open + 1)..close]));
            var lhsMatch = AssignRe.Match(text);
            if (returned is not null && lhsMatch.Success && Regex.IsMatch(returned, @"^\w+$")) Alias(lhsMatch.Groups["lhs"].Value, returned);
            // The value it returns reaches the caller (Shaders[name] = loadShaderFromFile(…); Shader s = Compile(…)):
            // the C++ above ran before the function was followed.
            if (returned is not null) PassReturnValue(text, fn, returned);
        }
        statementOffset = st.Offset;
        var shaderClass = ShaderClassRe.Match(text);
        if (shaderClass.Success)
        {
            ShaderClass(shaderClass.Groups["name"].Value, shaderClass.Groups["vs"].Value, shaderClass.Groups["fs"].Value,
                shaderClass.Groups["gs"].Success ? shaderClass.Groups["gs"].Value : null, src.LineAt(st.Offset));
            return;
        }
        var modelDecl = ModelRe.Match(text);
        if (modelDecl.Success)
        {
            // learnopengl.com's Model class: Model ourModel("planet.obj"); loads the file with Assimp.
            var path = modelDecl.Groups["path"].Value;
            if (Models.ObjModel.Load(project, path) is { } model)
            {
                models[modelDecl.Groups["name"].Value] = (model, path);
                ModelObjects(modelDecl.Groups["name"].Value, model, path);
            }
            else scene.Notes.Add(SimNote.Error("modelFileMissing", ("file", path)));
            return;
        }
        string? lhs = null;
        var assign = AssignRe.Match(text);
        if (assign.Success && !text.StartsWith("return", StringComparison.Ordinal)) lhs = assign.Groups["lhs"].Value;
        foreach (Match m in CallStart.Matches(text))
        {
            int open = m.Index + m.Length - 1;
            int close = CppSource.MatchBracket(text, open);
            if (close < 0) continue;
            var args = CppSource.SplitArgs(text[(open + 1)..close]);
            int line = src.LineAt(st.Offset + m.Index);
            if (m.Groups["method"].Success) ShaderMethod(m.Groups["obj"].Value, m.Groups["method"].Value, args, line);
            else Call(m.Groups["name"].Value, args, lhs, line);
        }
    }

    /// <summary>
    /// The OpenGL object an argument names: "colorBuffers[1]" also for colorBuffers[i] in a loop or pingpongFBO[!horizontal]
    /// (an index worked out now).
    /// </summary>
    private string Obj(string arg)
    {
        var name = Regex.Replace(arg.Trim().TrimStart('&'), @"\s+", "");
        var r = Regex.Replace(name, @"\[([^\[\]]*[^\d\[\]][^\[\]]*)\]", m => Eval(m.Groups[1].Value) is { V: { Length: > 0 } v } ? $"[{(int)Math.Round(v[0])}]" : m.Value);
        return r;
    }

    /// <summary>The array or vector behind a data argument: vertices, &amp;vertices[0], vertices.data().</summary>
    private string DataName(string arg)
    {
        var a = Obj(arg);
        a = Regex.Replace(a, @"\.data\(\)$|\[0\]$", "");
        return a;
    }

    private void Finish()
    {
        scene.WindowCreated = windowCreated;
        // Uniforms that read the clock make the frame change over time.
        if (env.Runner.UsedTime || src.UsedTime) scene.Animated = scene.Draws.Count > 0;
        if (!glfwInit && src.HasCall("glfwCreateWindow")) scene.Notes.Add(SimNote.Error("glfwInitMissing"));
        if (!windowCreated)
        {
            scene.Notes.Add(SimNote.Info("noWindow"));
            return;
        }
        if (!scene.RenderLoop)
        {
            scene.Notes.Add(SimNote.Warning("noLoop"));
            return;
        }
        if (!scene.Presents) scene.Notes.Add(SimNote.Warning("noPresent", ("call", "glfwSwapBuffers(window)")));
        if (!src.HasCall("glfwPollEvents")) scene.Notes.Add(SimNote.Warning("noPollEvents"));
        if (setupDraws.Count > 0 && scene.Draws.Count == 0) scene.Notes.Add(SimNote.Warning("drawOutsideLoop", ("call", "glDrawArrays")));
        if (scene.ClearColor is null && !scene.Ops.Any(o => o is ClearOp { Target: null, Color: not null } or CopyOp { To: null }) && (gl.ClearColorSet || scene.Draws.Count > 0)) scene.Notes.Add(SimNote.Warning("noClear", ("call", "glClear(GL_COLOR_BUFFER_BIT)")));
    }
}
