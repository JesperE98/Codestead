# Users और groups

Linux शुरू से ही इस तरह बनाया गया था कि बहुत-से लोग एक ही समय पर एक ही computer
share कर सकें। हर file का एक owner होता है और हर program किसी ख़ास user के रूप में
चलता है – इसीलिए accounts बनाना, बदलना और हटाना administrator के सबसे ज़रूरी कामों
में से एक है। इस chapter में आप user `kim` बनाएँगे, उस account को password और sudo
अधिकार देंगे, और सीखेंगे कि यह सब कहाँ store होता है।

## Users और UIDs

आप पहले से जानते हैं कि कैसे पता करें कि आप कौन हैं:

```sh
whoami
id
```

`id` दिखाता है कि आपका सिर्फ़ नाम नहीं, बल्कि एक number भी है: `uid=1000`। यह
**UID** (*user ID*) है, और kernel नाम का नहीं, बल्कि इसी number का हिसाब रखता है।
नाम सिर्फ़ इसलिए है ताकि हम इंसानों को numbers याद न रखने पड़ें। कुछ ज़रूरी numbers:

| UID | कौन |
|---|---|
| `0` | **root**, administrator। जिसका UID 0 है, वह कुछ भी कर सकता है। |
| `1`–`999` | Services और programs के लिए **system users** |
| `1000` और ऊपर | **सामान्य users** – इंसान। पहले वाले को 1000 मिलता है। |

## Users की list – `/etc/passwd`

सारे users text file `/etc/passwd` में list होते हैं, हर user के लिए एक line:

```sh
cat /etc/passwd
```

हर line में colons से अलग किए गए सात fields होते हैं। अपनी line देखिए:

```sh
grep elev /etc/passwd
```

```text
elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash
 1   2  3    4      5        6          7
```

| Field | मतलब |
|---|---|
| 1 | User का नाम |
| 2 | `x` – password `/etc/shadow` में रहता है (नीचे देखिए) |
| 3 | UID |
| 4 | GID – user के **primary group** का number |
| 5 | Comment, आम तौर पर पूरा नाम |
| 6 | Home directory |
| 7 | वह shell जो user के login करने पर start होता है |

`getent` command भी यही lookup करता है। फ़र्क़ यह है कि यह उन users को भी ढूँढ़
लेता है जो file में नहीं हैं, जैसे किसी school या company में जहाँ accounts एक
central server पर रहते हैं:

```sh
getent passwd elev
```

### System users

`/etc/passwd` की ज़्यादातर lines इंसान नहीं हैं। Web server और logging system जैसी
services अपने-अपने users के रूप में, जितने कम हो सकें उतने अधिकारों के साथ चलती
हैं – अगर वे hack हो जाएँ, तो attacker आपकी files तक नहीं पहुँच सकता। उनका shell
`nologin` होता है, ताकि कोई उनके रूप में login न कर सके। Ubuntu पर वेब सर्वर के
यूज़र का नाम `www-data` है (सिस्टम यूज़र्स के नाम अलग-अलग डिस्ट्रीब्यूशन में अलग
होते हैं):

```sh
grep www-data /etc/passwd
```

Text processing वाले chapter के `awk` से आप UID 1000 या उससे ज़्यादा वाले सबकी
list बना सकते हैं – यानी सामान्य users:

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

`nobody` (UID 65534) भी दिखता है। यह एक ख़ास user है जो "कुछ भी नहीं" का owner है
और तब इस्तेमाल होता है जब किसी program के पास जितने कम हो सकें उतने अधिकार होने
चाहिए।

```predict
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
---
फ़ील्ड 3 UID है, और सिर्फ़ root का UID 0 है। root को उसकी शक्तियाँ नाम से नहीं,
बल्कि इसी संख्या से मिलती हैं।
```

## Groups और GIDs

**Group** कई users को एक जैसे अधिकार देने का तरीक़ा है, जैसे किसी shared project
directory पर। Groups `/etc/group` में list होते हैं:

```sh
cat /etc/group
```

```text
sudo:x:27:elev
 1   2  3   4
```

Fields हैं: group का नाम, `x`, group का number (**GID**) और members की comma से
अलग की गई list।

