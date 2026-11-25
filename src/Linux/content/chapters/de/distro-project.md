# Projekt: Der gebrauchte Laptop

Dein Freund Alex hat einen gebrauchten Laptop gekauft und dich – nach ein
bisschen Überredung – {{distro}} darauf installieren lassen. Die Installation hat
geklappt. Jetzt hat Alex eine Wunschliste geschickt:

> 1. Bitte aktuell. Ich will keinen Computer voller Sicherheitslücken.
> 2. Nächste Woche fange ich einen Kurs in der Programmiersprache Go an.
> 3. Irgendwas, das zeigt, was den Computer so langsam macht.
> 4. Einen richtigen Editor. Alle sagen Vim.
> 5. Filme! Er muss Filme abspielen können.

Alles, was du brauchst, kennst du aus *Distributionen und Pakete*. Nichts davon
ist neu; die Herausforderung ist, selbst die richtigen Befehle für den
Paketmanager zu finden – und die richtigen Paketnamen.

## Der Auftrag

1. **Bring den Computer auf den neuesten Stand.** Hol die neuesten Paketlisten
   und aktualisiere alle installierten Pakete.
2. **Finde Go.** Durchsuche die Paketlisten und finde heraus, wie das Paket mit
   der Programmiersprache Go in deiner Distribution heißt. Es heißt nicht überall
   gleich!
3. **Installiere die Wunschliste.** Den Prozessbetrachter `htop`, die
   Programmiersprache Go und den Texteditor Vim.
4. **Prüf nach.** Such Go in der Liste der *installierten* Pakete.
5. **Entferne Vim.** Alex hat Vim ausprobiert und den Ausgang nicht mehr
   gefunden. „Weg damit!“ Deinstalliere Vim wieder.
6. **Filme.** Installiere den Medienplayer VLC (`org.videolan.VLC`) als Flatpak
   von Flathub.
7. **Probelauf.** Bevor du den Laptop zurückgibst: Lass Go seine Version
   anzeigen, damit Alex sieht, dass der Kurs beginnen kann.

Die Etappen in der Liste neben diesem Text werden automatisch geprüft, während du deine
Befehle ausführst. Sie zählen pro Familie – mach das Projekt noch einmal auf einer
Distribution aus einer anderen Familie, und du lernst einen neuen Dialekt kennen.

## Tipps für unterwegs

:::debian
- Unter {{distro}} heißt der Paketmanager `apt`. Befehle, die das System ändern,
  laufen mit `sudo`, und `apt update` holt nur die Listen – `apt upgrade`
  installiert die neuen Versionen.
:::
:::arch
- Unter {{distro}} heißt der Paketmanager `pacman`. Der Großbuchstabe ist die
  Operation (`-S`, `-R`, `-Q`), und die Kleinbuchstaben sind Zusätze.
  Aktualisiere immer mit `-Syu`.
:::
:::redhat
- Unter {{distro}} heißt der Paketmanager `dnf`. Denk daran, dass `[y/N]`
  bedeutet, dass Enter mit **Nein** antwortet.
:::
- Eine Suche schaut in Namen und Beschreibungen. Wird das Ergebnis lang, hilft
  eine genauere Suche – oder `grep`.
- Paketnamen sind meistens überall gleich, aber nicht immer. Wenn du unsicher
  bist: Such danach.
- Fehlt Flatpak, oder kennt es Flathub nicht? Installiere das Paket `flatpak`
  und füge Flathub mit `flatpak remote-add` hinzu, so wie im Kapitel über
  universelle Pakete.

## Lust auf mehr?

Wenn die Etappen geschafft sind, hat Alex natürlich noch mehr Wünsche. Starte
`htop` und schau, was läuft. Sieh dir die Informationen zum Go-Paket an und finde
heraus, wie groß es ist. Frag Flatpak, welche Berechtigungen VLC hat. Und falls
sich herausstellt, dass Alex das Terminal doch liebt: Installiere Vim wieder.
