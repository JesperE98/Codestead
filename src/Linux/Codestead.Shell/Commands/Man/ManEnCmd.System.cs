namespace Codestead.Shell.Commands;

// English summaries and man pages for the system and shell commands (system.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
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

    private static OrderedDictionary<string, (string Summary, string? Man)> SystemPages => new()
    {
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
    };
}
