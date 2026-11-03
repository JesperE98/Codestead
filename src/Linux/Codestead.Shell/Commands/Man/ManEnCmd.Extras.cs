namespace Codestead.Shell.Commands;

// English summaries and man pages for the extra programs commands (extras.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
    private static OrderedDictionary<string, (string Summary, string? Man)> ExtrasPages => new()
    {
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
        ["vi"] = ("Text editor (usually vim in a simpler mode)", """
            NAME
                   vi - the classic Unix text editor

            DESCRIPTION
                   In most distributions vi starts a small version of vim. The same
                   keys apply: i to type, Esc, :w to save and :q to quit (:wq saves
                   and quits).
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
    };
}
