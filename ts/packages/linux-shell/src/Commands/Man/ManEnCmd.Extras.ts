// Port of Commands/Man/ManEnCmd.Extras.cs – English summaries and man pages for the extra programs commands (extras.ts), one part of the ManEn table.
// The man page texts are byte for byte the same as in C# (and the TypeScript original).

import type { ManPage } from "./ManEnCmd.js";

export function extrasPages(): Map<string, ManPage> {
  return new Map<string, ManPage>([
    // ---------- Övriga program (extras.ts) ----------
    ["tree", { summary: "Shows directories as a tree", man: "NAME\n       tree - show the contents of directories as a tree\n\nSYNOPSIS\n       tree [-a] [-d] [-L LEVEL] [DIRECTORY]\n\nOPTIONS\n       -a         also show hidden files\n       -d         only show directories\n       -L LEVEL   descend at most LEVEL levels" }],
    ["htop", { summary: "Shows processes and resource usage", man: "NAME\n       htop - interactive process viewer\n\nDESCRIPTION\n       Shows CPU, memory and every running process. In a real terminal you\n       sort with F6, search with F3, kill processes with F9 and close htop\n       with q or F10. In the simulator a snapshot is shown." }],
    ["fastfetch", { summary: "Shows system information with the distro logo", man: "NAME\n       fastfetch - show system information together with the distribution's logo\n\nDESCRIPTION\n       A fast successor to neofetch. Popular in screenshots!" }],
    ["cowsay", { summary: "A cow that says something", man: "NAME\n       cowsay - a talking cow\n\nEXAMPLES\n       cowsay Hello!\n       fortune | cowsay" }],
    ["git", { summary: "Version control", man: "NAME\n       git - distributed version control\n\nDESCRIPTION\n       git will get its own chapter. So far the simulator only supports\n       \"git --version\"." }],
    ["curl", { summary: "Transfers data from or to a server", man: "NAME\n       curl - transfer data from or to a server\n\nDESCRIPTION\n       The simulator has no network, so curl cannot fetch anything." }],
    ["wget", { summary: "Downloads files from the web", man: "NAME\n       wget - download files from the web\n\nDESCRIPTION\n       The simulator has no network, so wget cannot fetch anything." }],
    ["python3", { summary: "The Python programming language", man: "NAME\n       python3 - interpreter for the Python programming language\n\nDESCRIPTION\n       The simulator supports \"python3 --version\". An interactive Python\n       mode is not available yet." }],
    ["vim", { summary: "Powerful text editor", man: "NAME\n       vim - Vi IMproved, a powerful text editor\n\nDESCRIPTION\n       vim has modes: press i to type, Esc to go back, :w to save\n       and :q to quit (:q! to quit without saving)." }],
    ["vi", { summary: "Text editor (usually vim in a simpler mode)", man: "NAME\n       vi - the classic Unix text editor\n\nDESCRIPTION\n       In most distributions vi starts a small version of vim. The same\n       keys apply: i to type, Esc, :w to save and :q to quit (:wq saves\n       and quits)." }],
    ["nano", { summary: "Simple text editor", man: "NAME\n       nano - a simple text editor\n\nDESCRIPTION\n       The commands are shown at the bottom: ^O means Ctrl+O (save) and ^X\n       means Ctrl+X (exit)." }],
    ["ssh", { summary: "Logs in securely to another computer", man: "NAME\n       ssh - log in to another computer via SSH (Secure Shell)\n\nSYNOPSIS\n       ssh USER@HOST\n\nDESCRIPTION\n       The simulator has no network, so ssh cannot connect anywhere." }],
  ]);
}
