# Prov: Distributioner och paket

Svara på frågorna nedan. Du behöver 80 % för godkänt.

```quiz
Vilken fil berättar namn och version på distributionen i alla moderna
distributioner?
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
`uname -r` visar versionen av Linuxkärnan.
```

```quiz
Vilken pakethanterare och vilket paketformat hör ihop?
- [x] `pacman` och `.pkg.tar.zst`
- [ ] `dnf` och `.deb`
- [ ] `apt` och `.rpm`
```

```quiz
Vilken distribution är en *rullande utgåva* (rolling release) utan versioner?
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
Vad är skillnaden mellan `apt update` och `apt upgrade`?
- [x] `update` laddar ner listan över tillgängliga paket, `upgrade` installerar nya versioner
- [ ] `update` installerar nya versioner, `upgrade` laddar ner listan
- [ ] Det är ingen skillnad
```

```quiz
Vilket kommando installerar paketet `htop` i Arch?
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
Varför är det en dålig idé att köra `pacman -Sy` och sedan `pacman -S paket`?
- [ ] Paketet installeras två gånger
- [x] Det är en delvis uppgradering som kan förstöra systemet
- [ ] `-Sy` tar bort alla installerade paket
```

```quiz
dnf frågar `Is this ok [y/N]` och du trycker bara Enter. Vad händer?
- [ ] Paketet installeras
- [x] Ingenting installeras – nej är standard
```

```quiz
Vilka av de här påståendena om AUR stämmer?
- [x] Det innehåller byggrecept (`PKGBUILD`), inte färdiga paket
- [x] Paketen granskas inte av Arch
- [ ] `sudo pacman -Syu` uppdaterar AUR-paket
- [ ] `makepkg` ska köras med sudo
```

```quiz
Vilket kommando lägger till ett COPR-förråd i Fedora?
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` och `makepkg -si`
```

```quiz
Hur uppdateras Snap-paket?
- [ ] Med `flatpak update`
- [x] Automatiskt i bakgrunden
- [ ] Genom att ladda ner en ny fil från utvecklarens webbplats
```

```predict
$ ~/Nedladdningar/Kalkylator.AppImage
bash: /home/elev/Nedladdningar/Kalkylator.AppImage: Permission denied
---
En nedladdad fil är aldrig körbar från början. Kör
`chmod +x ~/Nedladdningar/Kalkylator.AppImage` först.
```

```quiz
Du vill ha en nyare version av ett skrivbordsprogram som saknas i
distributionens förråd. Vad rekommenderar tumregeln först?
- [ ] Ett extra förråd från någon du inte känner
- [x] En Flatpak
- [ ] Att bygga programmet från källkoden som root
```
