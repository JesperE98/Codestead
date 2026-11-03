# Archives और compression

देर-सवेर आप किसी को पूरी directory भेजना चाहेंगे, backup बनाना चाहेंगे या किसी
program का source code download करेंगे। तब बहुत सारी files को **एक** file बनना होता
है – और हो सके तो छोटी file। Linux पर यह काम आम तौर पर दो अलग programs मिलकर करते हैं।

## Archiving और compressing – दो अलग चीज़ें

- **Archiving** का मतलब है बहुत सारी files और directories को एक अकेली file, यानी
  *archive*, में इकट्ठा करना। Permissions, owners और timestamps भी साथ आते हैं।
  Program का नाम `tar` है (*tape archive* से – इसे 1970 के दशक में tape drives के
  लिए लिखा गया था)। Archive अपने अंदर की files से छोटा **नहीं** होता – बल्कि थोड़ा
  बड़ा ही होता है।
- **Compressing** का मतलब है दोहराव को ज़्यादा चतुराई से encode करके file को छोटा
  बनाना। सबसे आम program `gzip` है। यह एक बार में सिर्फ़ एक file संभालता है और
  directories के बारे में कुछ नहीं जानता।

इसीलिए इन्हें साथ में इस्तेमाल किया जाता है: पहले `tar` से एक अकेली file, फिर `gzip`
से उसे छोटा करना। नतीजे को `.tar.gz` कहते हैं, या छोटे में `.tgz`। यह Unix
philosophy का निचोड़ है – छोटे programs जो हर एक, एक काम करते हैं और जिन्हें आपस में
जोड़ा जा सकता है।

```quiz
`tar` और `gzip` आम तौर पर साथ में क्यों इस्तेमाल किए जाते हैं?
- [ ] `gzip` उन फ़ाइलों को नहीं पढ़ सकता जिन्हें `tar` ने नहीं बनाया
- [x] `tar` बहुत-सी फ़ाइलों को एक में इकट्ठा करता है, और `gzip` उस एक फ़ाइल को छोटा करता है
- [ ] `tar` फ़ाइलों को छोटा करता है, और `gzip` उन्हें सही अनुमतियाँ देता है
---
gzip एक बार में सिर्फ़ एक फ़ाइल संभालता है और डायरेक्टरी के बारे में कुछ नहीं
जानता, और अकेला tar आर्काइव अपनी फ़ाइलों से छोटा नहीं होता।
```

| File extension | यह क्या है? | किससे unpack करें |
|---|---|---|
| `.tar` | Archive, बिना compression | `tar -xf` |
| `.gz` | एक अकेली compressed file | `gunzip` |
| `.tar.gz`, `.tgz` | Compressed archive | `tar -xzf` |
| `.zip` | Archive और compression एक साथ (Windows पर आम) | `unzip` |

आपको `.tar.xz`, `.tar.bz2` और `.tar.zst` भी मिलेंगे। Idea वही है, बस दूसरे
compression programs (`xz`, `bzip2` और `zstd`) के साथ।

## `tar` से pack करना

अपनी home directory में जाइए और `{{documents}}` directory को pack कीजिए:

```sh
cd ~
tar -cvf {{documents}}.tar {{documents}}
```

```text
{{documents}}/
{{documents}}/{{fruits}}
{{documents}}/{{grades}}
{{documents}}/server.log
```

`-c` का मतलब है *archive बनाओ*, `-v` tar से कहता है कि वह जो कर रहा है वह दिखाए, और
`-f` बताता है कि आगे archive file का नाम आ रहा है। Archive के नाम के बाद जो कुछ भी है,
वह pack हो जाता है – जितनी चाहें उतनी files और directories।

> **ध्यान दीजिए!** Order है *पहले archive, फिर files*। अगर आप order उलट दें, जैसे
> `tar -cvf {{documents}} {{documents}}.tar`, तो tar directory को overwrite करने की कोशिश करता
> है – या इससे भी बुरा, किसी ऐसी file को जिसे आप रखना चाहते थे।

