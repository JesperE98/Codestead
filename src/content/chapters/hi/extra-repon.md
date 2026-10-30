# AUR, PPA और COPR

Distribution की repositories में दसियों हज़ार packages होते हैं – लेकिन सब कुछ
नहीं। कोई niche program शायद वहाँ बिलकुल न हो, या सिर्फ़ किसी पुराने version में
हो। इसीलिए **extra repositories** होती हैं, जहाँ developers और users अपने ख़ुद के
packages share करते हैं। हर family की अपनी होती है: Ubuntu पर **PPA**, Arch पर
**AUR** और Fedora पर **COPR**।

इस chapter में आप एक ही काल्पनिक program, `moonphase` (यह terminal में चाँद की
कला दिखाता है), {{distro}} की extra repository से install करेंगे। अगर आप तुलना
करना चाहते हैं कि दूसरी families में यह कैसे काम करता है, तो menu में distribution
बदल दीजिए।

## सुविधाजनक – लेकिन अपने जोखिम पर

Distribution की अपनी repositories के packages एक साथ test किए जाते हैं, sign किए
जाते हैं और distribution के developers उनकी जाँच करते हैं। दूसरी तरफ़, extra
repository कोई भी बना सकता है। कोई repository जोड़ने से पहले यह ध्यान में रखिए:

- **Packages root के रूप में install होते हैं।** एक package computer के साथ कुछ भी
  कर सकता है। आप उसे बनाने वाले पर उतना ही भरोसा करते हैं जितना distribution पर।
- **यह टकरा सकता है।** Extra repository का package system की अपनी libraries को
  बदल सकता है या उसे आपके पास मौजूद versions के बजाय दूसरे versions चाहिए हो सकते
  हैं।
- **इसके updates बंद हो सकते हैं।** अगर repository चलाने वाले व्यक्ति की दिलचस्पी
  ख़त्म हो जाए, तो आपको program के लिए आगे कोई security updates नहीं मिलते।

एक अच्छा नियम: पहले distribution की repositories में देखिए, फिर Flatpak (अगला
chapter) के लिए, और उसके बाद ही किसी भरोसेमंद व्यक्ति की extra repository में।

## तीन families, तीन समाधान

| | PPA | AUR | COPR |
|---|---|---|---|
| Family | Ubuntu (और जैसे Linux Mint) | Arch (और जैसे Manjaro, EndeavourOS) | Fedora (और RHEL family) |
| Website | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| आप क्या download करते हैं | तैयार `.deb` packages | एक build recipe (`PKGBUILD`) – build आप ख़ुद करते हैं | तैयार `.rpm` packages |
| जोड़ना | `add-apt-repository ppa:…` | `git clone …` और `makepkg -si` | `dnf copr enable …` |
| Distribution ने जाँच की है | नहीं | नहीं | नहीं |

:::debian
## {{distro}} पर PPAs

**PPA** (*Personal Package Archive*) Launchpad पर एक छोटी repository है, जो Ubuntu
के लिए Canonical की service है। Developer source code upload करता है और Launchpad
अलग-अलग Ubuntu releases के लिए `.deb` packages build करता है। PPA को
`ppa:user/name` लिखा जाता है।

### add-apt-repository tool

PPAs `add-apt-repository` से जोड़े जाते हैं, जो package
`software-properties-common` में है। यह Ubuntu पर पहले से install होता है, लेकिन
Debian पर नहीं:

```sh
sudo apt update
sudo apt install software-properties-common
```

### PPA जोड़ना

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

आपको दिखता है कि क्या जोड़ा जा रहा है और PPA का विवरण भी। आगे बढ़ने के लिए Enter
दबाइए (`-y` के साथ सवाल छूट जाता है)। दो चीज़ें होती हैं:

1. `/etc/apt/sources.list.d/` में एक file बनती है। उसमें लिखा होता है कि repository
   कहाँ है और उसमें वह key होती है जिससे packages sign किए गए हैं।
