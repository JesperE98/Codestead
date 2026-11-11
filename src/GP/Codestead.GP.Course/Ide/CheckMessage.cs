namespace Codestead.GP.Course.Ide;

/// <summary>A message about a check, as a user-interface text key ("ide.buildFailed", "sim.noLoop") and its arguments.</summary>
public sealed record CheckMessage(string Key, IReadOnlyDictionary<string, string> Args, bool IsError);
