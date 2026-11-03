namespace Codestead.Hub.Core;

// Version numbers major.minor.patch.

/// <summary>Versions "major.minor.patch" (as in build/Codestead.props).</summary>
public static class SemVer
{
    public static Version? Parse(string? s) =>
        s is not null && System.Text.RegularExpressions.Regex.IsMatch(s, @"\A\d+\.\d+\.\d+\z") && System.Version.TryParse(s, out var v) ? v : null;

    /// <summary>Is <paramref name="candidate"/> newer than <paramref name="installed"/>?</summary>
    public static bool IsNewer(string candidate, string installed) =>
        Parse(candidate) is { } c && Parse(installed) is { } i && c > i;
}