## याद रखने लायक़ options

| Option | किसका छोटा रूप | मतलब |
|---|---|---|
| `c` | **c**reate | नया archive बनाना |
| `x` | e**x**tract | Unpack करना |
| `t` | lis**t** (*table of contents*) | Content की list दिखाना |
| `v` | **v**erbose | Process हो रही files दिखाना |
| `f` | **f**ile | आगे archive file का नाम आता है |
| `z` | g**z**ip | gzip से compress या decompress करना |

`c`, `x` और `t` में से ठीक **एक** होना ज़रूरी है – वह tar को बताता है कि *क्या* करना
है। बाक़ी modifiers हैं। याद रखने का एक आम तरीक़ा (अंग्रेज़ी में):

- **c**reate **z**ipped **v**erbose **f**ile → `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile → `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile → `tar -tzvf`

Options को साथ में लिखते समय `f` को हमेशा **आख़िर** में रखिए, क्योंकि file का नाम ठीक
उसके बाद आना चाहिए। ऐतिहासिक कारणों से आप dash छोड़ भी सकते हैं: `tar czvf` का मतलब
वही है जो `tar -czvf` का।

```quiz
`tar -xzvf backup.tar.gz` क्या करता है?
- [ ] संपीड़ित (compressed) आर्काइव `backup.tar.gz` बनाता है
- [ ] `backup.tar.gz` को अनपैक किए बिना उसकी सामग्री की सूची दिखाता है
- [x] `backup.tar.gz` को gzip से अनपैक करता है और हर फ़ाइल दिखाता है
---
`x` ऑपरेशन है (extract), `z` का मतलब gzip, `v` फ़ाइलें दिखाता है और `f` के बाद
आर्काइव का नाम आता है।
```

## `-z` से compress करना

`z` जोड़िए और archive रास्ते में gzip से होकर गुज़रता है:

```sh
tar -czvf {{documents}}.tar.gz {{documents}}
ls -l {{documents}}.tar {{documents}}.tar.gz
```

```text
-rw-r--r-- 1 {{user}} {{user}} 10240 Oct 30 12:00 {{documents}}.tar
-rw-r--r-- 1 {{user}} {{user}}   892 Oct 30 12:00 {{documents}}.tar.gz
```

बिना compression वाला archive पूरे 10,240 bytes का है, जबकि फ़ाइलें मिलाकर 1,000
bytes से थोड़ी ज़्यादा हैं। ऐसा इसलिए है क्योंकि tar हर file से पहले 512 bytes का एक header लगाता
है और archive को पूरे blocks तक भर देता है। वह सारी ख़ाली जगह gzip compress करके
हटा देता है।

`du` command (*disk usage*) दिखाता है कि कोई चीज़ disk पर कितनी जगह लेती है। `-h` से
आपको इंसानों के पढ़ने लायक़ sizes मिलते हैं, और `-s` से पूरी directory का कुल जोड़:

```sh
du -h {{documents}}.tar {{documents}}.tar.gz
du -sh {{documents}}
```

```text
12K	{{documents}}.tar
4.0K	{{documents}}.tar.gz
16K	{{documents}}
```

Disk 4 KiB के blocks में बँटी होती है, इसलिए किसी ख़ाली न होने वाली file के लिए `du`
कभी `4.0K` से कम नहीं दिखाता। सटीक size देखने के लिए `ls -l` (या `ls -lh`) इस्तेमाल
कीजिए।

## Unpack करने से पहले archive के अंदर देखिए

```sh
tar -tzvf {{documents}}.tar.gz
```

```text
drwxr-xr-x {{user}}/{{user}}   0 2026-10-30 12:00 {{documents}}/
-rw-r--r-- {{user}}/{{user}} 127 2026-10-30 12:00 {{documents}}/{{fruits}}
-rw-r--r-- {{user}}/{{user}} 244 2026-10-30 12:00 {{documents}}/{{grades}}
-rw-r--r-- {{user}}/{{user}} 824 2026-10-30 12:00 {{documents}}/server.log
```

