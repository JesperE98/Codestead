namespace Codestead.Shell.Commands;

// English summaries and man pages for the files and directories commands (fs.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
    private static OrderedDictionary<string, (string Summary, string? Man)> FsPages => new()
    {
        // ---------- Filer och kataloger (fs.ts) ----------
        ["cd"] = ("Changes the current directory", """
            NAME
                   cd - change directory

            SYNOPSIS
                   cd [DIRECTORY]

            DESCRIPTION
                   Makes DIRECTORY the current directory. Without an argument you go to
                   your home directory ($HOME).

                   cd ..     go up one level
                   cd ~      go to the home directory
                   cd -      go back to the previous directory
                   cd /      go to the root directory
            """),
        ["pwd"] = ("Prints the current directory", """
            NAME
                   pwd - print the name of the current directory (print working directory)

            SYNOPSIS
                   pwd [-P]

            DESCRIPTION
                   Prints the absolute path of the directory you are in.

            OPTIONS
                   -P   show the real path, without symbolic links
            """),
        ["ls"] = ("Lists the contents of directories", """
            NAME
                   ls - list the contents of directories

            SYNOPSIS
                   ls [OPTION]... [FILE]...

            DESCRIPTION
                   Lists files and directories. Without an argument the current
                   directory is listed.

            OPTIONS
                   -a, --all       also show hidden files (names starting with .)
                   -A              like -a, but without . and ..
                   -l              long format: permissions, owner, size, date
                   -h              human-readable sizes (1K, 4.0M) together with -l
                   -d              list the directory itself, not its contents
                   -F              append / to directories, * to executable files and
                                   @ to symbolic links
                   -i              show the inode number before each name
                   -1              one file per line

            EXAMPLES
                   ls -la ~        everything in the home directory, in long format
            """),
        ["mkdir"] = ("Creates directories", """
            NAME
                   mkdir - create directories (make directory)

            SYNOPSIS
                   mkdir [OPTION]... DIRECTORY...

            OPTIONS
                   -p, --parents   also create missing parent directories, and give
                                   no error if the directory already exists
                   -v, --verbose   report every directory that is created

            EXAMPLES
                   mkdir -p project/src/test
            """),
        ["rmdir"] = ("Removes empty directories", """
            NAME
                   rmdir - remove empty directories

            SYNOPSIS
                   rmdir DIRECTORY...

            DESCRIPTION
                   Removes the directory only if it is empty. Use rm -r to remove a
                   directory together with its contents.
            """),
        ["touch"] = ("Creates empty files or updates their timestamp", """
            NAME
                   touch - change file timestamps, or create empty files

            SYNOPSIS
                   touch FILE...

            DESCRIPTION
                   If FILE does not exist, an empty file is created. If it exists, its
                   modification time is set to now.
            """),
        ["rm"] = ("Removes files and directories", """
            NAME
                   rm - remove files or directories

            SYNOPSIS
                   rm [OPTION]... FILE...

            DESCRIPTION
                   Removes files. There is no trash can – what you remove is gone!

            OPTIONS
                   -r, -R, --recursive   remove directories and all their contents
                   -f, --force           ignore files that don't exist, never ask
                   -v, --verbose         report what is being removed

            WARNING
                   rm -rf is powerful. Always double-check the path before pressing Enter.
            """),
        ["cp"] = ("Copies files and directories", """
            NAME
                   cp - copy files and directories

            SYNOPSIS
                   cp [OPTION]... SOURCE DEST
                   cp [OPTION]... SOURCE... DIRECTORY

            OPTIONS
                   -r, -R, --recursive   copy directories with all their contents
                   -a, --archive         like -r, but keep owner and permissions
                   -v, --verbose         report what is being copied

            EXAMPLES
                   cp report.txt report-copy.txt
                   cp -r project/ backup/
            """),
        ["mv"] = ("Moves or renames files", """
            NAME
                   mv - move or rename files

            SYNOPSIS
                   mv [OPTION]... SOURCE DEST
                   mv [OPTION]... SOURCE... DIRECTORY

            DESCRIPTION
                   If DEST is an existing directory, SOURCE is moved into it. Otherwise
                   SOURCE is renamed to DEST. Directories can be moved without -r.

            OPTIONS
                   -v, --verbose   report what is being moved
            """),
        ["find"] = ("Searches for files in a directory tree", """
            NAME
                   find - search for files in a directory tree

            SYNOPSIS
                   find [PATH...] [EXPRESSION]

            EXPRESSIONS
                   -name PATTERN     the file name matches PATTERN (e.g. "*.txt")
                   -iname PATTERN    like -name but case-insensitive
                   -type f|d|l       only files (f), directories (d) or symbolic
                                     links (l)
                   -maxdepth N       descend at most N levels
                   -mindepth N       show nothing at levels shallower than N

            EXAMPLES
                   find ~ -name "*.txt"
                   find /etc -maxdepth 1 -type d

            TIPS
                   Put the pattern in quotes, otherwise the shell expands * before
                   find even gets to see it.
            """),
        ["chmod"] = ("Changes file permissions", """
            NAME
                   chmod - change permissions (change mode)

            SYNOPSIS
                   chmod [-R] MODE FILE...

            DESCRIPTION
                   MODE can be given as digits or as symbols.

                   Digits (octal): one digit per group – owner, group, others.
                   r = 4, w = 2, x = 1. Add them up:
                       chmod 755 script.sh   rwxr-xr-x
                       chmod 644 file.txt    rw-r--r--
                       chmod 600 secret      rw-------

                   Symbols: [ugoa][+-=][rwx]
                       u = owner (user), g = group, o = others, a = all
                       chmod +x script.sh    make executable for everyone
                       chmod u+x,g-w file    add x for the owner, remove w for the group
                       chmod o= file         remove all permissions for others

            OPTIONS
                   -R    change recursively in directories
            """),
        ["chown"] = ("Changes the owner of files (requires root)", """
            NAME
                   chown - change the owner and group of files (change owner)

            SYNOPSIS
                   chown [-R] OWNER[:GROUP] FILE...

            DESCRIPTION
                   Only root can change the owner of files, so you usually need sudo:
                       sudo chown $USER:$USER file.txt

            OPTIONS
                   -R    change recursively in directories
            """),
        ["echo"] = ("Prints text", """
            NAME
                   echo - print a line of text

            SYNOPSIS
                   echo [-n] [-e] [TEXT]...

            OPTIONS
                   -n    do not print a newline at the end
                   -e    interpret \n (new line) and \t (tab)

            EXAMPLES
                   echo Hello world
                   echo "My home directory is $HOME"
                   echo 'Single quotes: $HOME is printed as written'
            """),
    };
}
