# Flatpak, Snap och AppImage

Ett vanligt paket är byggt för en viss distribution och version. För den som
gör ett skrivbordsprogram är det ett problem: samma program måste paketeras om
för Debian, Ubuntu, Fedora, Arch och alla deras versioner. **Universella
paketformat** löser det genom att ta med det mesta programmet behöver i
paketet – då fungerar ett och samma paket i alla distributioner.

De tre stora är **Flatpak**, **Snap** och **AppImage**. De ersätter inte
distributionens pakethanterare utan kompletterar den, främst för
skrivbordsprogram.

> Simulatorn har bara en terminal. När du startar ett grafiskt program får du
> i stället en rad om att det skulle ha öppnats i ett fönster.

## Fyra sätt att installera ett program

| | Distributionens paket | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| Kommer från | Distributionens förråd | Flathub (eller andra *remotes*) | Snap Store (Canonical) | Utvecklarens webbplats |
| Fungerar i | En distribution och version | Alla | Alla som har `snapd` | Alla (behöver FUSE) |
| Sandlåda | Nej | Ja | Ja (utom *classic*) | Nej |
| Storlek | Liten – delar bibliotek med systemet | Stor första gången (runtimes), sedan delas de | Stor – varje snap och dess bas | Stor – allt i en fil |
| Uppdateringar | Med systemet (`apt upgrade` …) | `flatpak update` | Automatiskt i bakgrunden | Själv – ladda ner en ny fil |
| Passar för | Systemprogram, kommandoradsverktyg, servrar | Skrivbordsprogram | Ubuntu, skrivbord och servrar | Enstaka program, testa nya versioner |

En **sandlåda** betyder att programmet bara kommer åt det det fått lov till,
till exempel nätverket eller din nedladdningsmapp, i stället för hela din
hemkatalog.

## Flatpak

Flatpak är det format som de flesta distributioner har enats om för
skrivbordsprogram. Programmen hämtas från en **remote** – nästan alltid
**Flathub** – och delar på gemensamma **runtimes** (till exempel
`org.gnome.Platform`) så att inte varje program behöver ha med allt.

:::debian
### Installera Flatpak

Flatpak är inte förinstallerat i {{distro}}:

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### Installera Flatpak

Flatpak finns i Archs förråd:

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### Flatpak i {{distro}}

Fedora Workstation har Flatpak från början, med Fedoras egen källa `fedora`
redan tillagd:

```sh
flatpak --version
flatpak remotes
```
:::

### Lägg till Flathub

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` gör att kommandot inte ger fel om Flathub redan finns – bra
i skript och installationsguider.

### Sök, installera och kör

Varje program har ett **id** skrivet som ett omvänt domännamn, till exempel
`org.gimp.GIMP`:

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

Flatpak visar vilka **behörigheter** programmet vill ha och vilka runtimes som
följer med. Lägg märke till storleken: första programmet drar med sig en
runtime på flera hundra megabyte, men nästa program som använder samma
runtime blir litet.

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### För hela systemet eller bara för dig

Utan flaggor installerar Flatpak för **hela systemet** (i `/var/lib/flatpak`).
På ett skrivbord frågar Flatpak efter ditt lösenord i ett fönster, så sudo
behövs inte. Med `--user` hamnar programmet i stället i din hemkatalog
(`~/.local/share/flatpak`) och ingen annan användare ser det. Den egna
installationen har **egna remotes**, så Flathub måste läggas till med
`--user` också:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

### Uppdatera och ta bort

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` tar bort runtimes som inget installerat program längre använder.

## Snap

Snap är **Canonicals** format och standard i Ubuntu – där är till exempel
Firefox en snap. Snaps hämtas från **Snap Store**, som drivs av Canonical, och
hanteras av tjänsten `snapd`. De uppdateras automatiskt i bakgrunden.

:::debian
### Snap i Ubuntu och Debian

I Ubuntu finns Snap redan. I Debian installerar du `snapd` först:

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Snap i Arch

