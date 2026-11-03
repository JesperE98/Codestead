namespace Codestead.Shell.Commands;

// The zsh command: the Z shell, started on top of bash.

public static partial class ShellsCmd
{
    private static readonly CommandDef Zsh = ShellCommand(
        "zsh",
        "Z-skalet – ett bash-kompatibelt skal med många extra finesser",
        "The Z shell – a bash-compatible shell with many extras",
        """
        NAMN
               zsh - Z-skalet

        SYNOPSIS
               zsh
               zsh SKRIPT [ARGUMENT]...
               zsh -c 'KOMMANDO'

        BESKRIVNING
               zsh är ett skal som i stort sett är kompatibelt med bash, men med
               fler finesser: bättre tab-komplettering, ** för att leta i alla
               underkataloger (ls **/*.txt), teman via Oh My Zsh och inställningar
               med setopt (t.ex. setopt autocd). Standardskal i macOS.

               Utan argument startas ett nytt interaktivt zsh-skal. Med exit kommer
               du tillbaka till skalet du kom ifrån.

               Inställningarna läses från ~/.zshrc. Prompten ställs in med
               variabeln PROMPT, t.ex. PROMPT='%n@%m %1~ %# '.

        SKILLNADER MOT BASH (urval)
               - Ociterade $variabler delas inte upp vid mellanslag.
               - ** matchar alla underkataloger (i bash krävs shopt -s globstar).
               - Listor (arrayer) börjar på index 1, inte 0.

        EXEMPEL
               zsh
               ls **/*.txt
               exit
        """,
        """
        NAME
               zsh - the Z shell

        SYNOPSIS
               zsh
               zsh SCRIPT [ARGUMENT]...
               zsh -c 'COMMAND'

        DESCRIPTION
               zsh is a shell that is largely compatible with bash, with extras:
               better tab completion, ** to search all subdirectories
               (ls **/*.txt), themes through Oh My Zsh and options set with setopt
               (e.g. setopt autocd). The default shell on macOS.

               Without arguments a new interactive zsh is started. exit takes you
               back to the shell you came from.

               Settings are read from ~/.zshrc. The prompt is set with the PROMPT
               variable, e.g. PROMPT='%n@%m %1~ %# '.

        DIFFERENCES FROM BASH (selection)
               - Unquoted $variables are not split on spaces.
               - ** matches all subdirectories (bash needs shopt -s globstar).
               - Arrays start at index 1, not 0.

        EXAMPLES
               zsh
               ls **/*.txt
               exit
        """);
}
