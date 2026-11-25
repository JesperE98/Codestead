# Project: The report robot

Remember the day the server acted up? Your boss loved your report – a little too
much. "Brilliant. I want one of those on my desk every morning. Every weekday.
Before seven." You have no intention of getting up at six to type `grep` commands.
Luckily you don't have to: you can write scripts now. Time to build a robot that
does the job for you.

The robot reads the log `~/{{documents}}/server.log` and writes a short report:
how many lines there are of each level, and which errors occurred. Everything it
needs is in *Scripts and automation* – the challenge is putting it together
yourself.

## The assignment

1. **Build the robot.** Create the script `~/{{robotScript}}` with a shebang line
   and a line that prints a heading. Make it executable and run it.
2. **Teach it to ask for the log.** The robot gets the log file as its first
   argument. Run without an argument, it should explain how it is used and stop
   with an exit code other than 0.
3. **… and to complain about missing files.** If the file in the argument doesn't
   exist, the robot says so and stops with an exit code other than 0. Try it with
   a file name that doesn't exist.
4. **Count the levels.** Run on `~/{{documents}}/server.log`, the robot prints how
   many lines the log has of each level, counted with `awk`. Careful: `WARN` and
   `warn` are the same level!
5. **List the errors.** Below the numbers, the report lists every error with its
   time and message – but **without** the date, which is the same on every line
   anyway. Remove it with `sed`.
6. **Hire the robot.** Schedule it with cron: it runs on the server log at 06:30
   Monday to Friday, and its output is added to `~/{{robotLog}}`. Keep your old
   jobs.
7. **Dress rehearsal.** Run the job's command by hand once, so that today's report
   ends up in `~/{{robotLog}}`, and have a look at the file.

The milestones in the list next to this text are checked automatically as you run
your commands.

## Tips along the way

- Build the robot one piece at a time and run it after every change. The easiest
  way is to write the whole script again with the here document – it replaces the
  old version.
- Try each line on the command line first, with the log's path in place of `"$1"`.
  When it works there, put it in the script.
- `echo $?` right after the robot shows the exit code it stopped with.
- `awk`'s `toupper()` turns `warn` into `WARN`, and `sort | uniq -c` counts lines
  that are the same.
- Each line of the log starts with the date and a space – `sed`'s `s` command can
  replace that part with nothing.
- Jobs in cron don't run in your terminal: use full paths such as
  `~/{{robotScript}}`, and send the output to a file. With `>>` every morning's
  report is added to the end instead of replacing yesterday's.

## Want to do more?

Once the milestones are done, the robot can learn more tricks. Put the date in the
heading with `$(date)`. Make each part of the report a function of its own. Let
the robot take several logs at once with `for file in "$@"`, or count how many
requests got the answer `404`. And if the app is still open at 06:30 on a weekday,
`journalctl -u cron` shows that the robot really went to work.
