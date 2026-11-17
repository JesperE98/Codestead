// Port of Commands/Man/ManEnCmd.System.cs – English summaries and man pages for the system and shell commands (system.ts), one part of the ManEn table.
// The man page texts are byte for byte the same as in C# (and the TypeScript original).

import type { ManPage } from "./ManEnCmd.js";

const exitMan = "NAME\n       exit - exit the shell\n\nDESCRIPTION\n       If you became root with \"sudo -i\", exit takes you back to your\n       ordinary user.";

const bashMan = "NAME\n       bash - GNU Bourne-Again SHell\n\nSYNOPSIS\n       bash SCRIPT [ARGUMENT]...\n       bash -c 'COMMAND'\n\nDESCRIPTION\n       bash is the shell you type your commands in. \"bash script.sh\" runs a\n       script without it having to be executable (chmod +x).";

const sourceMan = "NAME\n       source - read and run commands from a file in the current shell\n\nDESCRIPTION\n       Unlike running a script, source affects your shell: aliases,\n       variables and cd stay in effect afterwards. Often used like this:\n           source ~/.bashrc\n       A dot (.) is a shorter form: . ~/.bashrc";

const envDescription = "DESCRIPTION\n       Environment variables are named values that programs can read, e.g.\n       HOME (your home directory), PATH (where commands are looked up) and USER.";