हर user का **एक primary group** होता है (`/etc/passwd` में GID field) और वह कितने
भी **supplementary groups** का member भी हो सकता है। आप जो नई files बनाते हैं,
उन्हें आपका primary group मिलता है। ज़्यादातर distributions में हर user को उसी
नाम का एक private primary group मिलता है – `elev` group `elev` में है।

```sh
groups
id
```

```quiz
आप (`elev`) समूह `elev` और `sudo` में हैं, और आपका प्राथमिक समूह `elev` है।
आपकी बनाई नई फ़ाइल को कौन-सा समूह मिलता है?
- [x] `elev`
- [ ] `sudo`
- [ ] दोनों
- [ ] `root`
---
नई फ़ाइलों को आपका **प्राथमिक** समूह मिलता है – `/etc/passwd` का GID फ़ील्ड।
`sudo` जैसे अतिरिक्त (supplementary) समूह आपको अतिरिक्त अधिकार देते हैं, लेकिन
आपकी फ़ाइलों पर नहीं आते।
```

## Passwords – `/etc/shadow`

`/etc/passwd` के field 2 में `x` पर ध्यान दीजिए। पुराने ज़माने में (encrypted)
password ठीक वहीं होता था। Problem यह है कि `/etc/passwd` का सबके लिए पढ़ने लायक
होना **ज़रूरी** है – `ls -l` owners के नाम वहीं से लेता है। इसलिए कोई भी encrypted
passwords copy करके आराम से उन्हें crack करने की कोशिश कर सकता था। इसीलिए उन्हें
`/etc/shadow` में भेज दिया गया, जिसे सिर्फ़ root पढ़ सकता है:

```sh
ls -l /etc/passwd /etc/shadow
sudo cat /etc/shadow
```

```text
kim:$y$j9T$Tm9...$Kx2...:20756:0:99999:7:::
```

Field 2 ख़ुद password नहीं, बल्कि एक **hash** है – एक "fingerprint" जिसे उलटा नहीं
जा सकता। जब आप login करते हैं, तो आपने जो टाइप किया उसका hash निकाला जाता है और
store किए गए hash से मिलाया जाता है। `$y$` का मतलब है कि *yescrypt* method
इस्तेमाल हुआ है। इसकी जगह `!` या `*` का मतलब है कि कोई password नहीं है, या
account **locked** है। बाक़ी fields बताते हैं कि password आख़िरी बार कब बदला गया
और कब expire होगा। `chage` इन्हें सीधी भाषा में दिखाता है:

```sh
chage -l elev
```

```try
chage -l elev
---
`Password expires: never` – elev का पासवर्ड कभी बदलना नहीं पड़ता।
```

## User बनाना – `useradd`

Users बनाने के लिए root चाहिए। सबसे आम command हर distribution में मौजूद है:

```sh
sudo useradd -m -s /bin/bash kim
```

| Option | मतलब |
|---|---|
| `-m` | Home directory `/home/kim` बनाओ |
| `-s /bin/bash` | User का shell |
| `-c "Kim Svensson"` | Comment (पूरा नाम) |
| `-G group1,group2` | तुरंत ही supplementary groups |

`useradd` 1000 से ऊपर की ओर अगला ख़ाली UID ढूँढ़ता है – `kim` को 1001 मिलता है।
Limits `/etc/login.defs` में हैं। साथ में एक group `kim` भी बनता है, और
`/etc/skel` (*skeleton*) की files नई home directory में copy हो जाती हैं। वहाँ कुछ
रखिए, और हर नए user को वह मिल जाएगा:

```sh
ls -a /etc/skel
```

Ubuntu पर `useradd` कंजूस है: `-m` के बिना **कोई** होम डायरेक्टरी नहीं बनती, और
`-s` के बिना शेल `/bin/sh` बन जाता है। दूसरे डिस्ट्रीब्यूशनों के डिफ़ॉल्ट अलग हैं,
इसलिए `-m` और `-s` लिखने की आदत डालिए – तब एक ही कमांड हर जगह काम करता है।

इसीलिए Ubuntu पर एक ज़्यादा सुविधाजनक स्क्रिप्ट `adduser` भी है, जो Debian परिवार
का हिस्सा है। यह होम डायरेक्टरी बनाता है, bash चुनता है और पासवर्ड व नाम पूछता है:

