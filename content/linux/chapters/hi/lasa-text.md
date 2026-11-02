# Text पढ़ना और खोजना

Linux में लगभग सब कुछ text है: settings, logs, lists। इसीलिए text files पढ़ने
और उनमें खोजने के लिए बहुत सारे छोटे-छोटे tools हैं। आपकी home directory में
`{{documents}}` नाम की एक डायरेक्टरी है जिसमें अभ्यास के लिए फ़ाइलें हैं, जिनमें
`{{fruits}}` (फलों की सूची) और `server.log` (एक काल्पनिक वेब सर्वर का लॉग) भी हैं।
Log में हर line पर `INFO`, `WARN` या `ERROR` जैसा कोई level है, बिल्कुल असली
logs की तरह।

## File दिखाना – `cat` और `less`

`cat` पूरी file print करता है:

```sh
cat {{documents}}/{{fruits}}
```

लंबी files के लिए `less` बेहतर है। उसमें आप arrow keys और space bar से scroll
करते हैं, `/word` से खोजते हैं और `q` से बाहर निकलते हैं।

फलों की सूची देखिए – अगले सवाल के लिए आपको इसकी ज़रूरत पड़ेगी:

```try
cat {{documents}}/{{fruits}}
```

## शुरुआत और अंत – `head` और `tail`

`head` पहली lines दिखाता है और `tail` आख़िरी। Default 10 lines है, लेकिन आप
`-n` से चुन सकते हैं:

```sh
head -n 5 {{documents}}/server.log
tail -n 3 {{documents}}/server.log
```

`tail -f` किसी file को *follow* करता है और नई lines लिखे जाते ही दिखाता है –
logs के लिए बिल्कुल सही। इसे **Ctrl+C** से रोकिए।

```predict
$ tail -n 1 {{documents}}/{{fruits}}
आम
---
`tail -n 1` सिर्फ़ सबसे आख़िरी पंक्ति दिखाता है।
```

## गिनती – `wc`

`wc` (*word count*) lines, words और bytes गिनता है:

```sh
wc {{documents}}/{{fruits}}
```

अक्सर आपको सिर्फ़ lines की संख्या चाहिए होती है: `wc -l`।

## खोजना – `grep`

`grep` सबसे काम के commands में से एक है। यह हर वह line दिखाता है जिसमें कोई
pattern हो:

```sh
grep INFO {{documents}}/server.log
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
grep -n WARN {{documents}}/server.log
```

Pattern एक *regular expression* होता है। कुछ उदाहरण: `^` का मतलब है line की
शुरुआत और `$` का मतलब line का अंत, इसलिए `grep "^2026"` वे lines ढूँढता है जो
2026 से शुरू होती हैं।

```quiz
`server.log` में दो पंक्तियों में `WARN` है और एक पंक्ति में छोटे अक्षरों में `warn` है।
`grep -c WARN {{documents}}/server.log` क्या छापता है?
- [ ] 1
- [x] 2
- [ ] 3
---
`-c` मेल खाने वाली पंक्तियाँ गिनता है, और `-i` के बिना बड़े और छोटे अक्षर
अलग माने जाते हैं। `grep -ic WARN` तीनों को गिनता।
```

```quiz
कौन-सा कमांड `server.log` की हर वह पंक्ति दिखाता है जिसमें `INFO` **नहीं** है?
- [ ] `grep -i INFO {{documents}}/server.log`
- [ ] `grep -c INFO {{documents}}/server.log`
- [x] `grep -v INFO {{documents}}/server.log`
```

## Sort करना – `sort` और `uniq`

`sort` lines को alphabetical order में लगाता है (numbers के लिए `-n`, उल्टे
order के लिए `-r`)। `uniq` वे lines हटा देता है जो *ठीक ऊपर वाली* line जैसी
हों – इसीलिए यह लगभग हमेशा `sort` के बाद इस्तेमाल होता है:

```sh
sort {{documents}}/{{fruits}}
```

```quiz
`uniq` लगभग हमेशा `sort` के बाद क्यों इस्तेमाल होता है?
- [ ] `uniq` सिर्फ़ क्रमबद्ध फ़ाइलों पर काम करता है, वरना विफल हो जाता है
- [x] `uniq` सिर्फ़ वे पंक्तियाँ हटाता है जो ठीक ऊपर वाली पंक्ति जैसी हों, इसलिए एक जैसी पंक्तियाँ साथ-साथ होनी चाहिए
- [ ] `sort` दोहराव हटाता है और `uniq` उन्हें वापस डाल देता है
```

## Manual – `man`

भूल गए कि कोई option क्या करता है? हर command का एक manual page होता है:

```sh
man grep
```
