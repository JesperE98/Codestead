# sed, tr और awk से text processing

`grep` से आप lines *ढूँढ* सकते हैं। लेकिन अक्सर आप उससे ज़्यादा करना चाहते हैं:
कोई शब्द बदलना, कुछ lines delete करना, कोई column निकालना या कुछ numbers जोड़ना।
तब काम आते हैं तीन classic tools:

| Tool | किस पर काम करता है | आम काम |
|---|---|---|
| `tr` | अकेले **characters** | uppercase में बदलना, `:` को newlines में बदलना |
| `sed` | **lines** | कोई शब्द बदलना, lines delete करना |
| `awk` | **columns** (fields) | columns निकालना, जोड़ना, गिनना |

तीनों *filters* हैं: वे text पढ़ते हैं, उसके साथ कुछ करते हैं और नतीजा stdout पर
लिखते हैं। इसीलिए ये pipes के लिए बिल्कुल सही हैं। और original file **नहीं** बदलती
(एक अपवाद के साथ, `sed -i`, जिस पर हम आगे आएँगे)।

`dokument` में अभ्यास के लिए एक तीसरी फ़ाइल है, छात्रों के अंकों वाली एक CSV फ़ाइल
(*namn* = नाम, *ämne* = विषय, *poäng* = अंक):

```sh
cat ~/dokument/betyg.csv
```

CSV का मतलब है *comma-separated values* – columns commas से अलग होते हैं, और पहली
line एक header है।

## Characters बदलना – `tr`

`tr` (*translate*) पहले set के हर character को दूसरे set में उसी जगह वाले character
से बदल देता है। `a-z` का मतलब है a से z तक के सारे letters:

```sh
echo "hello from café" | tr a-z A-Z
```

```text
HELLO FROM CAFé
```

é पर ध्यान गया? `tr` अलग-अलग *bytes* पर काम करता है, और é जैसे letters – या Swedish
के å, ä और ö – `a-z` का हिस्सा नहीं हैं। यह जानना अच्छा है – GNU `awk` (आगे) इसे
बेहतर संभालता है।

`tr` **सिर्फ़** stdin से पढ़ता है, files से कभी नहीं। अगर आप कोई file इस्तेमाल करना
चाहते हैं, तो उसे `<` या pipe से अंदर भेजिए:

```sh
tr a-z A-Z < ~/dokument/frukter.txt
```

एक classic trick है colons को newlines (`\n`) में बदलना, ताकि `PATH` की हर directory
अपनी अलग line पर आ जाए:

```sh
echo $PATH | tr ':' '\n'
```

`-d` (*delete*) से आप characters हटाते हैं, और `-s` (*squeeze*) से लगातार आए कई एक
जैसे characters को दबाकर एक कर देते हैं:

```sh
echo "070-123 45 67" | tr -d ' -'
echo "too     many      spaces" | tr -s ' '
```

```predict
$ echo "hello world" | tr -d o
hell wrld
---
`-d` हर `o` को हटा देता है, चाहे वह कहीं भी हो।
```

Ranges की जगह आप *classes* भी लिख सकते हैं, जैसे `[:upper:]` (uppercase),
`[:lower:]` (lowercase), `[:digit:]` (अंक) और `[:space:]` (whitespace):

```sh
echo "Room 101, floor 3" | tr -d '[:digit:]'
```

## Stream editor – `sed`

`sed` (*stream editor*) text को line by line पढ़ता है और हर line पर एक छोटी *script*
चलाता है। सबसे आम command है `s` – *substitute*।

### Text बदलना – `s`

```sh
sed 's/ERROR/FEL/' ~/dokument/server.log
```

Script `s/ERROR/FEL/` का मतलब है: `ERROR` को `FEL` (Swedish में "error") से बदलो।
इसका रूप होता है

```text
s/PATTERN/REPLACEMENT/FLAGS
```

Flags के बिना हर line पर सिर्फ़ **पहला** match बदला जाता है। `g` (*global*) के साथ
सारे बदले जाते हैं:

```sh
echo "cat cat cat" | sed 's/cat/dog/'
echo "cat cat cat" | sed 's/cat/dog/g'
```

```predict
$ echo banana | sed 's/a/o/'
bonana
---
`g` के बिना पंक्ति का सिर्फ़ पहला `a` बदला जाता है।
```

