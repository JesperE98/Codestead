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

यह अध्याय एक सिंहावलोकन है। बेझिझक ऊपर के मेन्यू से डिस्ट्रीब्यूशन बदलिए और
कार्य फिर से कीजिए – आपको फ़र्क़ तुरंत दिख जाएगा। इस अध्याय के बाद हर परिवार के
लिए एक अध्याय आता है: **Debian परिवार** (apt), **Arch परिवार** (pacman) और
**Red Hat परिवार** (dnf)। इनमें से हर अध्याय हमेशा उसी परिवार के किसी
डिस्ट्रीब्यूशन पर चलता है, इसलिए आप तीनों कर सकते हैं।

## हर जगह क्या एक जैसा है?

- **Linux kernel** – हालाँकि अलग-अलग versions में।
- **Bash shell** और GNU के बुनियादी tools (`ls`, `cp`, `grep` ...)।
- **Directory layout** – `/etc`, `/home`, `/usr/bin` वग़ैरह।
- **systemd**, जो system को start करता है और services संभालता है, लगभग हर बड़े
  distribution पर।

Variable `SHELL` में उस shell का पूरा path होता है जिससे आप login करते हैं – bash
के लिए वही path जो आप script की shebang line में लिखते हैं।

```predict
$ echo $SHELL
/bin/bash
---
सिम्युलेटर में हर डिस्ट्रीब्यूशन पर शेल bash है – चाहे आपने कोई भी चुना हो।
```

## क्या अलग है?

| | Debian family | Arch family | Red Hat family |
|---|---|---|---|
| Package manager | `apt` | `pacman` | `dnf` |
| Package format | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Low-level tool | `dpkg` | (pacman) | `rpm` |
| Sudo group | `sudo` | `wheel` | `wheel` |
| Releases | Stable versions | Rolling | हर 6 महीने में नया version (Fedora) |

```quiz
किन परिवारों में sudo इस्तेमाल करने की अनुमति वाले समूह का नाम `wheel` है?
- [ ] Debian परिवार
- [x] Arch परिवार
- [x] Red Hat परिवार
---
Debian परिवार इस समूह को `sudo` कहता है; Arch और Red Hat इसे `wheel` कहते हैं।
```

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

```quiz
किस डिस्ट्रीब्यूशन में कोई संस्करण होते ही नहीं, बल्कि वह लगातार अपडेट होता रहता
है (*rolling*)?
- [ ] Debian
- [ ] Ubuntu LTS
- [x] Arch
- [ ] Fedora
```

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

```try
cat /etc/os-release
---
`NAME` और `PRETTY_NAME` वाली पंक्तियाँ बताती हैं कि यह कौन-सा डिस्ट्रीब्यूशन है।
```

## पैकेज, रिपॉज़िटरी और निर्भरताएँ

Windows और macOS पर आप अक्सर प्रोग्राम किसी वेबसाइट से डाउनलोड करते हैं। Linux
पर इसके बजाय आप लगभग सब कुछ एक **पैकेज मैनेजर** से इंस्टॉल करते हैं। डिस्ट्रीब्यूशन
परिवारों के बीच यही सबसे बड़ा फ़र्क़ है।

- **पैकेज** एक फ़ाइल में बंद किया गया प्रोग्राम (या लाइब्रेरी) है, साथ में उसके
  संस्करण और उसे किन चीज़ों की ज़रूरत है, इसकी जानकारी।
- **रिपॉज़िटरी** एक सर्वर है जिस पर डिस्ट्रीब्यूशन अपने सारे पैकेज प्रकाशित करता है।
  वे जाँचे हुए और हस्ताक्षरित (signed) होते हैं, इसलिए आप जानते हैं कि उनसे
  छेड़छाड़ नहीं हुई है।
- **निर्भरता** (*dependency*) कोई दूसरा पैकेज है जिसकी ज़रूरत होती है। पैकेज
  मैनेजर निर्भरताएँ अपने-आप इंस्टॉल कर देता है।

पैकेज मैनेजर यह भी याद रखता है कि क्या-क्या इंस्टॉल है, और एक ही कमांड से
कंप्यूटर पर *सब कुछ* अपडेट कर सकता है। सिस्टम बदलने वाले कमांड के लिए root
चाहिए, इसलिए उन्हें `sudo` के साथ चलाया जाता है।

```quiz
किसी पैकेज को एक दूसरे पैकेज की ज़रूरत है जो आपके पास नहीं है। जब आप उसे पैकेज
मैनेजर से इंस्टॉल करते हैं, तो क्या होता है?
- [ ] इंस्टॉलेशन रुक जाता है, और आपको दूसरा पैकेज ख़ुद ढूँढना पड़ता है
- [x] पैकेज मैनेजर निर्भरता को अपने-आप इंस्टॉल कर देता है
- [ ] पैकेज इंस्टॉल हो जाता है, लेकिन जब तक आप दूसरा डाउनलोड न करें, काम नहीं करता
```

### एक ही प्रोग्राम, अलग-अलग नाम

पैकेजों के नाम आमतौर पर हर जगह एक जैसे होते हैं – लेकिन हमेशा नहीं। कुछ
उदाहरण:

| प्रोग्राम | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH क्लाइंट | `openssh-client` | `openssh` | `openssh-clients` |

अगर आपको नाम पक्का पता न हो, तो हमेशा पैकेज मैनेजर से खोजिए।

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
