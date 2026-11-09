namespace Codestead.Content;

// The chapter definitions from src/content/chapters.ts (CHAPTERS), in the same order as the TypeScript.
// Texts, hints and solutions are kept byte for byte.
// Each chapter is defined in Chapters/<part>/<id>.cs; this list sets the course order.

public static partial class ChaptersLib
{
    private static List<Chapter> DefineChapters() => new()
    {
        Valkommen(),
        Navigera(),
        Filer(),
        LasaText(),
        Pipes(),
        Miljo(),
        Rattigheter(),
        Lankar(),
        Processer(),
        Arkiv(),
        Systemd(),
        Natverk(),
        Filoverforing(),
        Diskar(),
        Distributioner(),
        FamiljDebian(),
        FamiljArch(),
        FamiljRedhat(),
        UniversellaPaket(),
        Textbearbetning(),
        Skript(),
        Schemalaggning(),
        Git(),
        Skal(),
        Anvandare(),
    };
}