export function systemPages(): Map<string, ManPage> {
  return new Map<string, ManPage>([
    // ---------- System (system.ts) ----------
    ["whoami", { summary: "Shows which user you are", man: "NAME\n       whoami - print your user name\n\nDESCRIPTION\n       Shows the name of the user running the command. Try \"sudo whoami\"!" }],
    ["id", { summary: "Shows user and group IDs", man: "NAME\n       id - show user ID (uid), group ID (gid) and groups\n\nSYNOPSIS\n       id [USER]" }],
    ["groups", { summary: "Shows which groups you belong to", man: "NAME\n       groups - show which groups a user belongs to\n\nDESCRIPTION\n       Members of the group sudo (Debian/Ubuntu) or wheel (Arch/Fedora)\n       may use sudo." }],
    ["hostname", { summary: "Shows the computer's name", man: "NAME\n       hostname - show the system's host name\n\nDESCRIPTION\n       The name is also stored in the file /etc/hostname." }],
    ["uname", { summary: "Shows information about the system and the kernel", man: "NAME\n       uname - show system information\n\nOPTIONS\n       -a    everything\n       -r    the kernel version (kernel release)\n       -n    the host name\n       -m    hardware architecture (e.g. x86_64)" }],
    ["date", { summary: "Shows the date and time", man: "NAME\n       date - show the date and time" }],
    ["env", { summary: "Shows environment variables", man: "NAME\n       env - show environment variables\n\nSYNOPSIS\n       env\n\nDESCRIPTION\n       Environment variables are named values that programs can read, e.g.\n       HOME (your home directory), PATH (where commands are looked up) and USER." }],
    ["printenv", { summary: "Shows environment variables", man: "NAME\n       printenv - show environment variables\n\nSYNOPSIS\n       printenv [VARIABLE]...\n\nDESCRIPTION\n       Environment variables are named values that programs can read, e.g.\n       HOME (your home directory), PATH (where commands are looked up) and USER." }],
    ["export", { summary: "Sets an environment variable", man: "NAME\n       export - make a variable available to programs that are started\n\nSYNOPSIS\n       export NAME=VALUE\n\nEXAMPLES\n       export EDITOR=nano\n       export PATH=\"$HOME/bin:$PATH\"\n\nDESCRIPTION\n       Variables set with export only apply to the current session. Put\n       the line in ~/.bashrc if it should apply every time you open a terminal." }],
    ["unset", { summary: "Removes a variable or function", man: "NAME\n       unset - remove a variable or function\n\nSYNOPSIS\n       unset NAME...\n       unset -f FUNCTION..." }],
    ["alias", { summary: "Creates a shortcut for a command", man: "NAME\n       alias - create command shortcuts\n\nSYNOPSIS\n       alias NAME='COMMAND'\n       alias\n\nEXAMPLES\n       alias ll='ls -la'\n       alias ..='cd ..'\n\nDESCRIPTION\n       Without arguments all aliases are listed. Put aliases in ~/.bashrc\n       to keep them permanently." }],
    ["unalias", { summary: "Removes an alias", man: null }],
    ["history", { summary: "Shows previous commands", man: "NAME\n       history - show the command history\n\nDESCRIPTION\n       Use arrow up/down to browse through previous commands.\n\nOPTIONS\n       -c    clear the history" }],
    ["type", { summary: "Shows what a command name is (alias, builtin, file)", man: "NAME\n       type - show how a command name is interpreted\n\nEXAMPLES\n       type cd      cd is a shell builtin\n       type ls      ls is /usr/bin/ls" }],
    ["which", { summary: "Shows where a command is located", man: "NAME\n       which - show the full path of a command\n\nDESCRIPTION\n       Searches the directories in $PATH. Shell builtins (like cd) are not\n       files and are therefore not found – use \"type\" for those.\n\nEXAMPLES\n       which ls" }],
    ["man", { summary: "Shows the manual for a command", man: "NAME\n       man - show manual pages\n\nSYNOPSIS\n       man COMMAND\n\nDESCRIPTION\n       Almost every command has a manual page. It is the first place to\n       look when you wonder what an option does. In the simulator the\n       manuals are simplified." }],
    ["help", { summary: "Lists all available commands", man: "NAME\n       help - list the commands in the simulator" }],
    ["clear", { summary: "Clears the screen", man: "NAME\n       clear - clear the terminal window\n\nTIPS\n       The shortcut Ctrl+L does the same thing." }],
    ["exit", { summary: "Exits the shell (or leaves the root shell)", man: exitMan }],
    ["logout", { summary: "Logs out of a login shell", man: exitMan }],
    ["sudo", { summary: "Runs a command as root (administrator)", man: "NAME\n       sudo - run a command as another user (usually root)\n\nSYNOPSIS\n       sudo COMMAND [ARGUMENT]...\n       sudo -i\n\nDESCRIPTION\n       root is the system administrator and may do anything. Ordinary users\n       who belong to the group sudo (Debian/Ubuntu) or wheel (Arch/Fedora)\n       can run single commands as root by putting sudo in front of them.\n       You then enter your own password.\n\n       sudo -i    start a root shell (leave it with exit)\n\nEXAMPLES\n       sudo apt update\n       sudo cat /etc/shadow\n\nWARNING\n       With sudo there is no safety net. Only run commands you understand." }],
    ["su", { summary: "Switches user", man: "NAME\n       su - switch user (substitute user)\n\nDESCRIPTION\n       \"su -\" logs in as root, but requires the root password. On Ubuntu the\n       root account is locked, so \"sudo -i\" is used there instead." }],
    ["bash", { summary: "Runs a script in a new bash shell", man: bashMan }],
    ["sh", { summary: "Runs a script in a new bash shell", man: bashMan }],
    ["source", { summary: "Runs a script in the current shell", man: sourceMan }],
    [".", { summary: "Runs a script in the current shell", man: sourceMan }],
    ["true", { summary: "Does nothing, always succeeds", man: null }],
    ["false", { summary: "Does nothing, always fails", man: null }],
    ["sleep", { summary: "Waits for a while", man: "NAME\n       sleep - wait for a number of seconds\n\nDESCRIPTION\n       In the simulator sleep returns immediately." }],
    ["seq", { summary: "Prints a sequence of numbers", man: "NAME\n       seq - print a sequence of numbers\n\nSYNOPSIS\n       seq LAST\n       seq FIRST LAST\n       seq FIRST STEP LAST" }],
    ["basename", { summary: "Strips the directory part from a path", man: null }],
    ["dirname", { summary: "Strips the file name from a path", man: null }],
  ]);
}
