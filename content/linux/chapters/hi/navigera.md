# File system में घूमना

Linux में `C:` जैसे drive letters नहीं होते। सब कुछ – hard drives, USB sticks,
यहाँ तक कि hardware भी – directories के **एक ही tree** में रहता है, जो **root**
से शुरू होता है, जिसे `/` लिखा जाता है।

## सबसे ज़रूरी directories

| Directory | क्या रहता है |
|---|---|
| `/` | Root – tree का सबसे ऊपरी हिस्सा |
| `/home` | Users की home directories, जैसे `/home/elev` |
| `/root` | Administrator, यानी root, की home directory |
| `/etc` | System settings (configuration files) |
| `/usr/bin` | Programs (commands) जैसे `ls` और `cat` |
| `/var/log` | Log files |
| `/tmp` | Temporary files, जिनमें कोई भी लिख सकता है |
| `/dev` | Devices, जैसे disks |
| `/proc` | Processes और kernel के बारे में जानकारी |
| `/boot` | Computer को start करने के लिए ज़रूरी files |

इस बनावट को *Filesystem Hierarchy Standard* कहते हैं, और यह लगभग सभी
distributions में एक जैसी है।

```quiz
एक प्रोग्राम लॉग फ़ाइल लिखता है। आप उसे किस डायरेक्टरी में मिलने की उम्मीद करेंगे?
- [ ] `/etc`
- [ ] `/usr/bin`
- [x] `/var/log`
- [ ] `/home`
---
लॉग फ़ाइलें `/var/log` में जाती हैं। सेटिंग्स `/etc` में रहती हैं और प्रोग्राम `/usr/bin` में।
```

## मैं कहाँ हूँ? – `pwd`

`pwd` (*print working directory*) वह directory दिखाता है जिसमें आप अभी हैं:

```sh
pwd
```

## यहाँ क्या है? – `ls`

`ls` किसी directory का content दिखाता है। Arguments के बिना यह वही directory
दिखाता है जिसमें आप हैं, लेकिन आप किसी और directory का नाम भी दे सकते हैं:

```sh
ls /etc
```

`-l` option ज़्यादा जानकारी के साथ एक long format देता है:

```sh
ls -l
```

जिन files के नाम dot से शुरू होते हैं, वे **hidden** होती हैं और default रूप से
नहीं दिखतीं। अक्सर ये settings files होती हैं, जैसे `.bashrc`। `-a` (*all*)
option इन्हें भी दिखाता है:

```sh
ls -a
```

Options को मिलाया जा सकता है: `ls -la` वही है जो `ls -l -a` है।

```quiz
होम डायरेक्टरी में सादा `ls` फ़ाइल `.bashrc` क्यों नहीं दिखाता?
- [ ] यह एक सिस्टम फ़ाइल है जिसे सिर्फ़ root देख सकता है
- [x] इसका नाम बिंदु से शुरू होता है, इसलिए यह छिपी हुई है
- [ ] `ls` सिर्फ़ डायरेक्टरी दिखाता है
---
जिन फ़ाइलों के नाम बिंदु से शुरू होते हैं, वे छिपी होती हैं। `ls -a` उन्हें भी दिखाता है।
```

लंबे फ़ॉर्मैट को छिपी फ़ाइलों के साथ आज़माइए:

```try
ls -la
```

## Directory बदलना – `cd`

`cd` (*change directory*) आपको किसी दूसरी directory में ले जाता है:

```sh
cd /var/log
```

Paths दो तरह के होते हैं:

- **Absolute** path `/` से शुरू होता है और root से चलता है, जैसे `/var/log`।
  आप कहीं भी हों, यह काम करता है।
- **Relative** path उस directory से शुरू होता है जिसमें आप हैं। अगर आप `/`
  में हैं, तो `/var/log` तक सिर्फ़ `cd var/log` से पहुँच सकते हैं।

```quiz
आप `/home` में हैं। कौन-से कमांड आपको `/home/elev/dokument` तक ले जाते हैं? (जो भी काम करें, सब चुनें।)
- [x] `cd elev/dokument`
- [x] `cd /home/elev/dokument`
- [ ] `cd /elev/dokument`
- [ ] `cd dokument`
---
`elev/dokument` `/home` के सापेक्ष है, और `/home/elev/dokument` निरपेक्ष (absolute) है,
इसलिए वह कहीं से भी काम करता है। `/elev/dokument` रूट से शुरू होता है, जहाँ
कोई `elev` नहीं है।
```

कुछ ख़ास नाम जानने लायक़ हैं:

| नाम | मतलब |
|---|---|
| `.` | वह directory जिसमें आप हैं |
| `..` | ऊपर वाली directory (parent) |
| `~` | आपकी home directory |
| `-` | (सिर्फ़ `cd` के साथ) वह directory जिसमें आप पिछली बार थे |

Arguments के बिना `cd` आपको हमेशा home ले जाता है।

```sh
cd ..
```

```predict
$ cd /usr/bin
$ cd ..
$ pwd
/usr
---
`..` ऊपर वाली डायरेक्टरी है, इसलिए `/usr/bin` से आप `/usr` में पहुँचते हैं।
```

## Tab completion

पूरे नाम टाइप करने की ज़रूरत कम ही पड़ती है। शुरुआत टाइप कीजिए, जैसे `cd /va`,
और **Tab** दबाइए – shell बाक़ी हिस्सा भर देता है। अगर कई विकल्प हों, तो Tab
दबाने पर वे दिख जाते हैं। अनुभवी Linux users हर समय Tab दबाते रहते हैं!
