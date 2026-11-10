namespace Codestead.GP.Gpu.Readers;

/// <summary>A simple statement of a function body (without the ';'), where it starts, and whether it runs every frame.</summary>
/// <param name="Kind">"stmt"; "loop-start"/"loop-end" around the render loop's body; "for" with the loop's header in
/// <see cref="Text"/> ("init; condition; step") and its statements in <see cref="Body"/>.</param>
/// <param name="Else">"if" (a condition on one variable, in <see cref="Text"/>): the statements of its else branch, if any.</param>
public sealed record CppStatement(string Text, int Offset, string Kind = "stmt", IReadOnlyList<CppStatement>? Body = null, IReadOnlyList<CppStatement>? Else = null)
{
    public bool IsStatement => Kind == "stmt";
}
