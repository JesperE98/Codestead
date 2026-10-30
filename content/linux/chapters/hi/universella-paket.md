# Flatpak, Snap और AppImage

एक साधारण package किसी एक ख़ास distribution और release के लिए build किया जाता है।
Desktop program बनाने वाले के लिए यह एक समस्या है: एक ही program को Debian, Ubuntu,
Fedora, Arch और उनकी सारी releases के लिए बार-बार package करना पड़ता है।
**Universal package formats** इसे इस तरह हल करते हैं कि program को जो कुछ चाहिए,
उसका ज़्यादातर हिस्सा package के अंदर ही bundle कर देते हैं – ताकि एक ही package
हर distribution पर काम करे।

तीन बड़े formats हैं **Flatpak**, **Snap** और **AppImage**। ये distribution के
package manager की जगह नहीं लेते, बल्कि उसके पूरक हैं, ख़ासकर desktop programs के
लिए।

> Simulator में सिर्फ़ एक terminal है। जब आप कोई graphical program start करते हैं,
> तो आपको एक line मिलती है जो बताती है कि असल में वह एक window में खुलता।

## Program install करने के चार तरीक़े

| | Distribution package | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| कहाँ से आता है | Distribution की repositories | Flathub (या दूसरे *remotes*) | Snap Store (Canonical) | Developer की website |
| कहाँ चलता है | एक distribution और release | सब पर | उन सब पर जिनमें `snapd` है | सब पर (FUSE चाहिए) |
| Sandbox | नहीं | हाँ | हाँ (*classic* को छोड़कर) | नहीं |
| Size | छोटा – system के साथ libraries share करता है | पहली बार बड़ा (runtimes), फिर shared | बड़ा – हर snap और उसका base | बड़ा – सब कुछ एक file में |
| Updates | System के साथ (`apt upgrade` …) | `flatpak update` | Background में अपने-आप | ख़ुद – नई file download कीजिए |
| किसके लिए अच्छा | System programs, command-line tools, servers | Desktop programs | Ubuntu, desktops और servers | अकेले programs, नए versions आज़माना |

**Sandbox** का मतलब है कि program सिर्फ़ उन्हीं चीज़ों तक पहुँच सकता है जिनकी उसे
इजाज़त दी गई है, जैसे network या आपका downloads folder, न कि आपकी पूरी home
directory तक।

## Flatpak

Flatpak वह format है जिस पर ज़्यादातर distributions desktop programs के लिए सहमत
हुए हैं। Programs एक **remote** से download होते हैं – लगभग हमेशा **Flathub** – और
साझा **runtimes** (जैसे `org.gnome.Platform`) share करते हैं, ताकि हर program को सब
कुछ अपने साथ न लाना पड़े।

:::debian
### Flatpak install करना

{{distro}} पर Flatpak पहले से install नहीं होता:

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### Flatpak install करना

Flatpak Arch की repositories में है:

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### {{distro}} पर Flatpak

Fedora Workstation में Flatpak पहले से आता है, और Fedora का अपना remote `fedora`
पहले से जुड़ा होता है:

```sh
flatpak --version
flatpak remotes
```
:::

### Flathub जोड़ना

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` की वजह से command fail नहीं होता अगर Flathub पहले से मौजूद है –
scripts और install guides में काम का।

### Search, install और run करना

हर program की एक **ID** होती है जो उल्टे domain name की तरह लिखी जाती है, जैसे
`org.gimp.GIMP`:

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

Flatpak दिखाता है कि program कौन-सी **permissions** चाहता है और कौन-से runtimes साथ
आते हैं। Size पर ध्यान दीजिए: पहला program कई सौ megabytes का एक runtime खींच लाता
है, लेकिन उसी runtime को इस्तेमाल करने वाला अगला program छोटा होता है।

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### पूरे system के लिए या सिर्फ़ आपके लिए

बिना options के Flatpak **पूरे system** के लिए install करता है (`/var/lib/flatpak`
में)। Desktop पर Flatpak एक window में आपका password माँगता है, इसलिए sudo की
ज़रूरत नहीं होती। `--user` के साथ program इसके बजाय आपकी home directory में पहुँचता है
(`~/.local/share/flatpak`) और कोई दूसरा user उसे नहीं देखता। User installation के
**अपने remotes** होते हैं, इसलिए Flathub को भी `--user` के साथ जोड़ना होता है:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

### Update करना और हटाना

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` उन runtimes को हटा देता है जिन्हें अब कोई installed program इस्तेमाल नहीं
करता।

## Snap

Snap **Canonical** का format है और Ubuntu पर default है – वहाँ, उदाहरण के लिए,
Firefox एक snap है। Snaps **Snap Store** से आते हैं, जिसे Canonical चलाता है, और
उन्हें `snapd` service संभालती है। वे background में अपने-आप update होते हैं।

:::debian
### Ubuntu और Debian पर Snap

Ubuntu में Snap पहले से है। Debian पर आप पहले `snapd` install करते हैं:

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Arch पर Snap

