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

## Single और double quotes

एक ज़रूरी फ़र्क़ है:

```sh
echo "Home: $HOME"
echo 'Home: $HOME'
```

**Double** quotes के अंदर variables अपनी values से बदल जाते हैं। **Single**
quotes के अंदर सब कुछ बिल्कुल वैसा ही print होता है जैसा लिखा गया है।

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

## Exit codes – `$?`

हर command ख़त्म होने पर एक **exit code** छोड़ता है: `0` का मतलब है सब ठीक रहा,
और कुछ भी दूसरा मतलब error। सबसे हाल का exit code `$?` में रखा जाता है:

```sh
ls /finnsinte
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

## Settings save करना – `~/.bashrc`

आपके बनाए variables और aliases terminal बंद करते ही ग़ायब हो जाते हैं। उन्हें
बनाए रखने के लिए आप उन्हें file `~/.bashrc` में लिखते हैं, जिसे bash हर नया
terminal खुलने पर पढ़ता है। File बदलने के बाद आप उसे तुरंत ऐसे load कर सकते हैं:

```sh
source ~/.bashrc
```
