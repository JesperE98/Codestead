using System.Text.RegularExpressions;

namespace Codestead.GP.Gpu.Readers;

// A game (learnopengl's 2D game): its state moves on from frame to frame by deltaTime, so the picture at time t is
// what frame t × 60 draws after the frames before it ran. Time and input are deterministic, as verify.sh's
// fixedtime.c makes them on a real driver: frame n reads glfwGetTime() = n / 60, and the space bar is pressed in frame
// 30's glfwPollEvents() and released in frame 33's (through the program's key callback).
public sealed partial class GlReader
{
    /// <summary>The frames in which the space bar is pressed and released (0.5 s and 0.55 s).</summary>
    public const int SpacePressFrame = 30, SpaceReleaseFrame = 33;

    /// <summary>The render loop runs frame by frame: the program has a key callback (a game).</summary>
    private bool Stepped => src.HasCall("glfwSetKeyCallback");

    /// <summary>The frame being run is not the one shown: its draws are skipped.</summary>
    private bool discardDraws;

    private readonly Dictionary<string, bool> drawOnly = new(StringComparer.Ordinal);

    /// <summary>A statement that only calls a function of the program that draws (Render(Hedgerow)).</summary>
    private bool DrawsOnly(CppStatement st)
    {
        if (st.Kind != "stmt") return false;
        var call = Regex.Match(st.Text.Trim(), @"^(\w+)\s*\((.*)\)$", RegexOptions.Singleline);
        return call.Success && src.Functions.ContainsKey(call.Groups[1].Value) && src.CallsApi(call.Groups[1].Value) && DrawOnly(call.Groups[1].Value, 0);
    }

    private static readonly Regex AssignmentRe = new(@"(?<![\w.>=!<+\-*/%&|^])([A-Za-z_]\w*)\s*(?:(?:\.|->)\s*\w+\s*|\[[^\]]*\]\s*)*(?:[+\-*/%&|^]|<<|>>)?=(?!=)|(?:\+\+|--)\s*([A-Za-z_]\w*)|([A-Za-z_]\w*)\s*(?:(?:\.|->)\s*\w+\s*|\[[^\]]*\]\s*)*(?:\+\+|--)", RegexOptions.CultureInvariant);
    private static readonly Regex DeclarationRe = new(@"(?:^|[;{(,])\s*(?:const\s+|static\s+)*(?:unsigned\s+)?[A-Za-z_][\w:]*(?:\s*<[^;{}()]*>)?(?:\s*[*&]+\s*|\s+)([A-Za-z_]\w*)\s*(?=[=;:\[({,)])", RegexOptions.CultureInvariant);
    private static readonly Regex MutatingMethodRe = new(@"\.\s*(?:push_back|emplace_back|insert|emplace|erase|clear|resize|pop_back|reserve|swap|assign)\s*\(", RegexOptions.CultureInvariant);

    /// <summary>
    /// A function of the program that only draws: it writes nothing but its own local variables (and parameters it got
    /// by value), and the functions it calls are such functions too – so a frame that is not shown can skip it.
    /// </summary>
    private bool DrawOnly(string fn, int depth)
    {
        if (drawOnly.TryGetValue(fn, out var known)) return known;
        if (depth > 12 || src.FunctionBody(fn) is not { } body) return false;
        drawOnly[fn] = false;   // recursion: not known yet, so not skipped
        var parameters = src.ParametersOf(fn) ?? [];
        var locals = new HashSet<string>(parameters.Where(p => !p.Ref).Select(p => p.Name), StringComparer.Ordinal);
        foreach (Match d in DeclarationRe.Matches(body)) locals.Add(d.Groups[1].Value);
        bool result = !MutatingMethodRe.IsMatch(body) && !body.Contains("static ", StringComparison.Ordinal);
        if (result)
            foreach (Match a in AssignmentRe.Matches(body))
            {
                var root = a.Groups[1].Success ? a.Groups[1].Value : a.Groups[2].Success ? a.Groups[2].Value : a.Groups[3].Value;
                if (!locals.Contains(root)) { result = false; break; }
            }
        if (result)
            foreach (Match c in Regex.Matches(body, @"(?<![\w.>])(\w+)\s*\("))
            {
                var callee = c.Groups[1].Value;
                if (callee != fn && src.Functions.ContainsKey(callee) && !DrawOnly(callee, depth + 1)) { result = false; break; }
            }
        return drawOnly[fn] = result;
    }

    private static int? LoopEnd(List<CppStatement> statements, int start)
    {
        for (int i = start + 1; i < statements.Count; i++)
            if (statements[i].Kind == "loop-end") return i;
        return null;
    }

    /// <summary>The key callback the program set (glfwSetKeyCallback(window, key_callback)), if it is its own function.</summary>
    private string? KeyCallback()
    {
        var m = Regex.Match(src.Code, @"glfwSetKeyCallback\s*\(\s*\w+\s*,\s*&?\s*(\w+)\s*\)");
        return m.Success && src.Functions.ContainsKey(m.Groups[1].Value) ? m.Groups[1].Value : null;
    }

    /// <summary>Frames 0 … t × 60 of the render loop; the scene keeps what the last one draws.</summary>
    private void RunFrames(List<CppStatement> body)
    {
        int last = (int)Math.Round(env.Runner.Time * 60.0);
        var callback = KeyCallback();
        int draws = scene.Draws.Count, ops = scene.Ops.Count, notes = scene.Notes.Count;
        for (int frame = 0; frame <= last; frame++)
        {
            env.Runner.Time = frame / 60.0;
            discardDraws = frame < last;
            // What the frame before drew is gone when this one clears; its state stays.
            scene.Draws.RemoveRange(draws, scene.Draws.Count - draws);
            scene.Ops.RemoveRange(ops, scene.Ops.Count - ops);
            scene.Notes.RemoveRange(notes, scene.Notes.Count - notes);
            foreach (var st in body)
            {
                // A frame that is not shown needs no drawing: only what changes the program's state runs.
                if (frame < last && DrawsOnly(st)) continue;
                Statement(st);
                if (callback is null || !st.Text.Contains("glfwPollEvents", StringComparison.Ordinal)) continue;
                // The events of this poll: the space bar.
                if (frame == SpacePressFrame) Statement(new CppStatement($"{callback}(window, GLFW_KEY_SPACE, 0, GLFW_PRESS, 0)", st.Offset));
                else if (frame == SpaceReleaseFrame) Statement(new CppStatement($"{callback}(window, GLFW_KEY_SPACE, 0, GLFW_RELEASE, 0)", st.Offset));
            }
        }
        discardDraws = false;
    }
}