Snap Arch की repositories में नहीं है – सिर्फ़ AUR में है। इसे पिछले chapter की
तरह build कीजिए:

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

असली system पर आपको service को `sudo systemctl enable --now snapd.socket` से start
भी करना होगा। यह इस बात का संकेत है कि Arch पर Snap अपने घर जैसा नहीं है: वहाँ
ज़्यादातर लोग Flatpak इस्तेमाल करते हैं।
:::

:::redhat
### Fedora पर Snap

Fedora Flatpak पर दाँव लगाता है, लेकिन Snap repositories में है:

```sh
sudo dnf install snapd
```
:::

### snap इस्तेमाल करना

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

Installed snaps `/snap/bin` में programs के रूप में दिखते हैं। Install करने और हटाने
के लिए root चाहिए।

### Strict या classic

ज़्यादातर snaps sandbox में **strictly** चलते हैं। जिन programs को पूरे system तक
पहुँच चाहिए, जैसे code editors, वे **classic confinement** के साथ publish किए जाते
हैं। तब आपको `--classic` से इसे ख़ुद मंज़ूरी देनी होती है:

```sh
sudo snap install code
sudo snap install code --classic
```

### Channels और updates

हर snap के **channels** होते हैं: `stable`, `candidate`, `beta` और `edge` (सबसे
नया, बिना test किया version)। `snap info` उन्हें दिखाता है और `--channel=beta` कोई
दूसरा चुनता है। Updates अपने-आप होते हैं, लेकिन आप उन्हें ज़बरदस्ती करवा सकते हैं
और snaps हटा सकते हैं:

```sh
sudo snap refresh
sudo snap remove hello-world
```

Snap के आलोचक भी हैं: Snap Store सिर्फ़ Canonical चलाता है, automatic updates को
पूरी तरह बंद नहीं किया जा सकता और programs पहली बार start होने में धीमे हो सकते हैं।

## AppImage

**AppImage** एक पूरा program है **एक ही file** में। आप इसे program की website से
download करते हैं, executable बनाते हैं और start कर देते हैं – न कोई installation,
न root। Program से छुटकारा पाने के लिए आप बस file delete कर देते हैं।

आपकी home directory में `~/Nedladdningar` (Swedish में "Downloads") के अंदर पहले से
एक download किया हुआ AppImage है:

```sh
cd ~/Nedladdningar
ls -l
```

Download की गई files शुरू में कभी executable नहीं होतीं। इसे executable बनाइए और
start कीजिए:

```sh
chmod +x Kalkylator.AppImage
./Kalkylator.AppImage
```

### FUSE

AppImage **FUSE** की मदद से ख़ुद को एक file system के रूप में mount करता है, और उसे
library का पुराना version 2 (`libfuse.so.2`) चाहिए। इसके बिना आपको error मिलता है
*"AppImages require FUSE to run"*।

:::debian
Ubuntu 24.04 और Debian 13 पर package का नाम `libfuse2t64` है (*t64* 64-bit time पर
बदलाव से आया है; पुरानी releases में इसका नाम `libfuse2` था):

```sh
sudo apt update
sudo apt install libfuse2t64
./Kalkylator.AppImage
```

> Ubuntu पर package `fuse` install **मत** कीजिए – यह `fuse3` की जगह ले लेता है,
> जिसकी desktop को ज़रूरत है।
:::

:::arch
Arch पर package का नाम `fuse2` है:

```sh
sudo pacman -S fuse2
./Kalkylator.AppImage
```
:::

:::redhat
Fedora पर package का नाम `fuse-libs` है:

```sh
sudo dnf install fuse-libs
./Kalkylator.AppImage
```
:::

### अंदर झाँकिए

AppImage को unpack भी किया जा सकता है। यह FUSE के बिना भी काम करता है:

```sh
./Kalkylator.AppImage --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` कुछ देर के लिए unpack करता है और तुरंत start कर देता है।

### ध्यान रखिए

- AppImage में **कोई sandbox नहीं** होता – program आपके रूप में चलता है और हर उस चीज़
  तक पहुँच सकता है जहाँ आप पहुँच सकते हैं। सिर्फ़ program की official website से
  download कीजिए।
- **कोई automatic updates नहीं** होते। नया version आने पर आप एक नई file download
  करते हैं (कुछ programs ख़ुद को update कर सकते हैं)।
- Program अपने-आप application menu में नहीं दिखता। *Gear Lever* या
  *AppImageLauncher* जैसे tools इसे ठीक कर सकते हैं।

## मुझे कौन-सा चुनना चाहिए?

1. System और command-line programs के लिए **distribution के packages** – ये सबसे
   छोटे और सबसे तेज़ होते हैं और बाक़ी system के साथ update होते हैं।
2. Desktop programs के लिए **Flatpak**, जब आपको नया version चाहिए या कोई ऐसा program
   जो repositories में नहीं है।
3. **Snap** अगर आप Ubuntu चलाते हैं, या जब program सिर्फ़ snap के रूप में मौजूद है।
4. **AppImage** किसी program को जल्दी से आज़माने के लिए, या जब developer सिर्फ़ यही
   format देता है।
