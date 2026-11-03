namespace Codestead.Content;

// Port of src/content/types.ts.

public static partial class TypesLib
{
    public static T Resolve<T>(PerDistro<T> v, Distro d) => v.Resolve(d);

    public static string? Resolve(FamilyText v, Distro d) => v.Get(d.Family);

    /// <summary>A PerDistro text from a FamilyText.</summary>
    public static PerDistro<string> FromFamilyText(FamilyText ft) => new(d => ft.Get(d.Family)!);
}