`i` flag खोज को case-insensitive बना देता है, बिल्कुल `grep -i` की तरह:

```sh
sed 's/warn/WARNING/i' ~/dokument/server.log
```

Pattern एक *regular expression* है, बिल्कुल `grep` की तरह। यहाँ हम हर line की
शुरुआत से date हटा रहे हैं (`^` = line की शुरुआत, `[0-9-]*` = अंक और hyphens):

```sh
sed 's/^[0-9-]* //' ~/dokument/server.log
```

Replacement में `&` का मतलब है "जो भी match हुआ":

```sh
echo "Linux is fun" | sed 's/Linux/**&**/'
```

**दूसरा delimiter।** अगर text में ख़ुद slashes हों, तो मामला उलझ जाता है:
`s/\/usr\/local/\/opt/`। लेकिन `s` के ठीक बाद वाला character delimiter तय करता है,
इसलिए आप `|` या `#` भी इस्तेमाल कर सकते हैं:

```sh
echo /usr/local/bin | sed 's|/usr/local|/opt|'
```

**Groups।** `-E` (extended regular expressions) के साथ आप match के हिस्सों को
parentheses से पकड़ सकते हैं और replacement में `\1`, `\2` … के रूप में इस्तेमाल कर
सकते हैं। यहाँ हम date को उल्टा कर रहे हैं:

```sh
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/dokument/server.log
```

### Lines चुनना – addresses

किसी command के आगे आप एक *address* लिख सकते हैं जो तय करता है कि command किन lines
पर लागू हो। `d` command (*delete*) lines delete करता है और `p` (*print*) उन्हें print
करता है:

```sh
sed '/INFO/d' ~/dokument/server.log
sed '1d' ~/dokument/betyg.csv
```

पहला `INFO` वाली हर line delete करता है, दूसरा line 1 – यानी header – delete करता है।

`sed` आम तौर पर *हर* line print करता है। `-n` के साथ वह ऐसा करना बंद कर देता है, और
तब सिर्फ़ वही print होता है जो `p` कहता है। Lines 5 से 8 ऐसे दिखाइए:

```sh
sed -n '5,8p' ~/dokument/server.log
```

| Address | मतलब |
|---|---|
| `5` | line 5 |
| `$` | आख़िरी line |
| `/ERROR/` | pattern से match करने वाली lines |
| `2,4` | lines 2 से 4 |
| `/WARN/,/ERROR/` | WARN वाली line से अगली ERROR वाली line तक |
| `/INFO/!` | match करने वाली lines को **छोड़कर** हर line |

Addresses हर command के साथ काम करते हैं, `s` के साथ भी। यहाँ सिर्फ़ error वाली lines
पर निशान लगता है:

```sh
sed '/ERROR/s/^/>>> /' ~/dokument/server.log
```

`q` command (*quit*) किसी दी गई line के बाद रुक जाता है – इसलिए `sed 3q` वही करता है
जो `head -n 3`। कई commands को आप `;` से या कई `-e` से अलग करते हैं:

```sh
sed -e '/INFO/d' -e 's/ERROR/FEL/' ~/dokument/server.log
```

### File को सीधे बदलना – `sed -i`

अब तक सब कुछ सिर्फ़ *print* हुआ है। File ख़ुद नहीं बदली – चाहें तो `cat` से जाँच
लीजिए। `-i` (*in-place*) के साथ `sed` नतीजे को वापस file में लिख देता है। इसे एक
copy पर आज़माइए:

```sh
cp ~/dokument/frukter.txt ~/frukter-kopia.txt
sed -i 's/kiwi/kiwifruit/' ~/frukter-kopia.txt
cat ~/frukter-kopia.txt
```

`sed -i` का कोई undo नहीं है। काम करने का एक अच्छा तरीक़ा है कि पहले command को `-i`
के **बिना** चलाकर नतीजा देखिए, और जब सही लगे तब `-i` जोड़िए। अगर आप `-i.bak` लिखते
हैं, तो original भी `file.bak` के रूप में save हो जाती है।

