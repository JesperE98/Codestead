namespace Codestead.Shell.Commands;

// Port of src/shell/commands/extras.ts – programs that are not preinstalled but installed with the package
// manager: tree, htop, fastfetch, cowsay, python3, vim, nano.
// (curl, wget and ssh live in NetCmd.cs and SshCmd.cs.)

public static partial class ExtrasCmd
{
    private static void Note(CmdCtx ctx, string text) => ctx.Out($"{UtilCmd.Color.Dim}{text}{UtilCmd.Color.Reset}\n");

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new()
    {
        Tree,
        Htop,
        Fastfetch,
        Cowsay,
        Python3,
        Editor("vim", "Kraftfull texteditor", """
NAMN
       vim - Vi IMproved, en kraftfull texteditor

BESKRIVNING
       vim har lägen: tryck i för att skriva, Esc för att gå tillbaka,
       :w för att spara och :q för att avsluta (:q! utan att spara).
"""),
        Editor("vi", "Texteditor (oftast vim i ett enklare läge)", """
NAMN
       vi - den klassiska texteditorn i Unix

BESKRIVNING
       I de flesta distributioner startar vi en enkel variant av vim. Samma
       knappar gäller: i för att skriva, Esc, :w för att spara och :q för att
       avsluta (:wq sparar och avslutar).
"""),
        Editor("nano", "Enkel texteditor", """
NAMN
       nano - en enkel texteditor

BESKRIVNING
       Kommandona visas längst ner: ^O betyder Ctrl+O (spara) och ^X
       betyder Ctrl+X (avsluta).
"""),
    };
}
