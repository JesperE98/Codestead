# Project: The website is down!

Friday, 16:47. Your phone rings. It's the boss, out of breath: "The website is
down! The customers can't see our opening hours, and the same customer has
called three times already!"

The company's website is the little web server `myserver` on port 8080 – on
*your* computer. Yes, really. Someone put it there "temporarily" years ago, and
nobody has dared to move it since.

Is it the network? The web server? Or the boss's laptop? Find out from the inside
out, write everything down in an incident log – and make sure the next time is
easier. Everything you need is in *Networking*; the challenge is putting the
pieces together yourself.

## The assignment

1. **Start the log.** Create the folder `~/{{incidentDir}}` with the incident log
   `{{incidentLog}}`, and put the computer's IP address and the address of the
   gateway in it.
2. **The way out.** Show that the network works all the way out to the internet,
   name lookups included: add a ping with three packets to a name on the internet
   to the log.
3. **Is anyone listening?** Find out whether anything is listening on port 8080.
   If nothing is, start the web server and check again.
4. **Does the site answer?** Add the response headers of the front page,
   `http://localhost:8080`, to the log. The status code should be 200.
5. **A key for the server.** Next time you want to get into the server
   `server.lan` without a password. Create a key pair and put the public key on
   the server.
6. **Back it up.** Copy the whole folder `~/{{incidentDir}}` to your home directory
   on the server, so that the log survives even if your own computer gives up.
7. **Read it from afar.** Show the log that is on the server with `ssh` – without
   anyone asking for a password.

The milestones in the list next to this text are checked automatically as you run
your commands.

## Tips along the way

- `>` creates (or overwrites) a file and `>>` adds to its end: start the log with
  `>` and then stick to `>>`.
- Work from the inside out: address, route, router, the internet, and last a
  name. Without `-c`, `ping` keeps going until you stop it.
- `ss -tulpn` shows the listening ports. The *Process* column is empty for
  processes other users own – the port is what matters here.
- On Ubuntu `curl` is not preinstalled: `sudo apt update` and
  `sudo apt install curl`. `-I` fetches only the headers.
- The short name `srv` from `~/.ssh/config` works everywhere – so do
  `{{user}}@server.lan` and `{{user}}@192.168.1.10`.
- `rsync -av SOURCE/ srv:TARGET/` – the slash after the source means "what is in
  the directory".
- Does `ssh` still ask for a password? Then the key is not on the server yet.

## Want to do more?

Once the milestones are done, you can keep going. Turn off the network card with
`sudo ip link set enp0s3 down`, see where the ladder from the inside out breaks,
and turn it on again with `up`. Fetch the site's page `/about.html` with `curl`.
Add a line to the log and run the same `rsync -av` again – only the change is
sent. And call the boss back. (Rumour has it the laptop was in flight mode.)
