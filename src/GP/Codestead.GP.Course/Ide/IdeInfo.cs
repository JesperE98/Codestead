namespace Codestead.GP.Course.Ide;

/// <summary>An IDE the course has instructions for: its id (as in ":::ide vs rider"), name and build system.</summary>
public sealed record IdeInfo(string Id, string Name, bool UsesCMake);
