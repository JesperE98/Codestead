# Package management

Windows और macOS पर आप अक्सर programs किसी website से download करते हैं। Linux पर
इसकी जगह आप लगभग सब कुछ एक **package manager** से install करते हैं। Distribution
families के बीच यही सबसे बड़ा फ़र्क़ है – और यह chapter इस पर निर्भर करते हुए अलग
दिखता है कि आपने कौन-सा distribution चुना है। अभी यह {{distro}} पर **{{pm}}** है।

## Packages, repositories और dependencies

- **Package** एक program (या library) है जो एक file में pack किया गया है, साथ में
  उसके version और उसकी ज़रूरतों की जानकारी के साथ।
- **Repository** एक server है जहाँ distribution अपने सारे packages publish करता है।
  वे tested और signed होते हैं, इसलिए आप जानते हैं कि उनसे छेड़छाड़ नहीं हुई है।
- **Dependency** कोई दूसरा package है जिसकी ज़रूरत है। Package manager
  dependencies को अपने-आप install कर देता है।

Package manager यह भी हिसाब रखता है कि क्या install है, और एक ही command से
computer की *हर चीज़* update कर सकता है।

## एक ही काम – तीन बोलियाँ

| क्या | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Package list refresh करना | `apt update` | `pacman -Sy` | `dnf check-update` |
| सब कुछ upgrade करना | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Install करना | `apt install X` | `pacman -S X` | `dnf install X` |
| Remove करना | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Search करना | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Package की जानकारी | `apt show X` | `pacman -Si X` | `dnf info X` |
| Installed की list | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

System बदलने वाले commands को root चाहिए, इसलिए उन्हें `sudo` के साथ चलाया जाता है।

:::debian
## {{distro}} पर apt

### update और upgrade अलग-अलग चीज़ें हैं

शुरू में यह लगभग सबको उलझा देता है:

- `apt update` यह **list** download करता है कि कौन-से packages और versions उपलब्ध
  हैं। यह कुछ भी install नहीं करता।
- `apt upgrade` जो आपके पास पहले से है, उसके नए versions **install** करता है।

इसलिए हमेशा पहले `update` चलाइए। System update करने का सबसे आम तरीक़ा है:

```sh
sudo apt update && sudo apt upgrade
```

जब तक आपने `apt update` नहीं चलाया है (जैसे किसी नए install किए गए server पर), तब
तक package list ख़ाली रहती है और apt को कोई package मिलता ही नहीं।

### Install और remove करना

```sh
sudo apt install htop
```

`apt remove` program को हटा देता है लेकिन उसकी settings files छोड़ देता है।
`apt purge` उन्हें भी हटा देता है। जब apt पूछता है `Do you want to continue? [Y/n]`,
तो बड़े `Y` का मतलब है कि बस Enter दबाने से जवाब हाँ माना जाएगा। `-y` option के
साथ apt अपने-आप हाँ कह देता है।

### apt या apt-get?

`apt` आधुनिक, user-friendly रूप है जिसमें progress bar और colors हैं। `apt-get`
और `apt-cache` पुराने हैं लेकिन उनका output ज़्यादा स्थिर रहता है, इसलिए scripts
में वे अब भी इस्तेमाल होते हैं।

### अंदर की बात: dpkg और .deb

Packages `.deb` files होते हैं, और उन्हें असल में program `dpkg` unpack करता है।
apt उसके आसपास की हर चीज़ संभालता है: download, dependencies और updates।
:::

:::arch
## {{distro}} पर pacman

pacman छोटे options इस्तेमाल करता है, जिनमें **capital letter** operation होता है
और lowercase letters modifiers होते हैं:

| Option | मतलब |
|---|---|
| `-S` | Sync – repositories से install करना |
| `-R` | Remove |
| `-Q` | Query – installed packages के बारे में पूछना |
| `y` | Package database refresh करना |
| `u` | सारे packages upgrade करना |
| `s` | Search (-S और -Q के साथ), या dependencies हटाना (-R के साथ) |
| `i` | Info |

### System update करना

```sh
sudo pacman -Syu
```

`-Syu` का मतलब है: synchronize (`S`), database refresh करो (`y`) और सब कुछ upgrade
करो (`u`)। Arch एक *rolling release* है, इसलिए आप इसे अक्सर चलाएँगे।

> **ज़रूरी!** कभी भी सिर्फ़ `pacman -Sy` और उसके बाद `pacman -S package` मत
> चलाइए। हो सकता है नए package को आपके पास मौजूद libraries से नई libraries चाहिए
> हों – एक तथाकथित *partial upgrade*, जो आपका system तोड़ सकता है। हमेशा `-Syu`
> इस्तेमाल कीजिए।

### Install और remove करना

```sh
sudo pacman -S htop
```

`pacman -R package` एक package हटाता है, और `pacman -Rs package` उन dependencies को
भी हटा देता है जिनकी किसी और को ज़रूरत नहीं है।

### AUR

Official repositories के अलावा **AUR** (*Arch User Repository*) भी है, जहाँ users
हज़ारों programs की build recipes share करते हैं। लोग इससे install करने के लिए
अक्सर `yay` या `paru` जैसे किसी helper का इस्तेमाल करते हैं। AUR के packages को
Arch review नहीं करता – हमेशा पहले build recipe (PKGBUILD) पढ़ लीजिए।
:::

:::redhat
## {{distro}} पर dnf

### Automatic metadata

ज़रूरत पड़ने पर dnf नई package जानकारी ख़ुद ही ले आता है, इसलिए `apt update` जैसा
कोई अलग step नहीं है। अगर आप देखना चाहते हैं कि कौन-से updates उपलब्ध हैं, तो
चलाइए:

```sh
dnf check-update
```

Updates होने पर exit code `100` होता है – scripts में बहुत काम का।

### Install और remove करना

```sh
sudo dnf install htop
```

सवाल `Is this ok [y/N]` पर ध्यान दीजिए। बड़े `N` का मतलब है कि **No** default है –
अगर आप बस Enter दबाते हैं, तो installation रद्द हो जाता है। `y` और Enter टाइप
कीजिए, या `-y` इस्तेमाल कीजिए।

### System upgrade करना

```sh
sudo dnf upgrade
```

### अंदर की बात: rpm

Packages `.rpm` files होते हैं और low-level tool का नाम `rpm` है। dnf ने पुराने
`yum` की जगह ली, और Fedora 41 नया version **dnf5** लेकर आया, जो काफ़ी तेज़ है।
RHEL, Rocky और AlmaLinux पर भी command का नाम `dnf` ही है।
:::

## एक ही program, अलग-अलग नाम

Packages का नाम आम तौर पर हर जगह एक जैसा होता है – लेकिन हमेशा नहीं। कुछ उदाहरण:

| Program | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH client | `openssh-client` | `openssh` | `openssh-clients` |

अगर आपको नाम पक्का न पता हो, तो हमेशा package manager से search कीजिए।

## Universal package formats

ऐसे formats भी हैं जो हर distribution पर काम करते हैं: **Flatpak** (desktop
applications के लिए आम, Flathub के ज़रिए), **Snap** (Canonical का, Ubuntu पर
default) और **AppImage** (एक अकेली executable file)। इनके अपने commands होते हैं
और ये distribution के package manager के पूरक हैं।
