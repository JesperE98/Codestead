namespace Codestead.GP.Gpu.Scene;

/// <summary>
/// Something the simulated run wants to tell the learner ("the window closed right away: there is no render loop").
/// <see cref="Key"/> is a text in the tool's language files ("sim.&lt;key&gt;") with {placeholders} from <see cref="Args"/>.
/// </summary>
public sealed record SimNote(string Key, NoteLevel Level, IReadOnlyDictionary<string, string> Args)
{
    public static SimNote Info(string key, params (string, string)[] args) => new(key, NoteLevel.Info, args.ToDictionary(a => a.Item1, a => a.Item2));

    public static SimNote Warning(string key, params (string, string)[] args) => new(key, NoteLevel.Warning, args.ToDictionary(a => a.Item1, a => a.Item2));

    public static SimNote Error(string key, params (string, string)[] args) => new(key, NoteLevel.Error, args.ToDictionary(a => a.Item1, a => a.Item2));
}
