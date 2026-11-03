namespace Codestead.Learning.UI;

/// <summary>A reset in the settings' danger zone (e.g. "Reset the terminal"); <see cref="Run"/> asks first.</summary>
public sealed record ResetAction(string Title, string Description, string Button, Action Run);
