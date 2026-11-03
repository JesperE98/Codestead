namespace Codestead.Shell.Commands;

// The fish command: the friendly interactive shell, started on top of bash.

public static partial class ShellsCmd
{
    private static readonly CommandDef Fish = ShellCommand(
        "fish",
        "fish – \"the friendly interactive shell\" med egen, enklare syntax",
        "fish – the friendly interactive shell, with its own simpler syntax",
        """
        NAMN
               fish - the friendly interactive shell

        SYNOPSIS
               fish
               fish SKRIPT [ARGUMENT]...
               fish -c 'KOMMANDO'

        BESKRIVNING
               fish är ett skal som satsar på att vara lätt att använda: förslag
               medan du skriver (autosuggestions), färger och bra standardval utan
               konfiguration. Syntaxen skiljer sig från bash:

                   set namn Kim              i stället för  namn=Kim
                   set -x EDITOR nano        i stället för  export EDITOR=nano
                   (pwd)                     i stället för  $(pwd)
                   $status                   i stället för  $?
                   $argv                     i stället för  $@
                   if test -f fil; ...; end  i stället för  if ...; then ...; fi
                   for x in a b c; ...; end  i stället för  for ...; do ...; done
                   function hej; ...; end    i stället för  hej() { ...; }
                   math 2 + 3                i stället för  $((2 + 3))

               Inställningar läses från ~/.config/fish/config.fish.

        EXEMPEL
               fish
               set frukt äpple
               echo $frukt
               exit
        """,
        """
        NAME
               fish - the friendly interactive shell

        SYNOPSIS
               fish
               fish SCRIPT [ARGUMENT]...
               fish -c 'COMMAND'

        DESCRIPTION
               fish aims to be easy to use: suggestions while you type
               (autosuggestions), colours and good defaults without configuration.
               The syntax differs from bash:

                   set name Kim              instead of  name=Kim
                   set -x EDITOR nano        instead of  export EDITOR=nano
                   (pwd)                     instead of  $(pwd)
                   $status                   instead of  $?
                   $argv                     instead of  $@
                   if test -f file; ...; end instead of  if ...; then ...; fi
                   for x in a b c; ...; end  instead of  for ...; do ...; done
                   function hi; ...; end     instead of  hi() { ...; }
                   math 2 + 3                instead of  $((2 + 3))

               Settings are read from ~/.config/fish/config.fish.

        EXAMPLES
               fish
               set fruit apple
               echo $fruit
               exit
        """);
}
