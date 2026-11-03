# Variables, PATH और aliases

Shell की अपनी एक memory होती है, **variables** के रूप में। इस chapter में आप
सीखेंगे कि उन्हें कैसे पढ़ें और set करें, shell programs को कैसे ढूँढता है, और
अपने ख़ुद के shortcuts कैसे बनाएँ।

## Environment variables

किसी variable को पढ़ने के लिए उसके नाम के आगे `$` लगाइए:

```sh
echo $HOME
echo "मेरा नाम $USER है"
```

`env` सारे *environment variables* की list दिखाता है – ऐसे variables जिन्हें आपके
चलाए हुए programs भी पढ़ सकते हैं:

```sh
env
```

Variable `NAME=value` से बनाया जाता है (`=` के आसपास कोई space नहीं!)। `export`
से वह environment variable बन जाता है:

```sh
export EDITOR=nano
```

```quiz
कौन-सी पंक्ति वेरिएबल `COLOR` को मान `blue` के साथ बनाती है?
- [ ] `COLOR = blue`
- [x] `COLOR=blue`
- [ ] `$COLOR=blue`
---
`=` के आसपास कोई स्पेस नहीं होना चाहिए। स्पेस होने पर शेल `COLOR` को एक कमांड
समझता है। `$` सिर्फ़ तब लगता है जब आप वेरिएबल को *पढ़ते* हैं।
```

## Single और double quotes

एक ज़रूरी फ़र्क़ है:

```sh
echo "Home: $HOME"
echo 'Home: $HOME'
```

**Double** quotes के अंदर variables अपनी values से बदल जाते हैं। **Single**
quotes के अंदर सब कुछ बिल्कुल वैसा ही print होता है जैसा लिखा गया है।

```predict
$ x=linux
$ echo "I like $x"
$ echo 'I like $x'
I like linux
I like $x
```

## PATH – commands कहाँ मिलते हैं?

जब आप `ls` टाइप करते हैं, तो shell `ls` नाम की file को `PATH` variable में दी
गई directories में, एक-एक करके, ढूँढता है:

```sh
echo $PATH
```

`which` बताता है कि कोई program कहाँ मिला। कुछ commands, जैसे `cd`, files हैं ही
नहीं बल्कि shell में *built in* हैं – `type` बताता है कि कोई नाम असल में क्या है:

```sh
which ls
type cd
```

अगर आप कोई ऐसा program चलाना चाहते हैं जो `PATH` में नहीं है, तो आपको उसका path
देना होगा, जैसे जिस directory में आप हैं उसकी किसी file के लिए `./myprogram`।

```quiz
जिस डायरेक्टरी में आप हैं, उसमें `hello` नाम का एक प्रोग्राम है, और वह
डायरेक्टरी `PATH` में नहीं है। आप उसे कैसे चलाएँगे?
- [ ] `hello`
- [x] `./hello`
- [ ] `type hello`
---
पाथ के बिना शेल सिर्फ़ `PATH` की डायरेक्टरी में ढूँढता है। `./hello`
ठीक-ठीक बताता है कि फ़ाइल कहाँ है: मौजूदा डायरेक्टरी में।
```

## Exit codes – `$?`

हर command ख़त्म होने पर एक **exit code** छोड़ता है: `0` का मतलब है सब ठीक रहा,
और कुछ भी दूसरा मतलब error। सबसे हाल का exit code `$?` में रखा जाता है:

```sh
ls /{{missing}}
echo $?
```

`&&` और `||` इसी exit code को देखते हैं।

## Aliases

एक **alias** आपका अपना shortcut होता है:

```sh
alias ll='ls -la'
ll
```

Arguments के बिना `alias` सारे aliases की list दिखाता है, और `unalias ll` एक
alias हटा देता है।

```predict
$ alias hello='echo नमस्ते'
$ hello
नमस्ते
```

## Settings save करना – `~/.bashrc`

आपके बनाए variables और aliases terminal बंद करते ही ग़ायब हो जाते हैं। उन्हें
बनाए रखने के लिए आप उन्हें file `~/.bashrc` में लिखते हैं, जिसे bash हर नया
terminal खुलने पर पढ़ता है। File बदलने के बाद आप उसे तुरंत ऐसे load कर सकते हैं:

```sh
source ~/.bashrc
```

```quiz
आप एक alias बनाते हैं, टर्मिनल बंद करते हैं और नया खोलते हैं। alias
ग़ायब है। आपको क्या करना चाहिए था?
- [ ] आर्ग्युमेंट के बिना `alias` चलाना
- [x] alias को `~/.bashrc` में डालना
- [ ] उसे `export` से बनाना
---
जो कुछ भी आप `~/.bashrc` में डालते हैं, वह हर बार नया टर्मिनल खुलने पर फिर से
पढ़ा जाता है।
```