2. `add-apt-repository` आपके लिए `apt update` चला देता है – वरना apt को नए
   packages के बारे में पता ही नहीं चलता। अगर आप कोई source हाथ से जोड़ते हैं (एक
   file बनाकर), तो उसके बाद आपको ख़ुद `sudo apt update` चलाना होगा।

File देखिए:

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

`Suites: noble` पर ध्यान दीजिए – packages Ubuntu 24.04 के लिए build किए गए हैं।

### Install करना और चलाना

अब package बिलकुल किसी भी दूसरे package की तरह install होता है:

```sh
sudo apt install moonphase
moonphase
```

### Package कहाँ से आता है?

`apt policy` दिखाता है कि कोई package किन repositories में है और कौन-सी जीतती है:

```sh
apt policy moonphase
```

`***` installed version को mark करता है। Number `500` repository की priority है और
`100` का मतलब है "जो पहले से install है"। अगर एक ही package कई repositories में
है, तो apt सबसे ऊँचा version चुनता है – इसलिए एक PPA distribution के अपने किसी
package को अपने version से बदल सकता है।

### Debian पर PPAs?

PPAs Ubuntu के लिए build किए जाते हैं, Debian के लिए नहीं। Debian पर वे शायद चल
जाएँ, लेकिन packages को Debian में मौजूद versions के बजाय दूसरे library versions
चाहिए हो सकते हैं। Debian और Ubuntu packages के मिश्रण को मज़ाक में *FrankenDebian*
कहते हैं, और यह system तोड़ने का एक आम तरीक़ा है। Debian पर *backports*, Flatpak
या developer की Debian के लिए अपनी repository इस्तेमाल करना बेहतर है।

### PPA हटाना

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

Program बना रहता है, लेकिन उसे आगे updates नहीं मिलते। उससे पूरी तरह छुटकारा पाने
के लिए `sudo apt remove moonphase` भी चलाइए।
:::

:::arch
## {{distro}} पर AUR

**AUR** (*Arch User Repository*) बाक़ियों से अलग है: इसमें तैयार packages नहीं
होते, सिर्फ़ **build recipes** होती हैं। Recipe को `PKGBUILD` कहते हैं और यह एक छोटा
bash script है जो बताता है कि source code कहाँ है और program कैसे build होता है। आप
recipe download करते हैं, package ख़ुद build करते हैं और उसे pacman से install करते
हैं। AUR बहुत विशाल है – Linux के लिए मौजूद लगभग हर चीज़ वहाँ है – लेकिन recipe कोई
भी upload कर सकता है।

### तैयारी

Recipes download करने और packages build करने के लिए आपको `git` और `base-devel` (एक
compiler, `make`, `fakeroot` और भी बहुत कुछ) चाहिए:

```sh
sudo pacman -S --needed git base-devel
```

`--needed` वह छोड़ देता है जो पहले से install है।

### Recipe लाना

हर AUR package अपनी अलग git repository है:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> अगर आप package का नाम ग़लत लिखते हैं, तो git कहता है *"You appear to have cloned an
> empty repository"* और directory ख़ाली रहती है। AUR आपको कुछ भी clone करने देता
> है!

### PKGBUILD पढ़िए – हर बार

```sh
less PKGBUILD
```

`PKGBUILD` एक script है जो आपके computer पर चलता है। कम से कम check कीजिए:

- कि `source=` program की असली website से download करता है,
- कि `build()` और `package()` सिर्फ़ files build और copy करते हैं – और, उदाहरण के
  लिए, कुछ और download करके नहीं चलाते (`curl … | sh`),
- कि package maintained लगता है (तारीख़ें, aur.archlinux.org पर comments)।

### Build और install करना

```sh
makepkg -si
```

