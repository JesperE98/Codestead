namespace Codestead.Shell.Commands;

// English summaries and man pages for the script builtin commands (script.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
    private const string TestMan = """
        NAME
               test, [ ], [[ ]] - evaluate a condition

        SYNOPSIS
               test EXPRESSION
               [ EXPRESSION ]
               [[ EXPRESSION ]]

        DESCRIPTION
               The exit status is 0 (true) if the condition holds, otherwise 1 (false).
               Almost always used together with if, while, && and ||.
               The spaces inside the brackets are required!

        FILES
               -e FILE   the file exists
               -f FILE   is a regular file
               -d FILE   is a directory
               -r/-w/-x  can be read / written / executed
               -s FILE   exists and is not empty

        TEXT
               -z TEXT   the text is empty
               -n TEXT   the text is not empty
               A = B     equal        A != B   different

        NUMBERS
               -eq  equal to          -ne  not equal to
               -lt  less than         -le  less than or equal to
               -gt  greater than      -ge  greater than or equal to

        COMBINING
               ! EXPRESSION       not
               A -a B / A -o B    and / or   (in [[ ]]: && and ||)

        EXAMPLES
               if [ -f ~/.bashrc ]; then echo "exists"; fi
               [ "$answer" = "yes" ] && echo "Good!"
               [[ $file == *.txt ]] && echo "a text file"
        """;

    private static OrderedDictionary<string, (string Summary, string? Man)> ScriptPages => new()
    {
        // ---------- Skript (script.ts) ----------
        ["test"] = ("Tests conditions (files, text and numbers)", TestMan),
        ["["] = ("Same as test, written [ condition ]", TestMan),
        ["[["] = ("Extended test in bash: [[ condition ]]", TestMan),
        ["read"] = ("Reads a line of input into variables", """
            NAME
                   read - read a line from standard input into one or more variables

            SYNOPSIS
                   read [-r] [-p PROMPT] NAME...

            DESCRIPTION
                   Reads a line and stores it in the variable NAME (or REPLY). With
                   several names the line is split at spaces; the last variable gets
                   the rest.

            OPTIONS
                   -p PROMPT  show PROMPT before the line is read
                   -r         treat \ as an ordinary character

            EXAMPLES
                   read -p "What is your name? " name
                   while read line; do echo "> $line"; done < file.txt

            IN THE SIMULATOR
                   Inside scripts, read can only read from a pipe or a file (< file),
                   not from the keyboard.
            """),
        ["printf"] = ("Prints formatted text", """
            NAME
                   printf - print formatted text

            SYNOPSIS
                   printf FORMAT [ARGUMENT]...

            DESCRIPTION
                   Like echo, but you control exactly what the output looks like. No
                   newline is added automatically – write \n where you want one.

            FORMAT
                   %s     text            %d     integer
                   %5s    right-align in 5 characters   %-10s  left-align in 10 characters
                   %.2f   decimal number with 2 decimals
                   %%     a percent sign

            EXAMPLES
                   printf "Hello %s!\n" "$USER"
                   printf "%-10s %5d\n" apples 3
            """),
        ["local"] = ("Creates a variable that only exists inside the function", """
            NAME
                   local - create a local variable in a function

            SYNOPSIS
                   local NAME[=VALUE]...

            DESCRIPTION
                   A local variable disappears when the function finishes and does not
                   affect a variable with the same name outside the function.
            """),
        ["return"] = ("Ends a function with an exit status", """
            NAME
                   return - return from a function

            SYNOPSIS
                   return [STATUS]

            DESCRIPTION
                   Ends the function. The exit status (0–255) becomes the function's $?.
                   Without an argument the exit status of the last command is used.
            """),
        ["break"] = ("Breaks out of a loop", """
            NAME
                   break - exit a for, while or until loop

            SYNOPSIS
                   break [N]

            DESCRIPTION
                   With N, N levels of nested loops are affected.
            """),
        ["continue"] = ("Skips to the next iteration of a loop", """
            NAME
                   continue - jump straight to the next iteration of a loop

            SYNOPSIS
                   continue [N]

            DESCRIPTION
                   With N, N levels of nested loops are affected.
            """),
        ["shift"] = ("Shifts the script's arguments one step ($2 becomes $1)", """
            NAME
                   shift - shift the positional parameters

            SYNOPSIS
                   shift [N]

            DESCRIPTION
                   $2 becomes $1, $3 becomes $2 and so on. With N they are shifted N steps.
            """),
        ["let"] = ("Does integer arithmetic", """
            NAME
                   let - integer arithmetic

            SYNOPSIS
                   let EXPRESSION...

            EXAMPLES
                   let "sum = 2 + 3"
                   let i++

            TIPS
                   The most common way today is (( i++ )) or sum=$(( 2 + 3 )).
            """),
        ["set"] = ("Shows variables or changes shell settings", """
            NAME
                   set - show variables or change shell settings

            SYNOPSIS
                   set
                   set -- ARGUMENT...
                   set -e / -u / -x / -o pipefail

            DESCRIPTION
                   Without arguments all variables are listed. "set -- a b c" sets $1, $2, $3.
                   The options -e (stop on error), -u and -x are common at the top of scripts.
                   The simulator accepts them, but they have no effect yet.
            """),
    };
}