`v` के साथ content `ls -l` की तरह दिखता है, permissions, owner और size के साथ। पहले
देख लेना एक अच्छी आदत है: कुछ archives में कोई common top-level directory नहीं होती,
और unpack करते समय आप जहाँ भी हों, वहीं सैकड़ों files बिखर जाती हैं।

## Unpack करना

```sh
mkdir {{unpacked}}
tar -xzvf {{documents}}.tar.gz -C {{unpacked}}
```

`-C` (capital C) वह directory चुनता है जिसमें tar unpack करता है। इसके बिना सब कुछ उसी
directory में पहुँच जाता है जिसमें आप हैं।
tar के modern versions unpack करते समय ख़ुद पहचान लेते हैं कि archive compressed है या
नहीं, इसलिए `tar -xf {{documents}}.tar.gz` भी काम करता है।

> **सावधान!** पहले से मौजूद files को overwrite करने से पहले tar कुछ नहीं पूछता। अगर
> आप पक्का न हों, तो पहले content की list देख लीजिए।

### Absolute paths

अगर आप कोई absolute path pack करते हैं, तो शुरुआत का `/` हटा दिया जाता है, ताकि
archive को कहीं भी unpack किया जा सके:

```sh
tar -czf backup.tar.gz ~/{{documents}}
```

```text
tar: Removing leading `/' from member names
```

अब archive में `home/{{user}}/{{documents}}/...` है। अगर आप archive में सिर्फ़ `{{documents}}/`
चाहते हैं, तो `-C` से tar को पहले directory बदलने दीजिए:

```sh
tar -czf backup.tar.gz -C ~ {{documents}}
tar -tzf backup.tar.gz
```

```quiz
आप `tar -czf backup.tar.gz -C ~ {{documents}}` चलाते हैं। आर्काइव में क्या है?
- [x] `{{documents}}/` और उसके अंदर की फ़ाइलें
- [ ] `home/{{user}}/{{documents}}/` और उसके अंदर की फ़ाइलें
- [ ] `/home/{{user}}/{{documents}}/` और उसके अंदर की फ़ाइलें
---
`-C ~` से tar पहले आपकी होम डायरेक्टरी में जाता है, इसलिए आर्काइव में नाम
`{{documents}}/` से शुरू होते हैं।
```

## `gzip` से अकेली files compress करना

`gzip` एक file को compress करता है और उसे एक `.gz` file से **बदल** देता है।
Permissions और timestamp बने रहते हैं:

```sh
cp {{documents}}/server.log .
gzip -v server.log
```

```text
server.log:	 39.8% -- replaced with server.log.gz
```

`gzip -l` पहले और बाद का size दिखाता है, और `gunzip` file को फिर से unpack करता है:

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

अगर आप original रखना चाहते हैं, तो `gzip -k` (*keep*) इस्तेमाल कीजिए। इसे किसी बहुत
छोटी file पर आज़माइए – वह असल में **बड़ी** हो जाती है, क्योंकि gzip एक header जोड़ता
है जिसमें दूसरी चीज़ों के साथ file का नाम भी होता है:

```sh
cp {{old}}/{{oldNotes}} .
gzip -kv {{oldNotes}}
```

```text
{{oldNotes}}:	-51.6% -- created {{oldNotes}}.gz
```

```predict
$ cp {{documents}}/{{fruits}} .
$ cp {{documents}}/server.log .
$ gzip {{fruits}}
$ gzip -k server.log
$ ls {{fruits}}* server*
{{fruits}}.gz  server.log  server.log.gz
---
सादा `gzip` फ़ाइल को `.gz` फ़ाइल से बदल देता है; `-k` मूल फ़ाइल को बनाए रखता है।
```

### Compressed files को सीधे पढ़ना

`/var/log` की पुरानी log files जगह बचाने के लिए अक्सर `.gz` के रूप में रखी जाती हैं।
`zcat` से आप उन्हें unpack किए बिना पढ़ सकते हैं – और नतीजे को हमेशा की तरह pipe से
आगे भेज सकते हैं:

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

`zcat` वही है जो `gzip -dc`: decompress (`d`) करके standard output (`c`) पर भेजो।
असली system पर `zless` और `zgrep` भी होते हैं।

## zip – Windows के साथ share करने के लिए

`.zip` format दोनों काम एक साथ करता है: यह files इकट्ठा *भी* करता है और उन्हें
compress भी करता है। Windows और macOS बिना किसी extra software के zip files खोल सकते
हैं, इसलिए जब आप किसी ऐसे व्यक्ति को files भेज रहे हों जो Linux नहीं चलाता, तो यही
स्वाभाविक विकल्प है। Linux की दुनिया में `.tar.gz` ज़्यादा आम है, क्योंकि यह owners और
permissions को बेहतर तरीक़े से बचाकर रखता है।

प्रोग्राम `zip` और `unzip` हमेशा पहले से इंस्टॉल नहीं होते, और इस टर्मिनल में आपको
उन्हें पहले इंस्टॉल करना होगा। यह पैकेज मैनेजर से होता है – इसके बारे में आप
डिस्ट्रीब्यूशन और पैकेज वाले भाग में सब कुछ सीखेंगे। Ubuntu पर यह ऐसे होता है:

```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` उपलब्ध packages की list download करता है। इसके बिना apt को कोई package
मिलता ही नहीं।

फिर directory को pack कीजिए। `-r` (*recursive*) मत भूलिए – इसके बिना zip सिर्फ़ ख़ाली
directory जोड़ता है, उसके अंदर की files नहीं:

```sh
zip -r {{documents}}.zip {{documents}}
```

```text
  adding: {{documents}}/ (stored 0%)
  adding: {{documents}}/{{fruits}} (deflated 39%)
  adding: {{documents}}/{{grades}} (deflated 34%)
  adding: {{documents}}/server.log (deflated 43%)
