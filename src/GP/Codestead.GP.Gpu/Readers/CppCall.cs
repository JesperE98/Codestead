namespace Codestead.GP.Gpu.Readers;

/// <summary>A call found in C++ source: the function (or method) name, its arguments as written, where it is.</summary>
/// <param name="Target">For a method call (obj->Method(…) or obj.Method(…)): the object expression, else null.</param>
public sealed record CppCall(string Name, IReadOnlyList<string> Args, int Offset, int End, int Line, string? Target)
{
    public string Arg(int i) => i < Args.Count ? Args[i] : "";
}
