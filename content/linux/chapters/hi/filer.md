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

## Copy करना – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

अगर target एक directory है, तो copy उसी नाम से उसके अंदर पहुँच जाती है। पूरी
directory copy करने के लिए `-r` (*recursive*) चाहिए:

```sh
cp -r dokument dokument-backup
```

## Move करना और नाम बदलना – `mv`

Linux में *move* करना और *rename* करना एक ही बात है। `mv` दोनों काम करता है:

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
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

## Wildcards

Command चलने से पहले shell patterns को कई file names में बदल (expand कर)
सकता है:

| Pattern | किससे match करता है |
|---|---|
| `*` | कुछ भी (शून्य या ज़्यादा characters) |
| `?` | ठीक एक character |
| `[abc]` | a, b या c में से कोई एक character |

```sh
ls dokument/*.txt
```

यहाँ `ls` को asterisk कभी दिखता ही नहीं – shell पहले ही `dokument/*.txt` को
सभी matching file names से बदल चुका होता है।

## File names में spaces

Shell command line को spaces पर तोड़ता है। अगर किसी file के नाम में space है,
तो आपको quotes (या space से पहले `\`) लगाने होंगे:

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

इसीलिए बहुत से लोग file names में hyphens या underscores पसंद करते हैं।
