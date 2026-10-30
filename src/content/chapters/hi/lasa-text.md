# Text पढ़ना और खोजना

Linux में लगभग सब कुछ text है: settings, logs, lists। इसीलिए text files पढ़ने
और उनमें खोजने के लिए बहुत सारे छोटे-छोटे tools हैं। आपकी home directory में
`dokument` नाम की एक directory है जिसमें practice के लिए दो files हैं:
`frukter.txt` (फलों की list) और `server.log` (एक काल्पनिक web server का log)।
इनका content Swedish में है, लेकिन जिन शब्दों को आप खोजेंगे – `INFO`, `WARN`
और `ERROR` – वे असली logs जैसे ही हैं।

## File दिखाना – `cat` और `less`

`cat` पूरी file print करता है:

```sh
cat dokument/frukter.txt
```

लंबी files के लिए `less` बेहतर है। उसमें आप arrow keys और space bar से scroll
करते हैं, `/word` से खोजते हैं और `q` से बाहर निकलते हैं।

## शुरुआत और अंत – `head` और `tail`

`head` पहली lines दिखाता है और `tail` आख़िरी। Default 10 lines है, लेकिन आप
`-n` से चुन सकते हैं:

```sh
head -n 5 dokument/server.log
tail -n 3 dokument/server.log
```

`tail -f` किसी file को *follow* करता है और नई lines लिखे जाते ही दिखाता है –
logs के लिए बिल्कुल सही। इसे **Ctrl+C** से रोकिए।

## गिनती – `wc`

`wc` (*word count*) lines, words और bytes गिनता है:

```sh
wc dokument/frukter.txt
```

अक्सर आपको सिर्फ़ lines की संख्या चाहिए होती है: `wc -l`।

## खोजना – `grep`

`grep` सबसे काम के commands में से एक है। यह हर वह line दिखाता है जिसमें कोई
pattern हो:

```sh
grep INFO dokument/server.log
```

कुछ options जो आप बहुत इस्तेमाल करेंगे:

| Option | मतलब |
|---|---|
| `-i` | Upper और lower case का फ़र्क़ नज़रअंदाज़ करो |
| `-n` | Line numbers दिखाओ |
| `-v` | वे lines दिखाओ जो match *नहीं* करतीं |
| `-c` | Matching lines गिनो |
| `-r` | किसी directory की हर file में recursively खोजो |
| `-E` | Extended patterns, जैसे `"ERROR|WARN"` |

```sh
grep -n WARN dokument/server.log
```

Pattern एक *regular expression* होता है। कुछ उदाहरण: `^` का मतलब है line की
शुरुआत और `$` का मतलब line का अंत, इसलिए `grep "^2026"` वे lines ढूँढता है जो
2026 से शुरू होती हैं।

## Sort करना – `sort` और `uniq`

`sort` lines को alphabetical order में लगाता है (numbers के लिए `-n`, उल्टे
order के लिए `-r`)। `uniq` वे lines हटा देता है जो *ठीक ऊपर वाली* line जैसी
हों – इसीलिए यह लगभग हमेशा `sort` के बाद इस्तेमाल होता है:

```sh
sort dokument/frukter.txt
```

## Manual – `man`

भूल गए कि कोई option क्या करता है? हर command का एक manual page होता है:

```sh
man grep
```
