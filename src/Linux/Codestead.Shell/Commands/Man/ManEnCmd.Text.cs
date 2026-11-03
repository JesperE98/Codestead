namespace Codestead.Shell.Commands;

// English summaries and man pages for the text commands (text.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
    private static OrderedDictionary<string, (string Summary, string? Man)> TextPages => new()
    {
        // ---------- Text (text.ts) ----------
        ["cat"] = ("Shows the contents of files", """
            NAME
                   cat - concatenate files and print them

            SYNOPSIS
                   cat [-n] [FILE]...

            DESCRIPTION
                   Prints the contents of one or more files. Without FILE, cat reads
                   from standard input, e.g. from a pipe.

            OPTIONS
                   -n    number the lines

            EXAMPLES
                   cat /etc/os-release
                   cat part1.txt part2.txt > all.txt
            """),
        ["less"] = ("Pages through a file (one screen at a time)", """
            NAME
                   less - show a file one page at a time

            DESCRIPTION
                   In a real terminal you scroll with the arrow keys, space and b,
                   search with /word and quit with q. In the simulator the whole file
                   is shown at once.
            """),
        ["more"] = ("Shows a file page by page (older variant of less)", """
            NAME
                   more - show a file one page at a time

            DESCRIPTION
                   The predecessor of less. In the simulator the whole file is shown
                   at once.
            """),
        ["head"] = ("Shows the beginning of a file", """
            NAME
                   head - show the first lines of files

            SYNOPSIS
                   head [-n COUNT] [FILE]...

            OPTIONS
                   -n COUNT, -COUNT   show COUNT lines (default is 10)

            EXAMPLES
                   head -n 3 server.log
                   ls -l /etc | head -5
            """),
        ["tail"] = ("Shows the end of a file", """
            NAME
                   tail - show the last lines of files

            SYNOPSIS
                   tail [-n COUNT] [FILE]...

            OPTIONS
                   -n COUNT, -COUNT   show COUNT lines (default is 10)
                   -n +N              show from line N onwards
                   -f                 follow the file as it grows (not supported in the simulator)

            EXAMPLES
                   tail -n 3 server.log
                   tail -n 20 /var/log/syslog
            """),
        ["wc"] = ("Counts lines, words and characters", """
            NAME
                   wc - count lines, words and bytes (word count)

            SYNOPSIS
                   wc [-l] [-w] [-c] [FILE]...

            OPTIONS
                   -l    number of lines
                   -w    number of words
                   -c    number of bytes
                   -m    number of characters

            EXAMPLES
                   wc -l dokument/frukter.txt
                   ls /etc | wc -l
            """),
        ["grep"] = ("Searches for lines matching a pattern", """
            NAME
                   grep - print lines that match a pattern

            SYNOPSIS
                   grep [OPTION]... PATTERN [FILE]...

            DESCRIPTION
                   Searches through files (or standard input) and prints the lines
                   that contain PATTERN. PATTERN is a regular expression.

            OPTIONS
                   -i    ignore the difference between upper and lower case
                   -v    show lines that do NOT match
                   -n    show line numbers
                   -c    show only the number of matching lines
                   -l    show only the names of files that match
                   -r    search recursively in directories
                   -w    match whole words only
                   -o    show only the part that matches
                   -E    extended regular expressions (e.g. "ERROR|WARN")
                   -F    the pattern is plain text, not a regular expression

            EXAMPLES
                   grep ERROR server.log
                   grep -in "warning" *.txt
                   grep -E "ERROR|WARN" server.log
                   ps aux | grep firefox
            """),
        ["sort"] = ("Sorts lines", """
            NAME
                   sort - sort lines of text files

            SYNOPSIS
                   sort [OPTION]... [FILE]...

            OPTIONS
                   -r    reverse order
                   -n    sort numerically (2 before 10)
                   -u    remove duplicates
                   -f    ignore the difference between upper and lower case
                   -k N  sort on field number N

            EXAMPLES
                   sort frukter.txt
                   sort frukter.txt | uniq -c | sort -rn
            """),
        ["uniq"] = ("Removes repeated lines (that are next to each other)", """
            NAME
                   uniq - report or omit repeated lines

            SYNOPSIS
                   uniq [OPTION]... [FILE]

            DESCRIPTION
                   Removes lines that are identical to the line directly above. That
                   is why uniq is almost always used after sort.

            OPTIONS
                   -c    prefix each line with the number of occurrences
                   -d    only show lines that occur more than once
                   -u    only show lines that are unique
                   -i    ignore the difference between upper and lower case

            EXAMPLES
                   sort frukter.txt | uniq -c
            """),
        ["cut"] = ("Picks out columns from lines", """
            NAME
                   cut - pick out parts of each line

            SYNOPSIS
                   cut -d DELIMITER -f FIELDS [FILE]...
                   cut -c CHARACTERS [FILE]...

            OPTIONS
                   -d CHAR     use CHAR as the field delimiter (default is tab)
                   -f LIST     select fields, e.g. 1 or 1,3 or 2-4
                   -c LIST     select characters in the same way

            EXAMPLES
                   cut -d: -f1 /etc/passwd      all user names
            """),
        ["tee"] = ("Writes input both to the screen and to files", """
            NAME
                   tee - read from standard input and write to both standard output and files

            SYNOPSIS
                   tee [-a] [FILE]...

            OPTIONS
                   -a    append to the files instead of overwriting them

            EXAMPLES
                   ls | tee list.txt
                   echo "127.0.0.1 test" | sudo tee -a /etc/hosts

            TIPS
                   "sudo echo text > /etc/file" does not work, because it is your own
                   shell (not sudo) that opens the file. Use "echo text | sudo tee /etc/file".
            """),
    };
}
