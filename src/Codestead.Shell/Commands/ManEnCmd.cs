namespace Codestead.Shell.Commands;

// Port of src/shell/commands/man-en.ts – English summaries and man pages for commands that do not
// have SummaryEn/ManEn directly in their CommandDef. Shown for every language except Swedish.
// The man page texts must stay byte for byte identical to the TypeScript.

public static partial class ManEnCmd
{
    // ---------- Pages shared by several commands ----------

    private const string ExitMan = """
        NAME
               exit - exit the shell

        DESCRIPTION
               If you became root with "sudo -i", exit takes you back to your
               ordinary user.
        """;

    private const string BashMan = """
        NAME
               bash - GNU Bourne-Again SHell

        SYNOPSIS
               bash SCRIPT [ARGUMENT]...
               bash -c 'COMMAND'

        DESCRIPTION
               bash is the shell you type your commands in. "bash script.sh" runs a
               script without it having to be executable (chmod +x).
        """;

    private const string SourceMan = """
        NAME
               source - read and run commands from a file in the current shell

        DESCRIPTION
               Unlike running a script, source affects your shell: aliases,
               variables and cd stay in effect afterwards. Often used like this:
                   source ~/.bashrc
               A dot (.) is a shorter form: . ~/.bashrc
        """;

    private const string EnvDescription = """
        DESCRIPTION
               Environment variables are named values that programs can read, e.g.
               HOME (your home directory), PATH (where commands are looked up) and USER.
        """;

    private const string AptCommon = """
               update          download new package lists from the repositories
               upgrade         upgrade all installed packages
               install PACKAGE install packages
               remove PACKAGE  remove packages (configuration files are kept)
               purge PACKAGE   remove packages and their configuration files
               autoremove      remove dependencies that are no longer needed
        """;

    private const string AptTail = """
        OPTIONS
               -y, --yes       answer yes to all questions

        DESCRIPTION
               Most commands require root, so they are run with sudo:
                   sudo apt update && sudo apt upgrade
        """;

    private const string DnfMan = """
        NAME
               dnf - package manager for Fedora, RHEL, Rocky Linux and similar

        SYNOPSIS
               dnf [-y] COMMAND [PACKAGE]...

        COMMANDS
               install PACKAGE   install packages
               remove PACKAGE    remove packages
               upgrade           upgrade all packages
               check-update      show which packages can be upgraded
               makecache         download fresh metadata from the repositories
               search WORD       search for packages
               info PACKAGE      show information about a package
               list --installed  list installed packages
               repolist          show enabled repositories

        OPTIONS
               -y, --assumeyes   answer yes to all questions

        DESCRIPTION
               dnf refreshes the metadata automatically when it is old, so there
               is no separate "update" step as in apt. Note that the question
               "Is this ok [y/N]" defaults to No – press y and Enter.
        """;

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

    private const string GzipMan = """
        NAME
               gzip, gunzip, zcat - compress and decompress files

        SYNOPSIS
               gzip [-k] [-v] [-d] [-c] [-l] FILE...
               gunzip FILE.gz...
               zcat FILE.gz...

        DESCRIPTION
               gzip compresses ONE file at a time: file.txt is replaced by the
               smaller file file.txt.gz. Permissions and timestamp are kept. To
               compress a whole directory, first bundle it with tar (or use
               tar -z directly).

               gunzip is the same as gzip -d, and zcat the same as gzip -dc:
               zcat prints the contents without unpacking the file.

               Very small files often get BIGGER when compressed, because gzip
               adds a header containing, among other things, the file name.

        OPTIONS
               -k, --keep         keep the original file
               -d, --decompress   decompress (like gunzip)
               -c, --stdout       write the result to standard output
               -l, --list         show the size before and after compression
               -v, --verbose      tell how much smaller the file became
               -r, --recursive    compress every file in directories, one by one
               -f, --force        overwrite files that already exist
               -1 ... -9          faster (-1) or better (-9) compression

        EXAMPLES
               gzip -kv server.log         compress, but keep the original
               gzip -l server.log.gz       how much did we save?
               zcat server.log.gz | grep ERROR
        """;

    private const string KillByNameOptions = """
        OPTIONS
               -9        send SIGKILL instead of SIGTERM
               -u USER   only processes owned by USER
        """;

    public static OrderedDictionary<string, (string Summary, string? Man)> ManEn { get; } = new()
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
                   pwd

