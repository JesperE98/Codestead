// Port of Commands/Man/ManEnCmd.Procs.cs – English summaries and man pages for the process commands (procs.ts), one part of the ManEn table.
// The man page texts are byte for byte the same as in C# (and the TypeScript original).

import type { ManPage } from "./ManEnCmd.js";

const killByNameOptions = "OPTIONS\n       -9        send SIGKILL instead of SIGTERM\n       -u USER   only processes owned by USER";

export function procsPages(): Map<string, ManPage> {
  return new Map<string, ManPage>([
    // ---------- Processer (procs.ts) ----------
    ["ps", { summary: "Shows processes", man: "NAME\n       ps - show a snapshot of the processes\n\nSYNOPSIS\n       ps [OPTIONS]\n\nDESCRIPTION\n       Without options only the processes in your own terminal are shown.\n\nOPTIONS\n       aux              all processes, with user, CPU and memory (BSD style)\n       -ef              all processes with the parent's PID (PPID)\n       -u USER          only processes owned by USER\n       -p PID           only the process with PID\n       --sort=-%cpu     sort by CPU usage, largest first\n                        (also -%mem, pid, -pid)\n\nCOLUMNS\n       PID   the process's ID number\n       %CPU  how much of the processor the process uses\n       STAT  R = running, S = sleeping, s = session leader, + = in the foreground\n       TTY   the terminal the process belongs to (? = none)\n\nEXAMPLES\n       ps aux | grep sshd\n       ps aux --sort=-%cpu | head -5" }],
    ["top", { summary: "Shows the processes using the most resources", man: "NAME\n       top - show processes and resource usage, updated continuously\n\nDESCRIPTION\n       At the top you see the load average, the number of processes, CPU and\n       memory. Below that, all processes sorted by CPU usage.\n       In a real terminal top refreshes every second: press M to sort by\n       memory, k to kill a process and q to quit.\n       In the simulator a snapshot is shown.\n\nOPTIONS\n       -b -n 1   print once (handy in scripts)" }],
    ["kill", { summary: "Sends a signal to a process (ends it)", man: "NAME\n       kill - send a signal to a process\n\nSYNOPSIS\n       kill [-SIGNAL] PID...\n       kill %JOB\n       kill -l\n\nDESCRIPTION\n       By default SIGTERM (15) is sent, which asks the process to exit\n       cleanly. If it doesn't listen, you can send SIGKILL (9), which forces\n       it to stop at once – but then it gets no chance to clean up after itself.\n\n       You can only send signals to your own processes. For other users'\n       processes you need sudo.\n\nSIGNALS\n       1  HUP    reload the configuration (for many services)\n       2  INT    the same as Ctrl+C\n       9  KILL   force the process to exit\n       15 TERM   ask the process to exit (default)\n\nEXAMPLES\n       kill 3141\n       kill -9 3141\n       kill %1" }],
    ["killall", { summary: "Ends all processes with a given name", man: `NAME
       killall - end all processes with a given name

SYNOPSIS
       killall [-SIGNAL] NAME

${killByNameOptions}

EXAMPLES
       killall firefox` }],
    ["pkill", { summary: "Ends processes whose names match a pattern", man: `NAME
       pkill - end processes whose names match a pattern

SYNOPSIS
       pkill [-SIGNAL] PATTERN

${killByNameOptions}

EXAMPLES
       pkill myserver` }],
    ["pgrep", { summary: "Shows the PIDs of processes whose names match a pattern", man: "NAME\n       pgrep - show the PIDs of processes whose names match a pattern\n\nSYNOPSIS\n       pgrep [-SIGNAL] PATTERN\n\nOPTIONS\n       -l        also show the process name\n       -a        show the full command line\n       -u USER   only processes owned by USER\n\nEXAMPLES\n       pgrep myserver" }],
    ["jobs", { summary: "Shows the background jobs in this terminal", man: "NAME\n       jobs - show the jobs started from this terminal\n\nSYNOPSIS\n       jobs [-l]\n\nDESCRIPTION\n       A job is started in the background by putting & after the command,\n       e.g. \"sleep 300 &\". The jobs are numbered [1], [2] ... and can be\n       given as %1, %2 to kill, fg and bg.\n\nOPTIONS\n       -l    also show the PID" }],
    ["fg", { summary: "Moves a background job to the foreground", man: "NAME\n       fg - move a job to the foreground\n\nSYNOPSIS\n       fg [%JOB]\n\nDESCRIPTION\n       The job takes over the terminal until it is done. In a real terminal\n       you can send it back to the background with Ctrl+Z followed by bg." }],
    ["bg", { summary: "Resumes a stopped job in the background", man: "NAME\n       bg - let a stopped job continue in the background\n\nSYNOPSIS\n       bg [%JOB]\n\nDESCRIPTION\n       Used after a program has been stopped with Ctrl+Z." }],
    ["wait", { summary: "Waits until the background jobs are done", man: "NAME\n       wait - wait for background jobs to finish\n\nDESCRIPTION\n       Used in scripts that start several things in parallel with & and\n       then need to wait for them. In the simulator the jobs finish at once." }],
    ["uptime", { summary: "Shows how long the computer has been running, and the load", man: "NAME\n       uptime - show how long the system has been running\n\nDESCRIPTION\n       The load average is the average number of processes that want the\n       processor during the last 1, 5 and 15 minutes." }],
    ["free", { summary: "Shows how much memory is used", man: "NAME\n       free - show used and free memory\n\nOPTIONS\n       -h    human-readable units (Mi, Gi)\n       -m    in mebibytes" }],
  ]);
}
