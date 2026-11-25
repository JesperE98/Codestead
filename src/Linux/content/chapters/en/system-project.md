# Project: The clubhouse

You and a couple of friends have started a secret club. The club has a name, a
handshake and a password – but no clubhouse. Your computer has plenty of room,
though. The rules are simple: only members get in, you knock on the door with a
script, there is a hidden entrance, someone keeps watch at night, and there is
always a backup in case the clubhouse is ever raided.

You have everything you need from *The system*: permissions, variables, links,
processes and archives. Nothing here is new; the challenge is putting the
pieces together yourself.

## The assignment

1. **Build the clubhouse.** Create the directory `~/{{clubDir}}`. Only you may
   read, write and enter it – the group and others get nothing (`rwx------`).
2. **Hire a doorkeeper.** Write the script `~/{{clubDir}}/{{knockScript}}`, which
   prints the club's password with `echo`. Make it executable and run it.
3. **Mark the way.** Create the environment variable `{{clubVar}}` with the full
   path to the clubhouse, so that `cd ${{clubVar}}` takes you there.
4. **Hide a secret entrance.** Create a symbolic link
   `~/{{documents}}/{{wardrobe}}` that leads straight into the clubhouse. Nobody
   looks for a clubhouse at the back of a wardrobe.
5. **Post a night watch.** Run `sleep 3600` in the background, so that it keeps
   watch for an hour – and keeps going even if you log out. (A night watch
   that does nothing but sleep: very true to life.)
6. **Make a backup.** Pack the whole clubhouse into the compressed archive
   `~/{{clubBackup}}`.
7. **Send the night watch home.** Morning has come – end the process.

The milestones in the list next to this text are checked automatically as you run
your commands.

## Tips along the way

- `ls -ld ~/{{clubDir}}` shows the permissions of the directory itself instead of
  its contents. r = 4, w = 2 and x = 1.
- The doorkeeper only needs one line. Put single quotes around it, so that it
  ends up in the file exactly as you wrote it. A script in the directory you
  are in is run with `./` in front of its name.
- No spaces around `=` when you create a variable, and remember `export` – or
  it stays a plain shell variable. Check with `echo ${{clubVar}}`.
- `ln -s` takes the target first and the name of the link second. Then try
  `cd ~/{{documents}}/{{wardrobe}}` and see where you end up.
- `jobs` shows your background jobs with their numbers, and `ps` shows their
  PIDs.
- Pack from your home directory, so that the paths in the archive start with
  `{{clubDir}}/`. `tar -tzf` shows what ended up in it.

## Want to do more?

Once the milestones are done, the club can grow. Make an alias that takes you
to the clubhouse in one word. Put a members list in the clubhouse and a hard
link to it in your home directory. Unpack the backup in a new directory and
check that the doorkeeper still knows the password. And what happens to the
secret entrance if the clubhouse is moved?
