# Redirection और pipes

यह chapter उस चीज़ के बारे में है जो command line को इतना ताक़तवर बनाती है: छोटे
programs को आपस में *जोड़ना*।

## तीन streams

हर program के तीन standard streams होते हैं:

| Number | नाम | क्या |
|---|---|---|
| 0 | stdin | Input, आम तौर पर keyboard से |
| 1 | stdout | सामान्य output, आम तौर पर screen पर |
| 2 | stderr | Error messages, ये भी screen पर |

*Redirection* और *pipes* से आप इन streams को कहीं और भेज सकते हैं।

## File में – `>` और `>>`

`>` stdout को screen की जगह एक file में भेजता है। File मौजूद न हो तो बन जाती
है – और अगर मौजूद हो तो **overwrite** हो जाती है!

```sh
echo "पहली line" > test.txt
```

`>>` इसके बजाय file के आख़िर में जोड़ता (append करता) है:

```sh
echo "दूसरी line" >> test.txt
cat test.txt
```

```predict
$ echo one > t.txt
$ echo two > t.txt
$ cat t.txt
two
---
दूसरे `>` ने फ़ाइल को ओवरराइट कर दिया। `>>` के साथ उसमें दोनों पंक्तियाँ होतीं।
```

## File से – `<`

`{{fruits}}` में दस पंक्तियाँ हैं, हर पंक्ति में एक फल। जब आप `wc -l` को file का नाम
देते हैं, तो वह पंक्तियों की संख्या और उसके बाद नाम छापता है – यहाँ `{{grades}}` के
लिए, जिसमें नौ पंक्तियाँ हैं:

```sh
wc -l {{documents}}/{{grades}}
```

```text
9 {{documents}}/{{grades}}
```

`<` किसी program को उसका stdin एक file से पढ़ने देता है:

```sh
wc -l < {{documents}}/{{fruits}}
```

अब `wc` को फ़ाइल का नाम दिखता ही नहीं – उसे stdin पर सिर्फ़ टेक्स्ट मिलता है –
इसलिए वह सिर्फ़ संख्या छापता है।

```predict
$ wc -l {{documents}}/{{fruits}}
$ wc -l < {{documents}}/{{fruits}}
10 {{documents}}/{{fruits}}
10
---
आर्ग्युमेंट के रूप में फ़ाइल का नाम मिलने पर `wc` नाम भी छापता है। `<` के साथ उसे
सिर्फ़ टेक्स्ट मिलता है।
```

## Error messages – `2>`

Error messages stderr में जाते हैं और `>` का उन पर कोई असर नहीं होता। उन्हें
संभालने के लिए stream का number आगे लिखिए:

```sh
ls /{{missing}} 2> errors.txt
```

```quiz
आप `ls /{{missing}} > errors.txt` चलाते हैं। त्रुटि संदेश कहाँ पहुँचता है?
- [ ] `errors.txt` में
- [x] स्क्रीन पर – `errors.txt` ख़ाली रहती है
- [ ] कहीं नहीं, वह ग़ायब हो जाता है
---
`>` सिर्फ़ stdout (स्ट्रीम 1) को रीडायरेक्ट करता है। त्रुटि संदेश stderr
(स्ट्रीम 2) में जाता है, जो अब भी स्क्रीन पर जाती है। इसके लिए `2>` चाहिए।
```

File `/dev/null` एक "black hole" है – उसमें जो कुछ भी लिखा जाए, ग़ायब हो जाता
है। Errors को चुप कराने के लिए यह बहुत काम का है। `2>&1` से stderr को भी वहीं
भेजा जाता है जहाँ stdout जा रहा है।

## Pipes – `|`

एक **pipe** एक command का stdout सीधे अगले command के stdin में भेज देता है। यही
Unix philosophy का दिल है: *एक काम करो और उसे अच्छी तरह करो, और programs को
मिलकर काम करने दो*।

```sh
grep INFO {{documents}}/server.log | wc -l
```

`grep` lines ढूँढता है और `wc -l` उन्हें गिनता है। आप जितने चाहें उतने commands
जोड़ सकते हैं:

```sh
sort {{documents}}/{{fruits}} | uniq -c | sort -rn
```

इसे step by step पढ़िए: फलों को sort करो, गिनो कि हर फल कितनी बार है
(`uniq -c`), और फिर numbers के हिसाब से sort करो, सबसे बड़ा पहले (`sort -rn`)।

`/etc` में कितनी फ़ाइलें और डायरेक्टरी हैं? पाइप से गिनिए:

```try
ls /etc | wc -l
```

## Characters बदलना – `tr`

`tr` (*translate*) पहले set के हर character को दूसरे set में उसी जगह वाले character
से बदल देता है। `a-z` का मतलब है a से z तक के सारे letters:

```sh
echo "hello from café" | tr a-z A-Z
```

```text
HELLO FROM CAFé
```

é पर ध्यान गया? `tr` अलग-अलग *bytes* पर काम करता है, और é जैसे letters `a-z` का
हिस्सा नहीं हैं।

`tr` **सिर्फ़** stdin से पढ़ता है, files से कभी नहीं। अगर आप कोई file इस्तेमाल करना
चाहते हैं, तो उसे `<` या pipe से अंदर भेजिए:

```sh
tr a-z A-Z < ~/{{documents}}/{{fruits}}
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

## Input से arguments तक – `xargs`

कुछ commands pipe से पढ़ते ही नहीं – उन्हें नाम **arguments** के रूप में चाहिए:
`rm`, `mkdir`, `touch`, और `wc` जब उसे files के अंदर गिनना हो। `xargs` यह कमी पूरी
करता है: वह अपने input के शब्द पढ़ता है और उन्हें किसी command के बाद लगा देता है।

```sh
find {{documents}} -type f | xargs wc -l
```

यह वैसा ही है जैसे आप हर file का नाम ख़ुद `wc -l` के बाद लिखें। `-n 1` के साथ
`xargs` हर शब्द के लिए command एक बार चलाता है, और `-I {}` के साथ हर line के लिए
एक बार, `{}` की जगह वह line रखकर:

```sh
ls {{documents}} | xargs -I {} echo "File: {}"
```

```predict
$ printf 'a\nb\nc\n' | xargs echo
a b c
---
`xargs` ने तीनों lines इकट्ठा कीं और `echo a b c` चलाया – एक बार।
```

## Screen और file दोनों – `tee`

`tee` अपना input आगे भी भेजता है *और* उसकी एक copy file में save भी करता है:

```sh
ls /etc | tee etc-list.txt | wc -l
```

## Chains – `;`, `&&` और `||`

एक ही line में कई commands लिखे जा सकते हैं:

| Syntax | मतलब |
|---|---|
| `a ; b` | a चलाओ, फिर b |
| `a && b` | b तभी चलाओ जब a सफल रहा हो |
| `a \|\| b` | b तभी चलाओ जब a fail हुआ हो |

```sh
mkdir -p new && cd new
```

```predict
$ mkdir {{documents}} 2> /dev/null && echo created || echo failed
failed
---
`{{documents}}` पहले से मौजूद है, इसलिए `mkdir` विफल होता है (उसका त्रुटि संदेश
`/dev/null` में ग़ायब हो जाता है)। `echo created` छोड़ दिया जाता है और `echo failed` चलता है।
```
