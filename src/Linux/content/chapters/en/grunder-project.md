# Project: The log detective

It's 7:45 in the morning and your boss is standing at your desk with a cup of coffee.
"The server was acting up yesterday. Nobody knows why, and customers have started
calling. Can you find out what happened and write a short report before lunch?"

Everything you need is in the log file `~/{{documents}}/server.log` – and in the
commands you learnt in *The basics*. Nothing here is new; the challenge is putting
the pieces together yourself.

## The assignment

1. **Open a case.** Create the folder `~/{{caseDir}}` with the subfolder
   `{{evidence}}`. All the evidence and the report go there.
2. **Secure the evidence.** Copy the log to `{{evidence}}`. Then work on the
   copy – the original must stay untouched.
3. **Pick out the errors.** Save every line with `ERROR` in a file of its own,
   `~/{{caseDir}}/{{errorsFile}}`.
4. **Write the report.** The report `~/{{caseDir}}/{{caseReport}}` is built up one line
   at a time:
   - first the **number of warnings** – lines with `WARN`, whether it is written in
     upper or lower case,
   - then **the first error line**, so it shows when the trouble started,
   - last the **times** of all the errors, one per line, the latest first.
5. **Close the case.** Show the whole report and check that everything is there.

The milestones in the list next to this text are checked automatically as you run
your commands.

## Tips along the way

- Have a look at the log first with `cat` or `less`, so you know what the lines look like.
- Remember the difference between `>` and `>>`: one overwrites the file, the other
  adds to the end. Overwrote the report by mistake? No problem – start again from
  the number of warnings.
- A pipe (`|`) passes the output of one command on to the next. Several milestones
  get short if you connect two or three commands.
- Each line of the log is made of fields separated by spaces: date, time, level and
  message.

## Want to do more?

Once the milestones are done, you can keep investigating on your own. Which page
gave the `404` error? How many lines have the level `INFO`? Add what you find to the
report – a real detective leaves no loose ends.
