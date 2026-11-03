# SSH के ऊपर files copy करना

Networking वाले chapter में आपने `ssh` से server `192.168.1.10` पर commands चलाए
थे। यहाँ आप server को एक छोटा नाम देते हैं, `scp` से उस पर और उससे files copy
करते हैं, और `rsync` से पूरी directories को sync में रखते हैं।

## छोटे नाम – `~/.ssh/config`

हर बार `ssh {{user}}@192.168.1.10` टाइप करना जल्दी ही उबाऊ हो जाता है। File
`~/.ssh/config` में आप server को एक छोटा नाम दे सकते हैं:

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` छोटा नाम है, `HostName` असली address (या नाम) और `User` server पर user का
नाम। अगर server 22 के अलावा किसी और port पर listen करता है, तो `Port 2222` जैसी
एक line जोड़िए। उसके बाद इतना काफ़ी है:

```sh
ssh srv hostname
```

Simulator में अभी कोई text editor नहीं है, इसलिए file `echo` से लिखिए।
Indentation सिर्फ़ पढ़ने में आसानी के लिए है:

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

ssh इस file को लेकर सख़्त है। अगर दूसरे उसमें लिख सकते हों, तो ssh
*Bad owner or permissions* कहकर मना कर देता है, और एक ग़लत लिखा शब्द उसे तुरंत रोक
देता है:

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
ssh connect करने से पहले पूरी file पढ़ता है, इसलिए एक ग़लत शब्द हर connection रोक
देता है – और error message बताता है कि वह किस line पर है।
```

ये नाम `scp` और `rsync` के साथ भी काम करते हैं।

```quiz
`~/.ssh/config` में कौन-सी लाइन बताती है कि ssh असल में कहाँ कनेक्ट करे?
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` वह छोटा नाम है जो आप ख़ुद टाइप करते हैं, `HostName` असली पता और `User`
यह कि आप किस यूज़र के रूप में लॉग इन करते हैं।
```

## Copy करना – `scp`

`scp` (*secure copy*) `cp` की तरह काम करता है, लेकिन एक side किसी दूसरे computer पर
हो सकती है। उसे आप `HOST:PATH` लिखते हैं:

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- Source पहले आता है और target आख़िर में, ठीक `cp` की तरह।
- Colon के बाद वाला path server पर आपकी home directory से गिना जाता है, और अकेले
  `srv:` का मतलब home directory है।
- Directories के लिए `-r` चाहिए।
- Port capital `-P` से दिया जाता है (`ssh` में यह छोटा `-p` है)।

हर file के लिए `scp` एक line दिखाता है जिसमें नाम, `100%`, size और speed होती है।

```quiz
आप `scp report.txt srv` टाइप करते हैं – बिना कोलन के। क्या होता है?
- [ ] फ़ाइल सर्वर पर आपकी होम डायरेक्टरी में कॉपी हो जाती है
- [x] आपको `srv` नाम की एक लोकल कॉपी मिलती है
- [ ] scp पूछता है कि आपका मतलब किस कंप्यूटर से है
---
कोलन के बिना `srv` बस एक फ़ाइल का नाम है, और `scp` `cp` की तरह लोकल कॉपी करता है।
कोलन भूलना बहुत आसान है!
```

## Sync में रखना – `rsync`

बहुत सारी files के लिए, या किसी ऐसी चीज़ के लिए जिसे आप बार-बार copy करते हैं
(backups!), `rsync` बेहतर है। यह सिर्फ़ वही copy करता है जो missing है या बदल
गया है:

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{fruits}}
{{grades}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

`-a` (*archive*) directories को recursively copy करता है और permissions और times
बनाए रखता है, और `-v` बताता है कि क्या copy हुआ। वही command दोबारा चलाइए तो list
ख़ाली होगी – कुछ नहीं बदला। rsync हर file का size और modification time मिलाता है;
`-a` के बिना copies को नए times मिलते हैं, और हर बार सब कुछ भेजा जाता है।

### आख़िर का slash

Source के आख़िर में slash होना ज़रूरी बात है:

| Command | नतीजा |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...` – directory ख़ुद |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...` – सिर्फ़ उसके अंदर का content |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
Slash के बिना directory ख़ुद `/tmp/x` के अंदर copy हो गई।
```

### SSH के ऊपर और `--delete`

जब target कोई server हो, तो rsync ssh के ऊपर चलता है:

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

`--delete` target से वे files भी हटा देता है जो source में अब नहीं हैं, ताकि target
एकदम सटीक copy बन जाए। तब एक ग़लत path बहुत कुछ हटा सकता है, इसलिए पहले `-n`
(*dry run*) से आज़माइए। कुछ नहीं होता, rsync सिर्फ़ दिखाता है कि वह क्या करता, और
आख़िरी line `(DRY RUN)` पर ख़त्म होती है:

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
`rsync -avn --delete a/ b/` में `-n` क्या करता है?
- [ ] सिर्फ़ नई फ़ाइलें कॉपी करता है
- [x] कुछ भी किए बिना दिखाता है कि क्या होगा
- [ ] उन फ़ाइलों को छोड़ देता है जो हटाई जातीं
---
`-n` एक आज़माइशी रन है। पहले सूची जाँचिए – फिर वही कमांड `-n` के बिना चलाइए।
```

## scp या rsync?

| | `scp` | `rsync` |
|---|---|---|
| किसके लिए अच्छा | कुछ files, एक बार | Backups और बार-बार copy करना |
| क्या भेजता है | सब कुछ, हर बार | सिर्फ़ जो बदला है |
| Locally भी | चलता है, लेकिन `cp` आसान है | हाँ |
| `--delete` से mirror | नहीं | हाँ |

`scp` ssh client के साथ आता है। `rsync` दोनों computers पर installed होना चाहिए:
Ubuntu, Debian और Fedora पर यह शुरू से होता है, जबकि Arch पर आप package `rsync`
install करते हैं।

Simulator में app बंद करने पर server अपनी files भूल जाता है।