`makepkg` `PKGBUILD` पढ़ता है, source code download करता है, उसे build करता है और
एक `.pkg.tar.zst` file pack करता है। `-s` छूटी हुई dependencies install करता है और
`-i` तैयार होने पर package को pacman से install करता है। makepkg को sudo के साथ
**मत** चलाइए – यह root के रूप में चलने से मना करता है, और ज़रूरत पड़ने पर ख़ुद sudo
इस्तेमाल करता है।

```sh
ls
moonphase
```

### "Foreign" packages

pacman को AUR के बारे में कुछ नहीं पता। जो packages repositories से नहीं आते, उन्हें
*foreign* कहते हैं और उनकी list ऐसे मिलती है:

```sh
pacman -Qm
```

इसका यह भी मतलब है कि `sudo pacman -Syu` AUR packages को update **नहीं** करता। आपको
नई recipe ख़ुद लानी होगी (`git pull`) और फिर से build करना होगा – या यह काम किसी
AUR helper पर छोड़ना होगा।

### AUR helper yay

AUR helper यह सब आपके लिए करता है: वह search करता है, download करता है, `PKGBUILD`
दिखाता है, build करता है और install करता है। सबसे आम है **yay** (एक और है *paru*)।
yay ख़ुद सिर्फ़ AUR में है, इसलिए उसे एक बार हाथ से install किया जाता है। Package
`yay-bin` पहले से compiled है और सबसे जल्दी होता है:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

उसके बाद yay काफ़ी हद तक pacman की तरह इस्तेमाल होता है – लेकिन sudo के बिना:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (या बस `yay`) repositories वाले packages और आपके AUR packages, दोनों को
upgrade करता है। सुविधा का मतलब यह नहीं कि आप recipes पढ़ना बंद कर दें!
:::

:::redhat
## {{distro}} पर COPR

**COPR** (*Cool Other Package Repo*) Fedora की build service है। Fedora account वाला
कोई भी वहाँ `.rpm` packages build कर सकता है, और हर project `user/project` नाम की
अपनी अलग repository बन जाता है।

### अभी आपके पास मौजूद repositories

```sh
dnf repolist
```

### COPR repository enable करना

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf आपको याद दिलाता है कि यह repository Fedora का हिस्सा नहीं है और quality अलग-अलग
हो सकती है। सवाल का default **No** है, इसलिए `y` जवाब दीजिए। `/etc/yum.repos.d/`
में एक नई file बनती है:

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

### Install करना और चलाना

dnf नई repository की जानकारी ख़ुद ले आता है, इसलिए package तुरंत install किया जा
सकता है:

```sh
sudo dnf install moonphase
moonphase
```

### Package कहाँ से आता है?

```sh
dnf info moonphase
```

`From repository` वाली line दिखाती है कि package COPR से आया है। COPR के packages
हमेशा की तरह `sudo dnf upgrade` से update होते हैं।

### Disable करना या हटाना

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` file को वहीं रहने देता है लेकिन repository को बंद कर देता है, `remove` उसे
पूरी तरह delete कर देता है। Program बना रहता है, लेकिन उसे आगे updates नहीं मिलते।

### RPM Fusion

Fedora के लिए एक और आम extra repository है **RPM Fusion**। इसमें वे चीज़ें हैं जो
Fedora शामिल नहीं कर सकता या नहीं करना चाहता, जैसे कुछ media codecs और drivers। यह
एक बड़ा, साझा project है – COPR की तरह किसी एक user की repository नहीं।
:::

## Updates और देखभाल

| | किससे update होता है | Repository हटाना |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu` – या ख़ुद फिर से build कीजिए | – (हटाने के लिए कोई repository नहीं है) |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

Extra repositories एक ताक़तवर tool हैं, लेकिन आपकी जोड़ी हर repository एक और ऐसा
भेजने वाला है जिस पर आप भरोसा करते हैं। List छोटी रखिए और जो अब इस्तेमाल नहीं करते,
उसे हटा दीजिए।
