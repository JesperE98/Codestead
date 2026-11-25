# Project: The second-hand laptop

Your friend Alex has bought a second-hand laptop and – after a bit of
persuading – let you install {{distro}} on it. The installation went fine. Now
Alex has sent a wish list:

> 1. Up to date, please. I don't want a computer that's full of holes.
> 2. I'm starting a course in the Go programming language next week.
> 3. Something that shows what is slowing the computer down.
> 4. A proper editor. Everybody says Vim.
> 5. Films! It has to be able to play films.

You have everything you need from *Distributions and packages*. Nothing here is
new; the challenge is finding the right package manager commands – and the right
package names – on your own.

## The assignment

1. **Bring the computer up to date.** Fetch the latest package lists and
   upgrade all the installed packages.
2. **Find Go.** Search the package lists to find out what the package with the
   Go programming language is called in your distribution. It's not the same
   everywhere!
3. **Install the wish list.** The process viewer `htop`, the Go programming
   language and the text editor Vim.
4. **Double-check.** Look up Go in the list of *installed* packages.
5. **Remove Vim.** Alex tried Vim and couldn't find the way out. "Get rid of
   it!" Uninstall Vim again.
6. **Films.** Install the media player VLC (`org.videolan.VLC`) as a Flatpak
   from Flathub.
7. **Test run.** Before you hand the laptop back: let Go show its version, so
   Alex can see that the course can begin.

The milestones in the list next to this text are checked automatically as you run
your commands. They're counted per family – try the project again on a
distribution from another family and you'll get to know a new dialect.

## Tips along the way

:::debian
- On {{distro}} the package manager is `apt`. Commands that change the system
  are run with `sudo`, and `apt update` only fetches the lists – `apt upgrade`
  installs the new versions.
:::
:::arch
- On {{distro}} the package manager is `pacman`. The capital letter is the
  operation (`-S`, `-R`, `-Q`) and the lowercase letters are modifiers. Always
  upgrade with `-Syu`.
:::
:::redhat
- On {{distro}} the package manager is `dnf`. Remember that `[y/N]` means that
  Enter answers **no**.
:::
- A search looks at both names and descriptions. If the result is long, a more
  precise search helps – or `grep`.
- Package names are usually the same everywhere, but not always. When you're
  unsure: search.
- Is Flatpak missing, or doesn't it know about Flathub? Install the package
  `flatpak` and add Flathub with `flatpak remote-add`, the way you did in the
  chapter on universal packages.

## Want to do more?

Once the milestones are done, Alex will have more wishes, of course. Start
`htop` and see what's running. Look at the information about the Go package and
find out how big it is. Ask Flatpak which permissions VLC has. And if Alex turns
out to love the terminal after all: install Vim again.
