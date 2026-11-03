namespace Codestead.UI.Controls;

// The texts of the "What's new" dialog.

/// <summary>Texts of the "What's new" dialog, in the app's language.</summary>
/// <param name="Title">The heading, e.g. "What's new in Codestead Linux".</param>
/// <param name="Version">The heading of each version, with {version} and {date}, e.g. "Version {version} · {date}".</param>
/// <param name="Close">The button that closes the dialog.</param>
public sealed record WhatsNewTexts(string Title, string Version, string Close);
