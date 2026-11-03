namespace Codestead.Shell.Commands;

// English summaries and man pages for the text processing commands (textproc.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
    private static OrderedDictionary<string, (string Summary, string? Man)> TextprocPages => new()
    {
        // ---------- Textbearbetning (textproc.ts) ----------
        ["tr"] = ("Replaces or deletes characters", """
            NAME
                   tr - translate, delete or squeeze characters

            SYNOPSIS
                   tr [-c] [-d] [-s] SET1 [SET2]

            DESCRIPTION
                   Reads standard input, replaces each character in SET1 with the
                   character in the same position in SET2 and writes the result to
                   standard output. tr only reads from standard input – never from
                   files. Use a pipe or <.

                   Sets are written as plain characters, ranges or classes:
                   a-z  A-Z  0-9           ranges
                   [:upper:] [:lower:]     upper / lower case letters
                   [:digit:] [:space:]     digits / whitespace
                   [:alpha:] [:alnum:] [:punct:]
                   \n  \t                  new line, tab

                   Note! tr works on single bytes, so a-z and [:lower:] do not
                   include letters such as é or ü.

            OPTIONS
                   -d    delete all characters in SET1
                   -s    squeeze repeated characters into one
                   -c    use the complement of SET1 (all characters NOT in it)

            EXAMPLES
                   echo hello | tr a-z A-Z          HELLO
                   echo $PATH | tr ':' '\n'         one directory per line
                   tr -d '0-9' < file.txt           delete all digits
                   echo "a   b    c" | tr -s ' '    a b c
            """),
        ["sed"] = ("Stream editor: replaces, deletes and prints lines", """
            NAME
                   sed - stream editor for filtering and transforming text

            SYNOPSIS
                   sed [OPTION]... SCRIPT [FILE]...
                   sed [OPTION]... -e SCRIPT [-e SCRIPT]... [FILE]...

            DESCRIPTION
                   sed reads files (or standard input) line by line, runs SCRIPT on
                   each line and prints the result. The file is not changed – unless
                   you use -i.

                   A script consists of commands, optionally preceded by an ADDRESS
                   that selects which lines the command applies to. Several commands
                   are separated by ; or given with several -e.

            OPTIONS
                   -n        only print what the p command asks for
                   -E, -r    extended regular expressions (like grep -E)
                   -i[SUFFIX]
                             edit the file in place. With SUFFIX a backup copy is
                             kept, e.g. -i.bak
                   -e SCRIPT add SCRIPT (can be given several times)

            COMMANDS
                   s/PATTERN/REPLACEMENT/FLAGS
                             substitute. FLAGS: g = all matches on the line,
                             i = case-insensitive, p = print the line, N = only
                             match number N. In REPLACEMENT, & means the whole match
                             and \1 ... \9 the groups \( \) (or ( ) with -E).
                             Any character can be the delimiter: s|/usr|/opt|
                   d         delete the line
                   p         print the line – usually together with -n
                   q         quit after this line
                   y/abc/xyz/   replace character by character
                   =         print the line number
                   a TEXT, i TEXT, c TEXT
                             append text after / insert before the line, or change the line

            ADDRESSES
                   5         line 5
                   1~2       every other line (first~step)
                   $         the last line
                   /regex/   lines that match
                   2,4       lines 2 to 4
                   /a/,/b/   from a line matching a to the next one matching b
                   ADDRESS!  all lines EXCEPT those that match

            EXAMPLES
                   sed 's/ERROR/FAILURE/' server.log
                   sed -n '5,8p' server.log
                   sed '/^#/d' settings.conf
                   sed -i 's/old/new/g' file.txt
                   sed -E 's/([0-9]+)-([0-9]+)/\2-\1/' dates.txt

            THE SIMULATOR
                   Supports s, d, p, q, Q, y, =, a, i and c. Commands that work with
                   the hold space (h, H, g, G, x), branches (b, t) and { } are not supported.
            """),
        ["awk"] = ("Processes text column by column (a small programming language)", """
            NAME
                   awk - pattern-driven language for processing text in columns

            SYNOPSIS
                   awk [-F SEPARATOR] [-v VAR=VALUE] 'PROGRAM' [FILE]...
                   awk [-F SEPARATOR] -f PROGRAMFILE [FILE]...

            DESCRIPTION
                   awk reads files (or standard input) line by line and splits each
                   line into fields. The fields are called $1, $2, ... and the whole
                   line $0. By default the fields are separated by spaces and tabs.

                   A PROGRAM consists of pairs: PATTERN { ACTION }
                   The action runs for every line that matches the pattern. Without a
                   pattern it runs for all lines; without an action the line is printed.

            OPTIONS
                   -F CHAR     field separator, e.g. -F: or -F,
                   -v VAR=VALUE
                               set a variable before the program starts
                   -f FILE     read the program from FILE

            PATTERNS
                   BEGIN { ... }      runs once before the first line
                   END { ... }        runs once after the last line
                   /regex/            lines that match
                   $3 > 10            comparisons: == != < <= > >=
                   $1 ~ /^a/          fields that match (!~ = does not match)
                   NR > 1 && $2 == "x"    && (and), || (or), ! (not)

            ACTIONS
                   print $1, $3       a comma gives a space (OFS) between the fields
                   printf "%-10s %5.1f\n", $1, $2
                   sum += $3          variables don't need to be declared
                   count[$1]++        arrays with text as index
                   if (...) ... else ...   while (...) ...   for (i = 1; i <= NF; i++) ...
                   for (key in count) ...   next   exit

            BUILT-IN VARIABLES
                   NR    line number       NF    number of fields on the line
                   $NF   the last field    FS / OFS   field separator in / out
                   FILENAME              the file being read

            FUNCTIONS
                   length(s)  substr(s, start, count)  index(s, t)  split(s, arr, sep)
                   sub(/re/, "new")  gsub(/re/, "new")  match(s, /re/)  sprintf(...)
                   toupper(s)  tolower(s)  int(x)  sqrt(x)

            EXAMPLES
                   awk '{print $1}' file.txt
                   awk -F: '{print $1, $7}' /etc/passwd
                   awk -F, 'NR > 1 {sum += $3} END {print sum}' betyg.csv
                   awk '$3 > 50 {print NR": "$0}' data.txt
                   ls -l | awk '{print $5, $NF}'

            THE SIMULATOR
                   User-defined functions (function), getline, output redirection
                   (print > file) and range patterns are not supported.
            """),
    };
}
