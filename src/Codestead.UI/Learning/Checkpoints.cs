namespace Codestead.UI.Learning;

/// <summary>One answer option in a quiz.</summary>
public sealed record QuizOption(string Text, bool Correct);

/// <summary>
/// An interactive checkpoint inside a lesson text. Written as fenced blocks in the chapter markdown,
/// so translators keep the same structure in every language:
/// <code>
/// ```quiz
/// Which command shows the directory you are in?
/// - [ ] ls
/// - [x] pwd
/// ---
/// `pwd` stands for "print working directory".
/// ```
///
/// ```predict
/// $ echo $((2 + 3))
/// 5
/// ---
/// Optional explanation.
/// ```
///
/// ```try
/// pwd
/// ---
/// Optional text shown when it worked.
/// ```
/// </code>
/// A quiz with several [x] options requires all of them (check boxes); with one it is a single choice.
/// A predict block shows the command(s) after "$ " and expects the remaining lines as the answer.
/// A try block lists accepted commands; it is solved when the student runs one of them (or a command
/// with the same output) in the mini terminal.
/// </summary>
public sealed class Checkpoint
{
    public const string Quiz = "quiz";
    public const string Predict = "predict";
    public const string Try = "try";

    public static readonly string[] Kinds = { Quiz, Predict, Try };

    /// <summary>Position among the checkpoints of the text (0, 1, 2 ...).</summary>
    public int Index { get; init; }
    public string Kind { get; init; } = Quiz;
    /// <summary>The question (markdown, quiz only).</summary>
    public string Prompt { get; init; } = "";
    public List<QuizOption> Options { get; init; } = new();
    /// <summary>Commands shown (predict) or accepted (try).</summary>
    public List<string> Commands { get; init; } = new();
    /// <summary>The expected output (predict).</summary>
    public string Expected { get; init; } = "";
    /// <summary>Shown after the right answer (markdown).</summary>
    public string? Explanation { get; init; }

    public bool MultipleAnswers => Options.Count(o => o.Correct) > 1;

    private static readonly System.Text.RegularExpressions.Regex Block = new(
        @"^```(quiz|predict|try)[ \t]*\r?\n(.*?)\r?\n```[ \t]*$",
        System.Text.RegularExpressions.RegexOptions.Multiline | System.Text.RegularExpressions.RegexOptions.Singleline | System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    private static readonly System.Text.RegularExpressions.Regex OptionLine = new(
        @"^\s*[-*]\s+\[( |x|X)\]\s+(.*)$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    /// <summary>All checkpoints in a markdown text, in order.</summary>
    public static List<Checkpoint> ParseAll(string markdown)
    {
        var list = new List<Checkpoint>();
        foreach (System.Text.RegularExpressions.Match m in Block.Matches(markdown))
            list.Add(Parse(m.Groups[1].Value, m.Groups[2].Value, list.Count));
        return list;
    }

    /// <summary>Parses the body of one fenced block. Throws FormatException if it is malformed.</summary>
    public static Checkpoint Parse(string kind, string body, int index)
    {
        var lines = body.Replace("\r\n", "\n").Split('\n').ToList();
        int sep = lines.FindIndex(l => l.Trim() == "---");
        var main = sep >= 0 ? lines.Take(sep).ToList() : lines;
        var explanation = sep >= 0 ? string.Join("\n", lines.Skip(sep + 1)).Trim() : null;
        if (explanation == "") explanation = null;

        switch (kind)
        {
            case Quiz:
            {
                var prompt = new List<string>();
                var options = new List<QuizOption>();
                foreach (var line in main)
                {
                    var o = OptionLine.Match(line);
                    if (o.Success) options.Add(new QuizOption(o.Groups[2].Value.Trim(), o.Groups[1].Value.ToLowerInvariant() == "x"));
                    else if (options.Count == 0) prompt.Add(line);
                    else if (line.Trim() != "") throw new FormatException($"quiz {index}: text after the options: \"{line}\"");
                }
                if (options.Count < 2) throw new FormatException($"quiz {index}: needs at least two options");
                if (!options.Any(o => o.Correct)) throw new FormatException($"quiz {index}: no option is marked [x]");
                var text = string.Join("\n", prompt).Trim();
                if (text == "") throw new FormatException($"quiz {index}: the question is missing");
                return new Checkpoint { Index = index, Kind = Quiz, Prompt = text, Options = options, Explanation = explanation };
            }
            case Predict:
            {
                var commands = main.TakeWhile(l => l.StartsWith("$ ", StringComparison.Ordinal)).Select(l => l[2..]).ToList();
                if (commands.Count == 0) throw new FormatException($"predict {index}: the first line must start with \"$ \"");
                var expected = string.Join("\n", main.Skip(commands.Count)).TrimEnd();
                return new Checkpoint { Index = index, Kind = Predict, Commands = commands, Expected = expected, Explanation = explanation };
            }
            case Try:
            {
                var commands = main.Select(l => l.Trim()).Where(l => l != "").ToList();
                if (commands.Count == 0) throw new FormatException($"try {index}: no command");
                return new Checkpoint { Index = index, Kind = Try, Commands = commands, Explanation = explanation };
            }
        }
        throw new FormatException($"Unknown checkpoint kind {kind}");
    }

    /// <summary>Normalises an answer or command line for comparison (trims, collapses spaces).</summary>
    public static string Normalize(string s) =>
        System.Text.RegularExpressions.Regex.Replace(s.Replace("\r\n", "\n").Trim(), @"[ \t]+", " ")
            .Replace(" \n", "\n").Replace("\n ", "\n");

    /// <summary>Is the predicted output right?</summary>
    public bool IsCorrectPrediction(string answer) => Normalize(answer) == Normalize(Expected);

    /// <summary>Is this set of chosen options right (exactly the correct ones)?</summary>
    public bool IsCorrectChoice(IReadOnlyCollection<int> chosen) =>
        Options.Select((o, i) => (o, i)).All(x => x.o.Correct == chosen.Contains(x.i));
}
