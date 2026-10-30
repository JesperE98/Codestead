namespace Codestead.Content;

// Port of the text preprocessing in src/content/render.ts. The HTML rendering (marked) is not ported:
// the UI renders the preprocessed markdown itself.

public static partial class RenderLib
{
    public static OrderedDictionary<string, string> Placeholders(Distro d, Lang lang = "sv")
    {
        var values = Js.Obj<string>();
        values["distro"] = d.Name;
        values["hostname"] = d.Hostname;
        values["family"] = UiStrings.Translate(lang, $"family.{d.Family}");
        values["pm"] = d.PackageManager;
        values["adminGroup"] = d.AdminGroup;
        return values;
    }

    private static readonly Regex NewlineRe = new(@"\r\n?", RegexOptions.CultureInvariant);
    private static readonly Regex FamilyBlockRe = new(
        @"^:::(debian|arch|redhat)[ \t]*\n([\s\S]*?)\n:::[ \t]*$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex PlaceholderRe = new(@"\{\{([A-Za-z0-9_]+)\}\}", RegexOptions.CultureInvariant);

    /// <summary>
    /// Keeps only the :::family blocks for the chosen family and fills in {{placeholders}}.
    /// A kept block is wrapped in <c>&lt;div class="distro-block" data-family=".." data-label=".."&gt;</c> exactly like the TypeScript.
    /// </summary>
    public static string Preprocess(string md, Distro d, Lang lang = "sv")
    {
        var values = Placeholders(d, lang);
        // Windows line endings (\r\n) would otherwise stop the :::family blocks from being found.
        var text = NewlineRe.Replace(md, "\n");
        text = FamilyBlockRe.Replace(text, m =>
        {
            var family = m.Groups[1].Value;
            var body = m.Groups[2].Value;
            return family == d.Family
                ? $"<div class=\"distro-block\" data-family=\"{family}\" data-label=\"{values["family"]}\">\n\n{body}\n\n</div>"
                : "";
        });
        return PlaceholderRe.Replace(text, m => values.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value);
    }
}
