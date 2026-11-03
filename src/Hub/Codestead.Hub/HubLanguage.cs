namespace Codestead.Hub;

/// <summary>A language of the user interface (the same as Codestead Linux: build/languages.json).</summary>
public sealed record HubLanguage(string Code, string Name, bool RightToLeft = false);
