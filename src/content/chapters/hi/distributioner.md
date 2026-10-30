# Distributions और families

अब आप बुनियादी बातें जानते हैं, और वे हर distribution पर एक जैसी काम करती हैं।
तो फिर distributions को अलग क्या बनाता है?

:::debian
अभी आप **Debian family** का **{{distro}}** चला रहे हैं।
:::

:::arch
अभी आप **Arch family** का **{{distro}}** चला रहे हैं।
:::

:::redhat
अभी आप **Red Hat family** का **{{distro}}** चला रहे हैं।
:::

बेझिझक ऊपर के menu से distribution बदलिए और tasks फिर से कीजिए – आपको फ़र्क़
तुरंत दिख जाएगा।

## हर जगह क्या एक जैसा है?

- **Linux kernel** – हालाँकि अलग-अलग versions में।
- **Bash shell** और GNU के बुनियादी tools (`ls`, `cp`, `grep` ...)।
- **Directory layout** – `/etc`, `/home`, `/usr/bin` वग़ैरह।
- **systemd**, जो system को start करता है और services संभालता है, लगभग हर बड़े
  distribution पर।

## क्या अलग है?

| | Debian family | Arch family | Red Hat family |
|---|---|---|---|
| Package manager | `apt` | `pacman` | `dnf` |
| Package format | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Low-level tool | `dpkg` | (pacman) | `rpm` |
| Sudo group | `sudo` | `wheel` | `wheel` |
| Releases | Stable versions | Rolling | हर 6 महीने में नया version (Fedora) |

### Release models

- **Fixed versions वाले stable** – Debian लगभग हर दूसरे साल एक नया version
  निकालता है, और Ubuntu LTS (*Long Term Support*) हर दूसरे साल पाँच साल के
  support के साथ आता है। Programs को security fixes मिलते हैं, लेकिन उन्हें
  नए versions से कम ही बदला जाता है। Servers के लिए बढ़िया।
- **Rolling** – Arch में versions होते ही नहीं। आप लगातार update करते रहते हैं
  और हमेशा सबसे नया पाते हैं। यह आपसे, एक user के रूप में, थोड़ा ज़्यादा माँगता है।
- **तेज़ी से बदलने वाले** – Fedora लगभग हर छह महीने में नया version निकालता है
  और Red Hat Enterprise Linux (RHEL) के लिए एक तरह के test bed का काम करता है,
  जिसे दस साल का support मिलता है और जो businesses में इस्तेमाल होता है।

## मैं कौन-सा distribution चला रहा हूँ?

File `/etc/os-release` सभी modern distributions पर मौजूद होती है और नाम व
version बताती है:

```sh
cat /etc/os-release
```

Kernel का version `uname -r` से दिखता है:

```sh
uname -r
```

## Package manager की configuration

:::debian
Debian family में `/etc/apt/sources.list.d/` की files तय करती हैं कि apt
packages किन *repositories* से लाता है:

```sh
ls /etc/apt/sources.list.d
```
:::

:::arch
Arch family में pacman की configuration `/etc/pacman.conf` में होती है, और
mirror servers की list `/etc/pacman.d/mirrorlist` में रहती है:

```sh
cat /etc/pacman.conf
```
:::

:::redhat
Red Hat family में dnf की settings `/etc/dnf/dnf.conf` में हैं, और
*repositories* का ब्योरा `/etc/yum.repos.d/` की files में होता है:

```sh
ls /etc/yum.repos.d
```
:::

## मुझे कौन-सा चुनना चाहिए?

इसका कोई एक सही जवाब नहीं है, लेकिन एक मोटा नियम यह है:

- **Linux में नए हैं?** Ubuntu, Linux Mint या Fedora।
- **Server के लिए?** Debian, Ubuntu LTS या कोई RHEL clone जैसे Rocky Linux।
- **समझना चाहते हैं कि सब कुछ आपस में कैसे जुड़ा है?** Arch – और उसकी शानदार
  wiki।