```quiz
आप `sed 's/kiwi/KIWI/' ~/dokument/frukter.txt` चलाते हैं। फ़ाइल का क्या होता है?
- [ ] फ़ाइल का हर `kiwi` `KIWI` बन जाता है
- [ ] फ़ाइल का सिर्फ़ पहला `kiwi` `KIWI` बनता है
- [x] कुछ नहीं – नतीजा सिर्फ़ छापा जाता है, फ़ाइल नहीं बदलती
---
`-i` के बिना `sed` सिर्फ़ stdout पर लिखता है। फ़ाइल जैसी थी वैसी ही रहती है।
```

`/etc` की configuration files root की होती हैं, इसलिए वहाँ आपको `sudo sed -i ...`
चाहिए। Text editor खोले बिना किसी script से setting बदलने का यह एक आम तरीक़ा है।

## फ़ील्ड काटकर निकालना – `cut`

जब कोई फ़ाइल फ़ील्डों से बनी हो जिनके बीच एक विभाजक (separator) हो, तो `cut`
एक फ़ील्ड चुनकर निकाल सकता है। `-d` विभाजक (*delimiter*) चुनता है और `-f` बताता
है कि कौन-सा फ़ील्ड रखना है। ये रहे CSV फ़ाइल के विषय – फ़ील्ड 2:

```sh
cut -d, -f2 ~/dokument/betyg.csv
```

`/etc/passwd` में फ़ील्ड कोलन से अलग होते हैं और फ़ील्ड 1 यूज़रनेम है, इसलिए
`cut -d: -f1 /etc/passwd` सभी यूज़र्स की सूची दिखाता है। दूसरे फ़िल्टरों की तरह
`cut` भी पाइप में फ़िट बैठता है – जैसे `tr` से पहले।

## Columns – `awk`

`awk` असल में एक पूरी छोटी programming language है, लेकिन ज़्यादातर इसे एक ही काम के
लिए इस्तेमाल किया जाता है: **columns** के साथ काम करना। awk हर line को *fields* में
बाँटता है:

| Field | मतलब |
|---|---|
| `$1`, `$2` … | पहला, दूसरा … field |
| `$0` | पूरी line |
| `NF` | line में fields की संख्या (*number of fields*) |
| `$NF` | आख़िरी field |
| `NR` | line number (*number of record*) |

Default रूप से fields spaces से अलग होते हैं (कितने भी)। `server.log` में field 3
log level है:

```sh
awk '{print $3}' ~/dokument/server.log
```

Program `{ }` के अंदर जाता है और हर line के लिए चलता है। awk program को हमेशा
**single** quotes में रखिए – वरना shell `$3` को shell variable समझकर awk के शुरू होने
से पहले ही बदल देगा।

awk pipe में बिल्कुल फ़िट बैठता है। हर level की कितनी lines हैं?

```sh
awk '{print $3}' ~/dokument/server.log | sort | uniq -c
```

### दूसरे separators – `-F`

`-F` से आप field separator चुनते हैं। `/etc/passwd` में यह colon है; field 1 user
name है और field 7 shell:

```sh
awk -F: '{print $1, $7}' /etc/passwd
```

`print` में comma output में space बन जाता है। Comma के बिना fields आपस में चिपक जाते
हैं, और तब आप अपना ख़ुद का text भी मिला सकते हैं:

```sh
awk -F: '{print $1 " uses " $7}' /etc/passwd
```

पिछले भाग के `cut -d: -f1` से तुलना कीजिए। फ़र्क़ यह है कि awk fields का order बदल
सकता है, text मिला सकता है और लगातार कई spaces को भी संभाल लेता है।

```predict
$ echo "Alva,matte,87" | awk -F, '{print $3, $1}'
87 Alva
---
`-F,` पंक्ति को कॉमा पर बाँटता है। awk पहले फ़ील्ड 3 छापता है, फिर फ़ील्ड 1,
और `print` में कॉमा की वजह से दोनों के बीच एक स्पेस आता है।
```

### Patterns – lines चुनना

`{ }` से पहले आप एक *pattern* लिख सकते हैं। तब program सिर्फ़ match करने वाली lines के
लिए चलता है। Pattern एक regular expression हो सकता है, जैसे `grep` में:

```sh
awk '/ERROR/ {print $2}' ~/dokument/server.log
```

… या कोई condition। Text double quotes में जाता है:

```sh
awk -F, '$2 == "matte" {print $1, $3}' ~/dokument/betyg.csv
```