```

ध्यान दीजिए कि order वही है जो tar में: पहले archive, फिर files। `unzip -l` content की
list दिखाता है, और `-d` चुनता है कि कहाँ unpack करना है (directory मौजूद न हो तो बन
जाती है):

```sh
unzip -l {{documents}}.zip
unzip {{documents}}.zip -d {{fromZip}}
```

अगर files पहले से मौजूद हैं, तो unzip उन्हें छोड़ देता है। `unzip -o` के साथ वे
overwrite हो जाती हैं।

```quiz
आप `-r` के बिना `zip {{documents}}.zip {{documents}}` चलाते हैं। zip फ़ाइल में क्या पहुँचता है?
- [ ] `{{documents}}` की सभी फ़ाइलें
- [x] सिर्फ़ ख़ाली डायरेक्टरी `{{documents}}/`
- [ ] कुछ नहीं – zip चलने से मना कर देता है
---
`-r` (*recursive*) के बिना zip डायरेक्टरी के अंदर नहीं जाता।
```

## सारांश

| अगर आप चाहते हैं ... | Command |
|---|---|
| किसी directory को pack और compress करना | `tar -czvf archive.tar.gz directory` |
| देखना कि archive में क्या है | `tar -tzvf archive.tar.gz` |
| Archive unpack करना | `tar -xzvf archive.tar.gz` (`-C directory` जोड़िए) |
| कोई file compress करना | `gzip file` (या `gzip -k file`) |
| `.gz` file unpack करना | `gunzip file.gz` |
| `.gz` file सीधे पढ़ना | `zcat file.gz` |
| zip file बनाना या unpack करना | `zip -r archive.zip directory` · `unzip archive.zip` |
| देखना कि कोई चीज़ कितनी बड़ी है | `du -sh directory` · `ls -lh` |