Snap finns inte i Archs förråd – bara i AUR. Bygg det som i förra kapitlet:

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

På riktigt behöver du också starta tjänsten med
`sudo systemctl enable --now snapd.socket`. Det är ett tecken på att Snap inte
är hemma i Arch: där använder de flesta Flatpak.
:::

:::redhat
### Snap i Fedora

Fedora satsar på Flatpak, men Snap finns i förråden:

```sh
sudo dnf install snapd
```
:::

### Använda snap

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

Installerade snaps visas som program i `/snap/bin`. Att installera och ta bort
kräver root.

### Strikt eller classic

De flesta snaps körs **strikt** i en sandlåda. Program som behöver komma åt
hela systemet, som kodeditorer, publiceras med **classic confinement**. Då
måste du själv godkänna det med `--classic`:

```sh
sudo snap install code
sudo snap install code --classic
```

### Kanaler och uppdateringar

Varje snap har **kanaler**: `stable`, `candidate`, `beta` och `edge` (den
senaste, oprövade versionen). `snap info` visar dem och `--channel=beta` väljer
en annan. Uppdateringar sker automatiskt, men du kan tvinga fram dem och ta
bort snaps:

```sh
sudo snap refresh
sudo snap remove hello-world
```

Snap har också kritiker: Snap Store drivs bara av Canonical, de automatiska
uppdateringarna går inte att stänga av helt och program kan starta
långsammare första gången.

## AppImage

En **AppImage** är ett helt program i **en enda fil**. Du laddar ner den från
programmets webbplats, gör den körbar och startar den – ingen installation och
inget root. Vill du bli av med programmet tar du bort filen.

Det ligger redan en nedladdad AppImage i din hemkatalog:

```sh
cd ~/Nedladdningar
ls -l
```

Nedladdade filer är aldrig körbara från början. Gör den körbar och starta den:

```sh
chmod +x Kalkylator.AppImage
./Kalkylator.AppImage
```

### FUSE

En AppImage monterar sig själv som ett filsystem med hjälp av **FUSE**, och
behöver den äldre versionen 2 av biblioteket (`libfuse.so.2`). Saknas det får
du felet *"AppImages require FUSE to run"*.

:::debian
I Ubuntu 24.04 och Debian 13 heter paketet `libfuse2t64` (*t64* kommer från
övergången till 64-bitars tid; i äldre versioner hette det `libfuse2`):

```sh
sudo apt update
sudo apt install libfuse2t64
./Kalkylator.AppImage
```

> Installera **inte** paketet `fuse` i Ubuntu – det ersätter `fuse3`, som
> skrivbordet behöver.
:::

:::arch
I Arch heter paketet `fuse2`:

```sh
sudo pacman -S fuse2
./Kalkylator.AppImage
```
:::

:::redhat
I Fedora heter paketet `fuse-libs`:

```sh
sudo dnf install fuse-libs
./Kalkylator.AppImage
```
:::

### Titta inuti

En AppImage kan också packas upp. Det fungerar även utan FUSE:

```sh
./Kalkylator.AppImage --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` packar upp tillfälligt och startar direkt.

### Tänk på

- AppImage har **ingen sandlåda** – programmet kör som du och kommer åt allt
  du kommer åt. Ladda bara ner från programmets officiella webbplats.
- Det finns **inga automatiska uppdateringar**. Du laddar ner en ny fil när det
  kommer en ny version (vissa program kan uppdatera sig själva).
- Programmet hamnar inte automatiskt i programmenyn. Verktyg som *Gear Lever*
  eller *AppImageLauncher* kan fixa det.

## Vilket ska jag välja?

1. **Distributionens paket** för system- och kommandoradsprogram – de är
   minst, snabbast och uppdateras med resten av systemet.
2. **Flatpak** för skrivbordsprogram när du vill ha en nyare version eller ett
   program som saknas i förråden.
3. **Snap** om du kör Ubuntu, eller när programmet bara finns som snap.
4. **AppImage** för att snabbt prova ett program, eller när utvecklaren bara
   erbjuder det formatet.
