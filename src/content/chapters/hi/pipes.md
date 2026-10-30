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

## File से – `<`

`<` किसी program को उसका stdin एक file से पढ़ने देता है:

```sh
wc -l < dokument/frukter.txt
```

## Error messages – `2>`

Error messages stderr में जाते हैं और `>` का उन पर कोई असर नहीं होता। उन्हें
संभालने के लिए stream का number आगे लिखिए:

```sh
ls /finnsinte 2> fel.txt
```

(*Finns inte* Swedish में "मौजूद नहीं है" होता है, और *fel* का मतलब है "error"।)

File `/dev/null` एक "black hole" है – उसमें जो कुछ भी लिखा जाए, ग़ायब हो जाता
है। Errors को चुप कराने के लिए यह बहुत काम का है। `2>&1` से stderr को भी वहीं
भेजा जाता है जहाँ stdout जा रहा है।

## Pipes – `|`

एक **pipe** एक command का stdout सीधे अगले command के stdin में भेज देता है। यही
Unix philosophy का दिल है: *एक काम करो और उसे अच्छी तरह करो, और programs को
मिलकर काम करने दो*।

```sh
grep INFO dokument/server.log | wc -l
```

`grep` lines ढूँढता है और `wc -l` उन्हें गिनता है। आप जितने चाहें उतने commands
जोड़ सकते हैं:

```sh
sort dokument/frukter.txt | uniq -c | sort -rn
```

इसे step by step पढ़िए: फलों को sort करो, गिनो कि हर फल कितनी बार है
(`uniq -c`), और फिर numbers के हिसाब से sort करो, सबसे बड़ा पहले (`sort -rn`)।

## Screen और file दोनों – `tee`

`tee` अपना input आगे भी भेजता है *और* उसकी एक copy file में save भी करता है:

```sh
ls /etc | tee etc-lista.txt | wc -l
```

## Chains – `;`, `&&` और `||`

एक ही line में कई commands लिखे जा सकते हैं:

| Syntax | मतलब |
|---|---|
| `a ; b` | a चलाओ, फिर b |
| `a && b` | b तभी चलाओ जब a सफल रहा हो |
| `a \|\| b` | b तभी चलाओ जब a fail हुआ हो |

```sh
mkdir -p ny && cd ny
```