(*Matte* Swedish में "गणित" होता है।) तुलना के लिए `==`, `!=`, `<`, `<=`, `>` और `>=`
लिखे जाते हैं, और conditions को `&&` (और), `||` (या) और `!` (नहीं) से जोड़ा जाता है।
ये रहे वे सारे students जिनके कम से कम 90 अंक हैं (`{ }` के बिना पूरी line print होती
है):

```sh
awk -F, '$3 >= 90' ~/dokument/betyg.csv
```

क्या header line भी आ गई? उसमें field 3 शब्द `poäng` है, और जब कोई value number नहीं
होती, तो awk उसकी तुलना *text* की तरह करता है – और alphabetical order में `"poäng"`,
`"90"` के बाद आता है। Header को आप `NR > 1` से छोड़ सकते हैं:

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/dokument/betyg.csv
```

अपना ख़ुद का पैटर्न आज़माइए – उन सभी के नाम जो *svenska* (स्वीडिश) पढ़ते हैं:

```try
awk -F, '$2 == "svenska" {print $1}' ~/dokument/betyg.csv
```

### गिनती – variables और `END`

awk में variables होते हैं जिन्हें declare करने की ज़रूरत नहीं – वे 0 से शुरू होते हैं।
`END { }` block एक बार चलता है, आख़िरी line के **बाद**। दोनों मिलकर किसी column को
जोड़ने का आसान तरीक़ा देते हैं:

```sh
awk -F, 'NR > 1 {summa += $3} END {print summa}' ~/dokument/betyg.csv
```

`summa += $3` का मतलब है "field 3 को summa में जोड़ो" (*summa* Swedish में "जोड़/sum"
है)। अगर आप साथ-साथ lines भी गिनें (`antal++` *antal*, यानी गिनती, को 1 बढ़ाता है),
तो आप औसत निकाल सकते हैं:

```sh
awk -F, 'NR > 1 {summa += $3; antal++} END {print "Average:", summa / antal}' ~/dokument/betyg.csv
```

`BEGIN { }` भी है, जो पहली line से **पहले** चलता है – headings के लिए काम का। और
`printf` से आप ठीक-ठीक तय करते हैं कि output कैसा दिखे: `%-8s` का मतलब है 8 characters
में left-aligned text और `%5d` का मतलब 5 characters में एक integer।

```sh
awk -F, 'BEGIN {print "Student  Score"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/dokument/betyg.csv
```

awk में functions भी हैं, जैसे `length()`, `toupper()` और `tolower()`:

```sh
awk '{print toupper($0)}' ~/dokument/frukter.txt
```

`äpple` और `päron` को ध्यान से देखिए। Ubuntu पर, जिस पर यहाँ का टर्मिनल चलता है,
`awk` डिफ़ॉल्ट रूप से **mawk** है, एक छोटा और तेज़ रूप। इन जैसे सरल प्रोग्रामों में
आपको कोई फ़र्क़ नहीं दिखेगा – लेकिन mawk `toupper()` से å, ä और ö को नहीं बदलता।
**GNU awk** (`gawk` पैकेज) `tr` के उलट उन्हें बदल देता है। डिस्ट्रीब्यूशन इसमें
अलग होते हैं कि वे कौन-सा awk इस्तेमाल करते हैं और सॉफ़्टवेयर कैसे इंस्टॉल किया
जाता है – यह डिस्ट्रीब्यूशन वाले अध्याय में आएगा।

Simulator awk language का सिर्फ़ एक हिस्सा जानता है – जो यहाँ बताया गया है और थोड़ा
और (`if`, loops और arrays)। `man awk` देखिए।

## कौन-सा tool चुनूँ?

| आप चाहते हैं … | इस्तेमाल कीजिए |
|---|---|
| वे lines ढूँढना जिनमें कुछ हो | `grep` |
| अलग-अलग characters बदलना या हटाना | `tr` |
| शब्द या patterns बदलना, lines delete करना | `sed` |
| columns निकालना, numbers की तुलना करना, जोड़ना | `awk` |

असली ताक़त इन्हें मिलाने से आती है। जो lines INFO *नहीं* हैं, उनमें कौन-कौन से levels
हैं – अगर हम upper और lower case को नज़रअंदाज़ करें?

```sh
grep -v INFO ~/dokument/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
