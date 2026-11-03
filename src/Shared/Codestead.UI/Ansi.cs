using Avalonia.Controls.Documents;
using Avalonia.Media;

namespace Codestead.UI;

/// <summary>Splits text with ANSI colour codes (\x1b[...m) into segments and turns them into Avalonia runs.</summary>
public static class Ansi
{
    private static readonly System.Text.RegularExpressions.Regex Sgr = new("\x1b\\[([0-9;]*)m", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    public static List<AnsiSegment> Parse(string text)
    {
        var result = new List<AnsiSegment>();
        int fg = 0, bg = 0;
        bool bold = false, dim = false;
        int last = 0;
        foreach (System.Text.RegularExpressions.Match m in Sgr.Matches(text))
        {
            if (m.Index > last) result.Add(new AnsiSegment(text[last..m.Index], fg, bg, bold, dim));
            last = m.Index + m.Length;
            var codes = m.Groups[1].Value == "" ? "0" : m.Groups[1].Value;
            foreach (var part in codes.Split(';'))
            {
                if (!int.TryParse(part, out var code)) code = 0;
                if (code == 0) (fg, bg, bold, dim) = (0, 0, false, false);
                else if (code == 1) bold = true;
                else if (code == 2) dim = true;
                else if (code == 22) (bold, dim) = (false, false);
                else if (code is >= 30 and <= 37 or >= 90 and <= 97) fg = code;
                else if (code == 39) fg = 0;
                else if (code is >= 40 and <= 47) bg = code;
                else if (code == 49) bg = 0;
            }
        }
        if (last < text.Length) result.Add(new AnsiSegment(text[last..], fg, bg, bold, dim));
        return result;
    }

    // The same palette as the web version (GitHub dark).
    private static readonly Dictionary<int, Color> Fg = new()
    {
        [30] = Color.Parse("#6e7681"), [31] = Color.Parse("#ff7b72"), [32] = Color.Parse("#7ee787"), [33] = Color.Parse("#e3b341"),
        [34] = Color.Parse("#79c0ff"), [35] = Color.Parse("#d2a8ff"), [36] = Color.Parse("#76e3ea"), [37] = Color.Parse("#e6edf3"),
    };

    private static readonly Dictionary<int, Color> Bg = new()
    {
        [41] = Color.Parse("#b62324"), [42] = Color.Parse("#2ea043"), [44] = Color.Parse("#1f6feb"),
    };

    /// <summary>Creates runs for the text. <paramref name="defaultForeground"/> is used when no colour is set.</summary>
    public static IEnumerable<Inline> ToInlines(string text, IBrush defaultForeground)
    {
        foreach (var s in Parse(text))
        {
            var run = new Run(s.Text);
            if (s.Fg != 0)
            {
                var color = Fg[s.Fg >= 90 ? s.Fg - 60 : s.Fg];
                // Black text on a green background (sticky + world-writable dirs in ls).
                if (s.Bg == 42 && s.Fg == 30) color = Color.Parse("#0f1318");
                run.Foreground = new SolidColorBrush(color);
            }
            else
            {
                run.Foreground = defaultForeground;
            }
            if (s.Bg != 0 && Bg.TryGetValue(s.Bg, out var bg)) run.Background = new SolidColorBrush(bg);
            if (s.Bold) run.FontWeight = FontWeight.Bold;
            if (s.Dim && run.Foreground is SolidColorBrush b) run.Foreground = new SolidColorBrush(b.Color, 0.62);
            yield return run;
        }
    }
}
