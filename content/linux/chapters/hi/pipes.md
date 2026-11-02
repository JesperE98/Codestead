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