```sh
sudo adduser lisa
```

सवालों के जवाब दीजिए – ज़्यादातर के लिए आप Enter दबा सकते हैं। `adduser` किसी
मौजूदा user को group में भी जोड़ सकता है: `sudo adduser lisa sudo`।

`useradd`, `passwd` और इस अध्याय के बाक़ी कमांड हमेशा इंस्टॉल रहते हैं। Ubuntu पर
ये पैकेज `passwd` में आते हैं; दूसरे परिवार इस पैकेज को कुछ और नाम देते हैं।

## Password set करना – `passwd`

नए account का कोई password नहीं होता (`/etc/shadow` में `!`), इसलिए कोई उसमें
login नहीं कर सकता। `passwd` से एक password set कीजिए:

```sh
sudo passwd kim
```

आप password दो बार टाइप करते हैं। **आप जो टाइप करते हैं वह दिखता नहीं** – न stars,
न कुछ और। ऐसा जान-बूझकर है: आपके कंधे के ऊपर से झाँकने वाले को यह भी पता नहीं
चलना चाहिए कि password कितना लंबा है। टाइप कीजिए और Enter दबाइए।

बिना नाम के `passwd` आपका अपना password बदलता है। दूसरे users के passwords सिर्फ़
root बदल सकता है – sudo के बिना आज़माइए:

```sh
passwd root
```

## Groups – `groupadd`, `usermod -aG` और `gpasswd`

एक group बनाइए और उसमें एक member जोड़िए:

```sh
sudo groupadd utvecklare
sudo usermod -aG utvecklare kim
groups kim
```

`-aG` का मतलब है *append to Groups*। **`-a` मत भूलिए!** सिर्फ़ `-G` के साथ
supplementary groups की list ठीक वही set हो जाती है जो आप टाइप करते हैं – और user
बाक़ी हर group से हट जाता है, जैसे sudo group से। ख़ुद को lock out करने का यह एक आम
तरीक़ा है।

```quiz
`kim` अतिरिक्त समूहों `sudo` और `utvecklare` में है। एक प्रशासक
`sudo usermod -G backup kim` चलाता है। इसके बाद kim किन अतिरिक्त समूहों में
है?
- [ ] `sudo`, `utvecklare` और `backup`
- [x] सिर्फ़ `backup`
- [ ] `sudo` और `utvecklare` – `-a` के बिना कमांड विफल हो जाता है
- [ ] किसी में नहीं
---
`-a` के बिना सूची ठीक वही सेट हो जाती है जो आप टाइप करते हैं।
`sudo usermod -aG backup kim` से kim के बाक़ी समूह बने रहते।
```

`gpasswd` भी यही करता है और members को हटा भी सकता है:

```sh
sudo gpasswd -a kim utvecklare
sudo gpasswd -d kim utvecklare
```

असली computer पर नई group membership तभी लागू होती है जब user अगली बार login करता
है। Simulator ज़्यादा मेहरबान है – यहाँ यह तुरंत लागू हो जाती है।

Groups shared directories के लिए इस्तेमाल होते हैं। `chgrp` और `chmod` से group को
owner बनाइए और उसे write permission दीजिए:

```sh
sudo mkdir /srv/projekt
sudo chgrp utvecklare /srv/projekt
sudo chmod 775 /srv/projekt
ls -ld /srv/projekt
```

## Sudo अधिकार देना – `sudo` समूह

`sudo` कौन इस्तेमाल कर सकता है, यह `/etc/sudoers` में तय होता है:

```sh
sudo cat /etc/sudoers
```

पंक्ति `%sudo ALL=(ALL:ALL) ALL` का मतलब है कि समूह **sudo** का हर सदस्य हर कमांड
root के रूप में चला सकता है। इसलिए किसी को sudo अधिकार देना बस उसे सही समूह में
जोड़ने की बात है – Ubuntu पर समूह `sudo` में:

```sh
sudo usermod -aG sudo kim
```

अलग-अलग परिवारों में इस समूह के नाम अलग हैं: Arch और Fedora पर इसका नाम `wheel` है –
"जो कमान संभालते हैं" के लिए एक पुराना Unix नाम (*big wheel*)।

