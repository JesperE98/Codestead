using Codestead.Shell.Commands;

namespace Codestead.Shell;

// Shell: running a typed line – Execute, the syntax tree walker (Exec/ExecCompound), loops and arithmetic.

public partial class Shell
{
    // ---------- Running ----------

    private static readonly Regex YesRe = new("^(y|yes|j|ja)\\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public ExecResult Execute(string line)
    {
        clearRequested = false;
        steps = 0;
        var output = new StringBuilder();
        var term = new XIO(s => output.Append(s), s => output.Append(s), null, true);
        ExecResult Result(string l, bool incomplete = false) => new()
        {
            Line = l,
            Output = incomplete || PendingQuestion is not null ? output.ToString() : output + JobNotifications(),
            ExitCode = LastExit,
            Clear = clearRequested,
            Pending = PendingQuestion is not null,
            Incomplete = incomplete,
        };

        if (PendingQuestion is not null)
        {
            var p = PendingQuestion;
            PendingQuestion = null;
            var answer = line.Trim();
            bool yes = answer == "" ? p.DefaultYes : YesRe.IsMatch(answer);
            currentLine = p.Line;
            Guard(term, () =>
            {
                LastExit = RunAs(p.User, () => p.OnAnswer(yes, term, line));
                // If the answer asks a new question (e.g. "Retype new password:") the rest of the line runs after it.
                if (p.Resume is not null && PendingQuestion is not null) PendingQuestion.Resume ??= p.Resume;
                else if (p.Resume is not null) LastExit = p.Resume(term);
            });
            return Result(p.Line);
        }

        // Scheduled jobs whose time has come run first (cron), as they would have while you were typing.
        if (partial is null) Commands.CronCmd.Tick(this);
        var text = partial is not null ? $"{partial}\n{line}" : line;
        Node ast;
        try
        {
            ast = ParseCode(text);
        }
        catch (ParseError e)
        {
            if (e.Incomplete && text.Split('\n').Length < 500)
            {
                partial = text;
                return Result(text, true);
            }
            partial = null;
            AddHistory(text);
            term.Err($"{ShellMode}: {e.Message}\n");
            LastExit = 2;
            return Result(ShellLib.FlattenLines(text));
        }
        partial = null;
        var flat = ShellLib.FlattenLines(text);
        AddHistory(flat);
        currentLine = flat;
        Guard(term, () => LastExit = Exec(ast, term));
        return Result(flat);
    }

    private void AddHistory(string text)
    {
        if (text.Trim() == "" || text.StartsWith(' ')) return;
        History.Add(ShellLib.FlattenLines(text));
        if (History.Count > 500) History.RemoveRange(0, History.Count - 500);
    }

    /// <summary>Runs fn and catches signals that must not leak out of a run.</summary>
    private void Guard(Sink io, Action fn)
    {
        try
        {
            fn();
        }
        catch (LimitError e)
        {
            io.Err($"\n{Dim}{e.Message}{Reset}\n");
            LastExit = 130;
        }
        catch (ExitSignal e)
        {
            LastExit = e.Code;
        }
        catch (ReturnSignal e)
        {
            LastExit = e.Code;
        }
        catch (LoopSignal)
        {
            // ignored
        }
        finally
        {
            listDepth = 0;
        }
    }

    private void Tick()
    {
        if (++steps > StepLimit)
        {
            throw new LimitError(Msg("shell.stepLimit", ("steps", FormatNumber(StepLimit))));
        }
    }

    /// <summary>Runs a line (or a whole script) in the current shell.</summary>
    public int RunLine(string line, Sink sink)
    {
        try
        {
            return LastExit = Exec(ParseCode(line), new XIO(sink.OutFn, sink.ErrFn, null, false));
        }
        catch (ParseError e)
        {
            sink.Err($"{ShellMode}: {e.Message}\n");
            return LastExit = 2;
        }
    }

    private int Exec(Node node, XIO io)
    {
        int code;
        switch (node)
        {
            case ListNode list:
            {
                if (list.Items.Count == 0) return LastExit;
                listDepth++;
                code = LastExit;
                try
                {
                    for (int k = 0; k < list.Items.Count; k++)
                    {
                        code = list.Items[k].Background ? StartJob(list.Items[k].Node, io) : Exec(list.Items[k].Node, io);
                        if (PendingQuestion is not null)
                        {
                            // A question (e.g. from read or apt) – run the rest when it has been answered.
                            var rest = list.Items.Skip(k + 1).ToList();
                            if (listDepth == 1 && rest.Count > 0 && PendingQuestion.Resume is null)
                            {
                                PendingQuestion.Resume = io2 => Exec(new ListNode { Items = rest }, io2);
                            }
                            break;
                        }
                    }
                }
                finally
                {
                    listDepth--;
                }
                break;
            }
            case AndOrNode andor:
            {
                code = Exec(andor.First, io);
                foreach (var item in andor.Rest)
                {
                    if (PendingQuestion is not null) break;
                    if ((item.Op == "&&" && code != 0) || (item.Op == "||" && code == 0)) continue;
                    code = Exec(item.Node, io);
                }
                break;
            }
            case PipelineNode pipeline:
            {
                var input = io.Stdin;
                code = 0;
                for (int i = 0; i < pipeline.Commands.Count; i++)
                {
                    bool last = i == pipeline.Commands.Count - 1;
                    var buf = new StringBuilder();
                    var stage = new XIO(last ? io.OutFn : s => buf.Append(s), io.ErrFn, input, last && io.Tty);
                    code = Exec(pipeline.Commands[i], stage);
                    input = new Reader(buf.ToString(), 0);
                }
                if (pipeline.Negate) code = code == 0 ? 1 : 0;
                break;
            }
            case SimpleNode simple:
                code = RunSimple(simple, io);
                break;
            case FuncDefNode funcdef:
                Functions[funcdef.Name] = funcdef.Body;
                code = 0;
                break;
            case CompoundNode compound:
                code = WithRedirects(compound.Redirects, io, rio => ExecCompound(compound, rio));
                break;
            default:
                throw new InvalidOperationException($"Unknown node {node.Type}");
        }
        LastExit = code;
        return code;
    }

    private int ExecCompound(CompoundNode node, XIO io)
    {
        switch (node)
        {
            case IfNode ifNode:
            {
                foreach (var clause in ifNode.Clauses)
                {
                    if (Exec(clause.Cond, io) == 0) return Exec(clause.Body, io);
                    if (PendingQuestion is not null) return 0;
                }
                return ifNode.ElseBody is not null ? Exec(ifNode.ElseBody, io) : 0;
            }
            case ForNode forNode:
            {
                var values = forNode.Words is not null
                    ? forNode.Words.SelectMany(w => ExpandWord(w, io)).ToList()
                    : (positional.Count > 0 ? positional[^1] : new List<string> { "bash" }).Skip(1).ToList();
                int code = 0;
                RunLoop(
                    () => values.Count > 0,
                    () =>
                    {
                        var v = values[0];
                        values.RemoveAt(0);
                        SetVar(forNode.Name, v);
                        code = Exec(forNode.Body, io);
                    });
                return code;
            }
            case CForNode cfor:
            {
                int code = 0;
                if (!Arith(cfor.Init, io).Ok) return 1;
                RunLoop(
                    () =>
                    {
                        var r = cfor.Cond.Trim() != "" ? Arith(cfor.Cond, io) : (Ok: true, Value: 1L);
                        return r.Ok && r.Value != 0;
                    },
                    () => code = Exec(cfor.Body, io),
                    () => Arith(cfor.Step, io));
                return code;
            }
            case WhileNode whileNode:
            {
                int code = 0;
                RunLoop(
                    () =>
                    {
                        var c = Exec(whileNode.Cond, io);
                        return whileNode.Until ? c != 0 : c == 0;
                    },
                    () => code = Exec(whileNode.Body, io));
                return code;
            }
            case CaseNode caseNode:
            {
                var value = string.Join(" ", ExpandWord(caseNode.Word, io, split: false, glob: false));
                foreach (var item in caseNode.Items)
                {
                    if (item.Patterns.Any(p => ParserLib.GlobToRegex(ExpandPattern(p, io), true).IsMatch(value)))
                    {
                        return item.Body is not null ? Exec(item.Body, io) : 0;
                    }
                }
                return 0;
            }
            case GroupNode group:
            {
                if (!group.Subshell) return Exec(group.Body, io);
                var saved = (Cwd, Env: Js.Copy(Env), Functions: Js.Copy(Functions));
                try
                {
                    return Exec(group.Body, io);
                }
                catch (ExitSignal e)
                {
                    return e.Code;
                }
                finally
                {
                    Cwd = saved.Cwd;
                    Env = saved.Env;
                    Functions = saved.Functions;
                }
            }
            case ArithNode arith:
            {
                var r = Arith(arith.Expr, io);
                return r.Ok && r.Value != 0 ? 0 : 1;
            }
        }
        throw new InvalidOperationException($"Unknown node {node.Type}");
    }

    /// <summary>Shared loop logic with break/continue and protection against infinite loops.</summary>
    private void RunLoop(Func<bool> cond, Action body, Action? step = null)
    {
        LoopDepth++;
        try
        {
            for (; ; )
            {
                Tick();
                if (!cond() || PendingQuestion is not null) break;
                try
                {
                    body();
                }
                catch (LoopSignal e)
                {
                    if (e.Levels > 1)
                    {
                        e.Levels--;
                        throw;
                    }
                    if (e.Kind == "break") break;
                }
                if (PendingQuestion is not null) break;
                step?.Invoke();
            }
        }
        finally
        {
            LoopDepth--;
        }
    }

    private (bool Ok, long Value) Arith(string expr, Sink io)
    {
        try
        {
            var value = ArithLib.EvalArith(ExpandString(expr, io), new ArithVars
            {
                Get = GetVar,
                Set = SetVar,
            });
            return (true, value);
        }
        catch (ArithError e)
        {
            io.Err($"bash: {expr.Trim()}: {e.Message}\n");
            return (false, 0);
        }
    }
}