            DESCRIPTION
                   Prints the absolute path of the directory you are in.
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
                   -F              append / to directories and * to executable files
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
                   -type f|d         only files (f) or directories (d)
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
                       sudo chown elev:elev file.txt

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
        // ---------- System (system.ts) ----------
        ["whoami"] = ("Shows which user you are", """
            NAME
                   whoami - print your user name

            DESCRIPTION
                   Shows the name of the user running the command. Try "sudo whoami"!
            """),
        ["id"] = ("Shows user and group IDs", """
            NAME
                   id - show user ID (uid), group ID (gid) and groups

            SYNOPSIS
                   id [USER]
            """),
        ["groups"] = ("Shows which groups you belong to", """
            NAME
                   groups - show which groups a user belongs to

            DESCRIPTION
                   Members of the group sudo (Debian/Ubuntu) or wheel (Arch/Fedora)
                   may use sudo.
            """),
        ["hostname"] = ("Shows the computer's name", """
            NAME
                   hostname - show the system's host name

            DESCRIPTION
                   The name is also stored in the file /etc/hostname.
            """),
        ["uname"] = ("Shows information about the system and the kernel", """
            NAME
                   uname - show system information

            OPTIONS
                   -a    everything
                   -r    the kernel version (kernel release)
                   -n    the host name
                   -m    hardware architecture (e.g. x86_64)
            """),
        ["date"] = ("Shows the date and time", """
            NAME
                   date - show the date and time
            """),
        ["env"] = ("Shows environment variables", $$"""
            NAME
                   env - show environment variables

            SYNOPSIS
                   env

            {{EnvDescription}}
            """),
        ["printenv"] = ("Shows environment variables", $$"""
            NAME
                   printenv - show environment variables

            SYNOPSIS
                   printenv [VARIABLE]...

            {{EnvDescription}}
            """),
        ["export"] = ("Sets an environment variable", """
            NAME
                   export - make a variable available to programs that are started

            SYNOPSIS
                   export NAME=VALUE

            EXAMPLES
                   export EDITOR=nano
                   export PATH="$HOME/bin:$PATH"

            DESCRIPTION
                   Variables set with export only apply to the current session. Put
                   the line in ~/.bashrc if it should apply every time you open a terminal.
            """),
        ["unset"] = ("Removes a variable or function", """
            NAME
                   unset - remove a variable or function

            SYNOPSIS
                   unset NAME...
                   unset -f FUNCTION...
            """),
        ["alias"] = ("Creates a shortcut for a command", """
            NAME
                   alias - create command shortcuts

            SYNOPSIS
                   alias NAME='COMMAND'
                   alias

            EXAMPLES
                   alias ll='ls -la'
                   alias ..='cd ..'

            DESCRIPTION
                   Without arguments all aliases are listed. Put aliases in ~/.bashrc
                   to keep them permanently.
            """),
        ["unalias"] = ("Removes an alias", null),
        ["history"] = ("Shows previous commands", """
            NAME
                   history - show the command history

            DESCRIPTION
                   Use arrow up/down to browse through previous commands.

            OPTIONS
                   -c    clear the history
            """),
        ["type"] = ("Shows what a command name is (alias, builtin, file)", """
            NAME
                   type - show how a command name is interpreted

            EXAMPLES
                   type cd      cd is a shell builtin
                   type ls      ls is /usr/bin/ls
            """),
        ["which"] = ("Shows where a command is located", """
            NAME
                   which - show the full path of a command

            DESCRIPTION
                   Searches the directories in $PATH. Shell builtins (like cd) are not
                   files and are therefore not found – use "type" for those.

            EXAMPLES
                   which ls
            """),
        ["man"] = ("Shows the manual for a command", """
            NAME
                   man - show manual pages

            SYNOPSIS
                   man COMMAND

            DESCRIPTION
                   Almost every command has a manual page. It is the first place to
                   look when you wonder what an option does. In the simulator the
                   manuals are simplified.
            """),
        ["help"] = ("Lists all available commands", """
            NAME
                   help - list the commands in the simulator
            """),
        ["clear"] = ("Clears the screen", """
            NAME
                   clear - clear the terminal window

            TIPS
                   The shortcut Ctrl+L does the same thing.
            """),
        ["exit"] = ("Exits the shell (or leaves the root shell)", ExitMan),
        ["logout"] = ("Logs out of a login shell", ExitMan),
        ["sudo"] = ("Runs a command as root (administrator)", """
            NAME
                   sudo - run a command as another user (usually root)

            SYNOPSIS
                   sudo COMMAND [ARGUMENT]...
                   sudo -i

            DESCRIPTION
                   root is the system administrator and may do anything. Ordinary users
                   who belong to the group sudo (Debian/Ubuntu) or wheel (Arch/Fedora)
                   can run single commands as root by putting sudo in front of them.
                   You then enter your own password.

                   sudo -i    start a root shell (leave it with exit)

            EXAMPLES
                   sudo apt update
                   sudo cat /etc/shadow

            WARNING
                   With sudo there is no safety net. Only run commands you understand.
            """),
        ["su"] = ("Switches user", """
            NAME
                   su - switch user (substitute user)

            DESCRIPTION
                   "su -" logs in as root, but requires the root password. On Ubuntu the
                   root account is locked, so "sudo -i" is used there instead.
            """),
        ["bash"] = ("Runs a script in a new bash shell", BashMan),
        ["sh"] = ("Runs a script in a new bash shell", BashMan),
        ["source"] = ("Runs a script in the current shell", SourceMan),
        ["."] = ("Runs a script in the current shell", SourceMan),
        ["true"] = ("Does nothing, always succeeds", null),
        ["false"] = ("Does nothing, always fails", null),
        ["sleep"] = ("Waits for a while", """
            NAME
                   sleep - wait for a number of seconds

            DESCRIPTION
                   In the simulator sleep returns immediately.
            """),
        ["seq"] = ("Prints a sequence of numbers", """
            NAME
                   seq - print a sequence of numbers

            SYNOPSIS
                   seq LAST
                   seq FIRST LAST
                   seq FIRST STEP LAST
            """),
        ["basename"] = ("Strips the directory part from a path", null),
        ["dirname"] = ("Strips the file name from a path", null),
        // ---------- Pakethantering (pkg.ts) ----------
        ["apt"] = ("The package manager in Debian and Ubuntu", $$"""
            NAME
                   apt - package manager for Debian, Ubuntu and similar

            SYNOPSIS
                   apt [-y] COMMAND [PACKAGE]...

            COMMANDS
            {{AptCommon}}
                   search WORD     search for packages
                   show PACKAGE    show information about a package
                   list --installed   list installed packages
                   list --upgradable  list packages that can be upgraded

            {{AptTail}}
            """),
        ["apt-get"] = ("Older, script-friendly variant of apt", $$"""
            NAME
                   apt-get - package manager for Debian, Ubuntu and similar

            SYNOPSIS
                   apt-get [-y] COMMAND [PACKAGE]...

            COMMANDS
            {{AptCommon}}

            {{AptTail}}
            """),
        ["pacman"] = ("The package manager in Arch Linux", """
            NAME
                   pacman - package manager for Arch Linux and similar

            SYNOPSIS
                   pacman OPERATION [OPTIONS] [PACKAGE]...

            OPERATIONS (capital letter)
                   -S    sync: install packages from the repositories
                   -R    remove packages
                   -Q    query the database of installed packages

            COMMON COMBINATIONS
                   pacman -Syu          refresh the package database and upgrade everything
                   pacman -S PACKAGE    install a package
                   pacman -Ss WORD      search for packages
                   pacman -Si PACKAGE   show information about a package
                   pacman -R PACKAGE    remove a package
                   pacman -Rs PACKAGE   remove a package and dependencies no longer needed
                   pacman -Q            list installed packages
                   pacman -Qi PACKAGE   information about an installed package

            OPTIONS
                   --noconfirm   don't ask for confirmation
                   --needed      don't reinstall packages that are already up to date

            DESCRIPTION
                   Arch is a "rolling release": packages are updated all the time.
                   Always run -Syu instead of just -Sy, otherwise you risk a
                   half-upgraded (partial upgrade) and broken installation.
            """),
        ["dnf"] = ("The package manager in Fedora and Red Hat", DnfMan),
        ["dnf5"] = ("The package manager in Fedora and Red Hat", DnfMan),
        // ---------- Övriga program (extras.ts) ----------
        ["tree"] = ("Shows directories as a tree", """
            NAME
                   tree - show the contents of directories as a tree

            SYNOPSIS
                   tree [-a] [-d] [-L LEVEL] [DIRECTORY]

            OPTIONS
                   -a         also show hidden files
                   -d         only show directories
                   -L LEVEL   descend at most LEVEL levels
            """),
        ["htop"] = ("Shows processes and resource usage", """
            NAME
                   htop - interactive process viewer

            DESCRIPTION
                   Shows CPU, memory and every running process. In a real terminal you
                   sort with F6, search with F3, kill processes with F9 and close htop
                   with q or F10. In the simulator a snapshot is shown.
            """),
        ["fastfetch"] = ("Shows system information with the distro logo", """
            NAME
                   fastfetch - show system information together with the distribution's logo

            DESCRIPTION
                   A fast successor to neofetch. Popular in screenshots!
            """),
        ["cowsay"] = ("A cow that says something", """
            NAME
                   cowsay - a talking cow

            EXAMPLES
                   cowsay Hello!
                   fortune | cowsay
            """),
        ["git"] = ("Version control", """
            NAME
                   git - distributed version control

            DESCRIPTION
                   git will get its own chapter. So far the simulator only supports
                   "git --version".
            """),
        ["curl"] = ("Transfers data from or to a server", """
            NAME
                   curl - transfer data from or to a server

            DESCRIPTION
                   The simulator has no network, so curl cannot fetch anything.
            """),
        ["wget"] = ("Downloads files from the web", """
            NAME
                   wget - download files from the web

            DESCRIPTION
                   The simulator has no network, so wget cannot fetch anything.
            """),
        ["python3"] = ("The Python programming language", """
            NAME
                   python3 - interpreter for the Python programming language

            DESCRIPTION
                   The simulator supports "python3 --version". An interactive Python
                   mode is not available yet.
            """),
        ["vim"] = ("Powerful text editor", """
            NAME
                   vim - Vi IMproved, a powerful text editor

            DESCRIPTION
                   vim has modes: press i to type, Esc to go back, :w to save
                   and :q to quit (:q! to quit without saving).
            """),
        ["nano"] = ("Simple text editor", """
            NAME
                   nano - a simple text editor

            DESCRIPTION
                   The commands are shown at the bottom: ^O means Ctrl+O (save) and ^X
                   means Ctrl+X (exit).
            """),
        ["ssh"] = ("Logs in securely to another computer", """
            NAME
                   ssh - log in to another computer via SSH (Secure Shell)

            SYNOPSIS
                   ssh USER@HOST

            DESCRIPTION
                   The simulator has no network, so ssh cannot connect anywhere.
            """),
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
        // ---------- Processer (procs.ts) ----------
        ["ps"] = ("Shows processes", """
            NAME
                   ps - show a snapshot of the processes

            SYNOPSIS
                   ps [OPTIONS]

            DESCRIPTION
                   Without options only the processes in your own terminal are shown.

            OPTIONS
                   aux              all processes, with user, CPU and memory (BSD style)
                   -ef              all processes with the parent's PID (PPID)
                   -u USER          only processes owned by USER
                   -p PID           only the process with PID
                   --sort=-%cpu     sort by CPU usage, largest first
                                    (also -%mem, pid, -pid)

            COLUMNS
                   PID   the process's ID number
                   %CPU  how much of the processor the process uses
                   STAT  R = running, S = sleeping, s = session leader, + = in the foreground
                   TTY   the terminal the process belongs to (? = none)

            EXAMPLES
                   ps aux | grep sshd
                   ps aux --sort=-%cpu | head -5
            """),
        ["top"] = ("Shows the processes using the most resources", """
            NAME
                   top - show processes and resource usage, updated continuously

            DESCRIPTION
                   At the top you see the load average, the number of processes, CPU and
                   memory. Below that, all processes sorted by CPU usage.
                   In a real terminal top refreshes every second: press M to sort by
                   memory, k to kill a process and q to quit.
                   In the simulator a snapshot is shown.

            OPTIONS
                   -b -n 1   print once (handy in scripts)
            """),
        ["kill"] = ("Sends a signal to a process (ends it)", """
            NAME
                   kill - send a signal to a process

            SYNOPSIS
                   kill [-SIGNAL] PID...
                   kill %JOB
                   kill -l

            DESCRIPTION
                   By default SIGTERM (15) is sent, which asks the process to exit
                   cleanly. If it doesn't listen, you can send SIGKILL (9), which forces
                   it to stop at once – but then it gets no chance to clean up after itself.

                   You can only send signals to your own processes. For other users'
                   processes you need sudo.

            SIGNALS
                   1  HUP    reload the configuration (for many services)
                   2  INT    the same as Ctrl+C
                   9  KILL   force the process to exit
                   15 TERM   ask the process to exit (default)

            EXAMPLES
                   kill 3141
                   kill -9 3141
                   kill %1
            """),
        ["killall"] = ("Ends all processes with a given name", $$"""
            NAME
                   killall - end all processes with a given name

            SYNOPSIS
                   killall [-SIGNAL] NAME

            {{KillByNameOptions}}

            EXAMPLES
                   killall firefox
            """),
        ["pkill"] = ("Ends processes whose names match a pattern", $$"""
            NAME
                   pkill - end processes whose names match a pattern

            SYNOPSIS
                   pkill [-SIGNAL] PATTERN

            {{KillByNameOptions}}

            EXAMPLES
                   pkill minserver
            """),
        ["pgrep"] = ("Shows the PIDs of processes whose names match a pattern", """
            NAME
                   pgrep - show the PIDs of processes whose names match a pattern

            SYNOPSIS
                   pgrep [-SIGNAL] PATTERN

            OPTIONS
                   -l        also show the process name
                   -a        show the full command line
                   -u USER   only processes owned by USER

            EXAMPLES
                   pgrep minserver
            """),
        ["jobs"] = ("Shows the background jobs in this terminal", """
            NAME
                   jobs - show the jobs started from this terminal

            SYNOPSIS
                   jobs [-l]

            DESCRIPTION
                   A job is started in the background by putting & after the command,
                   e.g. "sleep 300 &". The jobs are numbered [1], [2] ... and can be
                   given as %1, %2 to kill, fg and bg.

            OPTIONS
                   -l    also show the PID
            """),
        ["fg"] = ("Moves a background job to the foreground", """
            NAME
                   fg - move a job to the foreground

            SYNOPSIS
                   fg [%JOB]

            DESCRIPTION
                   The job takes over the terminal until it is done. In a real terminal
                   you can send it back to the background with Ctrl+Z followed by bg.
            """),
        ["bg"] = ("Resumes a stopped job in the background", """
            NAME
                   bg - let a stopped job continue in the background

            SYNOPSIS
                   bg [%JOB]

            DESCRIPTION
                   Used after a program has been stopped with Ctrl+Z.
            """),
        ["wait"] = ("Waits until the background jobs are done", """
            NAME
                   wait - wait for background jobs to finish

            DESCRIPTION
                   Used in scripts that start several things in parallel with & and
                   then need to wait for them. In the simulator the jobs finish at once.
            """),
        ["uptime"] = ("Shows how long the computer has been running, and the load", """
            NAME
                   uptime - show how long the system has been running

            DESCRIPTION
                   The load average is the average number of processes that want the
                   processor during the last 1, 5 and 15 minutes.
            """),
        ["free"] = ("Shows how much memory is used", """
            NAME
                   free - show used and free memory

            OPTIONS
                   -h    human-readable units (Mi, Gi)
                   -m    in mebibytes
            """),
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
        // ---------- Arkiv (archive.ts) ----------
        ["tar"] = ("Bundles files into an archive (.tar, .tar.gz) and unpacks them", """
            NAME
                   tar - bundle files into an archive, and unpack them again
                         (tape archive)

            SYNOPSIS
                   tar -c [-v] [-z] -f ARCHIVE FILE...      create an archive
                   tar -t [-v] [-z] -f ARCHIVE              list the contents
                   tar -x [-v] [-z] -f ARCHIVE [-C DIR]     unpack

            DESCRIPTION
                   tar collects many files and directories into ONE file, an archive.
                   Permissions, owners and timestamps come along. tar does not compress
                   by itself – with -z the archive is passed through gzip, and then the
                   file is usually called .tar.gz or .tgz.

                   The options can be written together, and the dash can be left out:
                   tar -czvf, tar czvf and tar -c -z -v -f all mean the same thing.

            OPTIONS
                   -c, --create       create a new archive
                   -x, --extract      unpack (extract)
                   -t, --list         list the contents (table of contents)
                   -v, --verbose      show the files being handled; with -t in ls -l format
                   -f, --file=ARCHIVE the archive file. Put f last among combined
                                      options, since the file name must follow it directly
                   -z, --gzip         compress/decompress with gzip
                   -C, --directory=DIR  change to the directory DIR first (with -x:
                                      unpack there instead of in the current directory)
                   -p                 keep the permissions exactly when unpacking

            EXAMPLES
                   tar -czvf dokument.tar.gz dokument     bundle and compress
                   tar -tzvf dokument.tar.gz              look inside the archive
                   tar -xzvf dokument.tar.gz -C /tmp      unpack into /tmp

            MNEMONIC
                   c = create, x = extract, t = list, z = gzip, v = verbose, f = file.
                   "Create Zipped Verbose File" – czvf.
            """),
        ["gzip"] = ("Compresses files (file → file.gz)", GzipMan),
        ["gunzip"] = ("Unpacks .gz files (same as gzip -d)", GzipMan),
        ["zcat"] = ("Shows the contents of .gz files without unpacking them", GzipMan),
        ["zip"] = ("Bundles and compresses files into a .zip file", """
            NAME
                   zip - bundle and compress files into a zip archive

            SYNOPSIS
                   zip [-r] [-q] [-j] ARCHIVE.zip FILE...

            DESCRIPTION
                   zip does both what tar and gzip do: it bundles several files into
                   an archive and compresses them. The format comes from the Windows
                   world, so choose zip when sending files to someone who doesn't run Linux.

                   If the archive already exists, the files are added to (or updated
                   in) it. If ARCHIVE has no file extension, .zip is added.

            OPTIONS
                   -r    include directories and all their contents (recursive). Without -r
                         only the empty directory is added!
                   -q    quiet – print nothing
                   -j    store only the file names, not the directories (junk paths)

            EXAMPLES
                   zip -r dokument.zip dokument
                   zip pictures.zip picture1.png picture2.png

            SEE ALSO
                   unzip(1), tar(1)
            """),
        ["unzip"] = ("Unpacks .zip files", """
            NAME
                   unzip - list and extract files from a zip archive

            SYNOPSIS
                   unzip [-l] [-o] [-n] [-q] ARCHIVE.zip [FILE...] [-d DIRECTORY]

            DESCRIPTION
                   Extracts all files (or only the ones given) into the current
                   directory. Permissions come along, but the files are owned by you.

                   Files that already exist are skipped. Use -o to overwrite them.

            OPTIONS
                   -l              list the contents, don't extract
                   -d DIRECTORY    extract into DIRECTORY (created if missing)
                   -o              overwrite existing files without asking
                   -n              never overwrite existing files
                   -q              quiet – print nothing

            EXAMPLES
                   unzip -l dokument.zip
                   unzip dokument.zip -d unpacked
            """),
        ["du"] = ("Shows how much disk space files and directories use", """
            NAME
                   du - show how much disk space files and directories use
                        (disk usage)

            SYNOPSIS
                   du [OPTION]... [FILE]...

            DESCRIPTION
                   Shows the size of every directory (and subdirectory) in kilobytes.
                   Without FILE the current directory is shown.

                   The disk is divided into blocks of 4 KiB, so even a 10-byte file
                   takes up 4.0K on disk. You see the real size with --apparent-size
                   or with ls -l.

            OPTIONS
                   -h, --human-readable   human-readable sizes (4.0K, 12M, 1.5G)
                   -s, --summarize        show only one total per argument
                   -a, --all              also show files, not only directories
                   -c, --total            add a line with the grand total
                   -d, --max-depth=N      only show N levels down
                   -b, --bytes            real size in bytes (--apparent-size)
                       --apparent-size    real size instead of disk usage

            EXAMPLES
                   du -sh dokument                 how big is the directory?
                   du -h -d 1 ~                    the size of everything in the home directory
                   du -h dokument.tar dokument.tar.gz
            """),
    };

    public static string SummaryFor(CommandDef def, Shell sh)
    {
        if (sh.Lang == "sv") return def.Summary;
        return def.SummaryEn ?? (ManEn.TryGetValue(def.Name, out var e) ? e.Summary : null) ?? def.Summary;
    }

    public static string ManFor(CommandDef def, Shell sh)
    {
        if (sh.Lang == "sv") return def.Man ?? $"NAMN\n       {def.Name} - {def.Summary}";
        var man = def.ManEn ?? (ManEn.TryGetValue(def.Name, out var e) ? e.Man : null);
        return man ?? $"NAME\n       {def.Name} - {SummaryFor(def, sh)}";
    }
}
