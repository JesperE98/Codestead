# Prüfung: Distributionen und Pakete

Beantworte die Fragen unten. Zum Bestehen brauchst du 80 %.

```quiz
Welche Datei verrät dir auf allen modernen Distributionen den Namen und die
Version der Distribution?
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
`uname -r` zeigt die Version des Linux-Kernels.
```

```quiz
Welcher Paketmanager und welches Paketformat gehören zusammen?
- [x] `pacman` und `.pkg.tar.zst`
- [ ] `dnf` und `.deb`
- [ ] `apt` und `.rpm`
```

```quiz
Welche Distribution ist ein *Rolling Release* ohne Versionen?
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
Was ist der Unterschied zwischen `apt update` und `apt upgrade`?
- [x] `update` lädt die Liste der verfügbaren Pakete herunter, `upgrade` installiert neue Versionen
- [ ] `update` installiert neue Versionen, `upgrade` lädt die Liste herunter
- [ ] Es gibt keinen Unterschied
```

```quiz
Welcher Befehl installiert das Paket `htop` unter Arch?
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
Warum ist es eine schlechte Idee, `pacman -Sy` und danach `pacman -S package` auszuführen?
- [ ] Es installiert das Paket zweimal
- [x] Es ist ein Partial Upgrade, das das System kaputtmachen kann
- [ ] `-Sy` entfernt alle installierten Pakete
```

```quiz
dnf fragt `Is this ok [y/N]`, und du drückst einfach Enter. Was passiert?
- [ ] Das Paket wird installiert
- [x] Nichts wird installiert – Nein ist die Vorgabe
```

```quiz
Was davon stimmt über das AUR?
- [x] Es enthält Baurezepte (`PKGBUILD`), keine fertigen Pakete
- [x] Seine Pakete werden nicht von Arch geprüft
- [ ] `sudo pacman -Syu` aktualisiert AUR-Pakete
- [ ] `makepkg` sollte mit sudo ausgeführt werden
```

```quiz
Welcher Befehl fügt unter Fedora ein COPR-Repository hinzu?
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` und `makepkg -si`
```

```quiz
Wie werden Snap-Pakete aktualisiert?
- [ ] Mit `flatpak update`
- [x] Automatisch im Hintergrund
- [ ] Indem man eine neue Datei von der Website des Entwicklers herunterlädt
```

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
Eine heruntergeladene Datei ist anfangs nie ausführbar. Führe zuerst
`chmod +x ~/{{downloads}}/{{calculator}}` aus.
```

```quiz
Du willst eine neuere Version eines Desktop-Programms, das in den
Repositorys der Distribution fehlt. Was empfiehlt die Faustregel zuerst?
- [ ] Ein zusätzliches Repository von jemandem, den du nicht kennst
- [x] Ein Flatpak
- [ ] Das Programm als root aus dem Quellcode bauen
```
