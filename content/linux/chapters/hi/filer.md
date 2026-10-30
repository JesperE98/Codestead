# Files और directories

अब जब आप रास्ता ढूँढना जानते हैं, तो चीज़ें बनाने, copy करने, move करने और delete
करने का समय है।

## Directories बनाना – `mkdir`

```sh
mkdir bilder2
```

अगर आप एक साथ कई levels बनाना चाहते हैं, तो `-p` (*parents*) चाहिए। इसके बिना,
parent directory मौजूद न होने पर `mkdir` शिकायत करता है:

```sh
mkdir -p resa/2026/juni
```

## ख़ाली files बनाना – `touch`

`touch` एक ख़ाली file बना देता है अगर वह मौजूद न हो (वरना सिर्फ़ उसका timestamp
update करता है):

```sh
touch inkopslista.txt
```

```quiz
अगर फ़ाइल पहले से मौजूद हो, तो `touch anteckningar.txt` क्या करता है?
- [ ] फ़ाइल को ख़ाली कर देता है
- [ ] शिकायत करता है कि फ़ाइल मौजूद है
- [x] सिर्फ़ फ़ाइल का टाइमस्टैम्प अपडेट करता है – सामग्री वैसी ही रहती है
```

## Copy करना – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

अगर target एक directory है, तो copy उसी नाम से उसके अंदर पहुँच जाती है। पूरी
directory copy करने के लिए `-r` (*recursive*) चाहिए:

```sh
cp -r dokument dokument-backup
```

```predict
$ mkdir kopior
$ cp anteckningar.txt kopior
$ ls kopior
anteckningar.txt
---
`kopior` एक डायरेक्टरी है, इसलिए कॉपी उसी नाम से उसके अंदर पहुँच जाती है।
```

## Move करना और नाम बदलना – `mv`

Linux में *move* करना और *rename* करना एक ही बात है। `mv` दोनों काम करता है:

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
```

```quiz
`b.txt` नाम की कोई फ़ाइल नहीं है। `mv a.txt b.txt` क्या करता है?
- [ ] `a.txt` को `b.txt` में कॉपी करता है
- [x] `a.txt` का नाम बदलकर `b.txt` कर देता है
- [ ] विफल हो जाता है, क्योंकि `b.txt` मौजूद नहीं है
---
मूव करना और नाम बदलना एक ही बात है। इसके बाद सिर्फ़ `b.txt` बचती है।
```

## Delete करना – `rm` और `rmdir`

```sh
rm anteckningar-kopia.txt
```

`rmdir` *ख़ाली* directories हटाता है। किसी directory को उसके अंदर की हर चीज़ के
साथ हटाने के लिए `rm -r` इस्तेमाल कीजिए:

```sh
rm -r dokument-backup
```

> **सावधान!** Terminal में कोई recycle bin नहीं होता। जो आप `rm` से delete
> करते हैं, वह हमेशा के लिए चला जाता है। `rm -rf` (*recursive, force*) command
> कोई सवाल नहीं पूछता और कभी शिकायत नहीं करता – Enter दबाने से पहले path हमेशा
> दोबारा जाँच लीजिए।

```quiz
कौन-सा कमांड डायरेक्टरी `gammalt` को *सिर्फ़* तभी हटाता है जब वह ख़ाली हो?
- [ ] `rm gammalt`
- [x] `rmdir gammalt`
- [ ] `rm -r gammalt`
---
`rmdir` ऐसी डायरेक्टरी को हटाने से मना कर देता है जिसमें अभी भी कुछ है।
`rm -r` डायरेक्टरी और उसके अंदर की हर चीज़ हटा देता है।
```

## Wildcards

Command चलने से पहले shell patterns को कई file names में बदल (expand कर)
सकता है:

| Pattern | किससे match करता है |
|---|---|
| `*` | कुछ भी (शून्य या ज़्यादा characters) |
| `?` | ठीक एक character |
| `[abc]` | a, b या c में से कोई एक character |

आपकी होम डायरेक्टरी की डायरेक्टरी `dokument` में तीन फ़ाइलें हैं:
`betyg.csv`, `frukter.txt` और `server.log`। यह कमांड सिर्फ़ उन्हें दिखाता है
जिनके अंत में `.txt` है:

```sh
ls dokument/*.txt
```

यहाँ `ls` को asterisk कभी दिखता ही नहीं – shell पहले ही `dokument/*.txt` को
सभी matching file names से बदल चुका होता है।

```predict
$ ls dokument/?????.*
dokument/betyg.csv
---
हर `?` ठीक एक अक्षर है, इसलिए बिंदु से पहले का नाम पाँच अक्षरों का होना
चाहिए। सिर्फ़ `betyg` ऐसा है – `frukter` और `server` लंबे हैं।
```

## File names में spaces

Shell command line को spaces पर तोड़ता है। अगर किसी file के नाम में space है,
तो आपको quotes (या space से पहले `\`) लगाने होंगे:

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

इसीलिए बहुत से लोग file names में hyphens या underscores पसंद करते हैं।