`/etc/sudoers` को कभी किसी साधारण editor से सीधे edit मत कीजिए – एक typo का मतलब हो
सकता है कि अब कोई भी sudo इस्तेमाल न कर पाए। `visudo` इस्तेमाल कीजिए, जो save करने
से पहले file जाँचता है। आम तौर पर आपको सिर्फ़ groups की ज़रूरत होती है।

## User बदलना – `su` और `sudo -u`

किसी और user बनने के दो तरीक़े हैं:

| Command | किसका password? | क्या होता है |
|---|---|---|
| `su - kim` | **kim का** | आप तब तक kim के रूप में logged in रहते हैं जब तक `exit` न टाइप करें |
| `sudo -u kim command` | **आपका अपना** (आपके पास sudo अधिकार होने चाहिए) | एक अकेला command kim के रूप में चलता है |
| `sudo -iu kim` | आपका अपना | kim के रूप में एक login shell |

```sh
sudo -u kim whoami
```

`su` से आप सच में बदल जाते हैं। Dash (`-`) इसे login बना देता है: आप kim की
settings के साथ kim की home directory में पहुँच जाते हैं। Prompt दिखाता है कि आप
कौन हैं, और `exit` आपको वापस ले आता है:

```sh
su - kim
```

बिना नाम के `su` का मतलब root है। Ubuntu पर root का कोई password नहीं होता, इसलिए
वहाँ `su -` काम नहीं करता – `sudo -i` इस्तेमाल कीजिए।

```quiz
आप `kim` के रूप में एक अकेला कमांड चलाना चाहते हैं, लेकिन आपको kim का पासवर्ड
नहीं पता। आपके पास sudo अधिकार हैं। क्या काम करेगा?
- [ ] `su - kim`
- [x] `sudo -u kim command`
- [ ] `su kim command`
- [ ] कुछ नहीं – आपको kim का पासवर्ड चाहिए
---
`su` उस यूज़र का पासवर्ड माँगता है जो आप बनते हैं। `sudo` **आपका अपना** पासवर्ड
माँगता है और `/etc/sudoers` में जाँचता है कि आपको इसकी अनुमति है।
```

## Accounts को lock और delete करना

जिस account को कुछ समय तक इस्तेमाल नहीं होना चाहिए, उसे **lock** किया जा सकता है।
`usermod -L` `/etc/shadow` में hash के आगे एक `!` लगा देता है, ताकि अब कोई भी
password मेल न खाए। `-U` उसे unlock करता है:

```sh
sudo usermod -L kim
sudo passwd -S kim
sudo usermod -U kim
```

`passwd -S` status दिखाता है: `P` (password है), `L` (locked) या `NP` (password
नहीं)। `chage -E` से किसी account को किसी ख़ास तारीख़ पर expire कराया जा सकता है –
summer में काम करने वालों और substitutes के लिए काम की चीज़।

किसी को delete करने से पहले यह देख लेना अच्छा हो सकता है कि कौन logged in है और
कोई आख़िरी बार कब था:

```sh
who
last
```

फिर `userdel` user को हटा देता है। `-r` के साथ home directory भी चली जाती है –
`-r` के बिना files पीछे छूट जाती हैं:

```sh
sudo useradd -m vikarie
sudo userdel -r vikarie
```

Ubuntu पर `deluser` भी है, जो `adduser` का उलटा है:
`sudo deluser --remove-home vikarie`। `sudo deluser kim sudo` kim को समूह sudo
से हटा देता है।

`userdel` logged in user को delete करने से मना कर देता है – `sudo userdel elev`
आज़माइए।

## सारांश

| Command | क्या करता है |
|---|---|
| `id`, `groups` | UID, GID और groups दिखाता है |
| `useradd -m -s /bin/bash name` | User बनाता है |
| `passwd name` | Password set करता है |
| `usermod -aG group name` | Group में जोड़ता है |
| `groupadd group` | Group बनाता है |
| `usermod -L` / `-U` | Lock / unlock करता है |
| `userdel -r name` | User और home directory delete करता है |
| `su - name`, `sudo -u name` | User बदलता है |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` | जहाँ यह सब store होता है |
