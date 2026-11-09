namespace Codestead.GP.Gpu.Readers;

/// <summary>A simple statement of a function body (without the ';'), where it starts, and whether it runs every frame.</summary>
/// <param name="Kind">"stmt", or "loop-start"/"loop-end" around the render loop's body.</param>
public sealed record CppStatement(string Text, int Offset, string Kind = "stmt")
{
    public bool IsStatement => Kind == "stmt";
}
