namespace Codestead.Shell.Commands;

// English summaries and man pages for the process commands (procs.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
    private const string KillByNameOptions = """
        OPTIONS
               -9        send SIGKILL instead of SIGTERM
               -u USER   only processes owned by USER
        """;

    private static OrderedDictionary<string, (string Summary, string? Man)> ProcsPages => new()
    {
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
                   pkill myserver
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
                   pgrep myserver
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
    };
}
