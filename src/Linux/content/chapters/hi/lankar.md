# Links और file की जानकारी

Linux पर file का नाम और उसका content दो अलग चीज़ें हैं। इस chapter में आप इसका
फ़ायदा उठाकर **links** से shortcuts बनाते हैं, `stat` और `file` से files की जाँच
करना सीखते हैं, और `umask` से तय करते हैं कि नई files को कौन-सी permissions मिलें।

## नाम और inodes

File का content – उसके owner, permissions और times के साथ – एक **inode** में
रखा जाता है। Directory बस नामों की एक list है, और हर नाम किसी inode की ओर
इशारा करता है। `ls -i` हर नाम के आगे inode number दिखाता है:

```sh
ls -i
```

## Symbolic links – `ln -s`

**Symbolic link** (*symlink*) एक छोटी file है जिसमें किसी और चीज़ का path होता
है – यानी एक shortcut। Target पहले आता है और link का नाम आख़िर में, ठीक `cp` की
तरह:

```sh
ln -s /var/log ~/log
ls -l ~/log
```

```text
lrwxrwxrwx 1 {{user}} {{user}} 8 Nov  3 10:15 /home/{{user}}/log -> /var/log
```

Line की शुरुआत में `l` और तीर `->` बताते हैं कि यह एक link है। इसकी permissions
हमेशा `rwxrwxrwx` होती हैं – उनका कोई मतलब नहीं, असल में target की permissions
मायने रखती हैं।

लगभग हर command link के पीछे जाता है: `ls ~/log/`, `cat`, `cd` वग़ैरह। `cd` याद
रखता है कि आप किस रास्ते से आए, और `pwd -P` दिखाता है कि आप असल में कहाँ हैं:

```sh
cd ~/log
pwd
pwd -P
```

### Relative links

Link में relative path उस directory से गिना जाता है **जहाँ link है** – उस जगह से
नहीं जहाँ आप link बनाते समय हैं:

```sh
cd ~
ln -s {{documents}}/{{fruits}} {{fruits}}
cat {{fruits}}
```

यह काम करता है, क्योंकि link आपकी home directory में है और
`{{documents}}/{{fruits}}` वहीं है। उसी content वाला link `/tmp/f`
`/tmp/{{documents}}/{{fruits}}` ढूँढेगा – और टूटा हुआ होगा।

`readlink` दिखाता है कि link में क्या लिखा है, और `realpath` हर link के पीछे जाकर
पूरा path दिखाता है:

```sh
readlink {{fruits}}
realpath {{fruits}}
```

### टूटे हुए links

Link किसी ऐसी चीज़ की ओर भी इशारा कर सकता है जो मौजूद ही नहीं है:

```predict
$ ln -s nowhere.txt broken
$ cat broken
cat: broken: No such file or directory
---
Link मौजूद है, लेकिन वह file नहीं जिसकी ओर वह इशारा करता है। `ls -l` टूटे हुए
link को लाल रंग में दिखाता है, और `find ~ -type l` आपकी home directory के सारे
links ढूँढ देता है।
```

`rm` link को ही हटाता है, उस चीज़ को कभी नहीं जिसकी ओर वह इशारा करता है।

```quiz
आपके पास लिंक `~/log -> /var/log` है और आप `rm ~/log` चलाते हैं। क्या होता है?
- [ ] `/var/log` और उसके अंदर का सब कुछ हट जाता है
- [x] सिर्फ़ लिंक हटता है – `/var/log` को कुछ नहीं होता
- [ ] `rm` मना कर देता है, क्योंकि `~/log` एक डायरेक्टरी है
---
`rm` लिंक पर ही काम करता है। टारगेट को हटाने के लिए आपको टारगेट का नाम देना
पड़ता।
```

### Links कहाँ मिलते हैं

Linux system में links हर जगह हैं। `python3` अक्सर किसी ख़ास version, जैसे
`python3.12`, का link होता है, और जब आप आगे चलकर `systemctl enable` से किसी service
को boot पर start करवाते हैं, तो systemd उसकी unit file का एक link बनाता है। Boot
पर start होने वाली services देखिए:

```try
ls -l /etc/systemd/system/multi-user.target.wants
```

## Hard links – `ln`

`-s` के बिना `ln` एक **hard link** बनाता है: उसी inode के लिए एक और नाम।

```sh
ln {{notes}} {{todo}}
ls -li {{notes}} {{todo}}
```

```text
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{notes}}
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{todo}}
```

दोनों नामों का inode number एक ही है, और permissions के बाद वाला number – **link
count** – अब 2 है। यह एक ही file है: एक नाम से किया गया बदलाव दूसरे नाम से भी
दिखता है। अगर आप एक नाम हटा दें, तो content तब तक बना रहता है जब तक file का कम
से कम एक नाम बचा है।

```predict
$ echo hello > a.txt
$ ln a.txt b.txt
$ echo again >> b.txt
$ rm b.txt
$ cat a.txt
hello
again
---
`a.txt` और `b.txt` एक ही file थीं। `b.txt` के ज़रिए लिखी गई line `b.txt` हटाने
के बाद भी मौजूद है।
```

| | Symbolic link (`ln -s`) | Hard link (`ln`) |
|---|---|---|
| क्या है | Path वाली एक छोटी file | उसी inode का एक और नाम |
| Directory की ओर | हाँ | नहीं |
| दूसरे file system की ओर | हाँ | नहीं – inodes एक ही file system के होते हैं |
| अगर original हटा दिया जाए | Link टूट जाता है | File बनी रहती है |
| `ls -l` में | `l` और `->` | Link count बढ़ जाता है |

```quiz
किस तरह का लिंक किसी डायरेक्टरी की ओर इशारा कर सकता है?
- [x] सिर्फ़ सिम्बॉलिक लिंक
- [ ] सिर्फ़ हार्ड लिंक
- [ ] दोनों
---
डायरेक्टरी के हार्ड लिंक की इजाज़त नहीं है। किसी डायरेक्टरी का शॉर्टकट बनाने के
लिए `ln -s` इस्तेमाल कीजिए।
```

## File के बारे में सब कुछ – `stat`

`stat` वह सब दिखाता है जो inode जानता है:

```sh
stat /etc/hostname
```

```text
  File: /etc/hostname
  Size: 7         	Blocks: 8          IO Block: 4096   regular file
Device: 8,3	Inode: 1310755     Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-11-03 10:15:22.000000000 +0100
Modify: 2026-11-03 10:15:22.000000000 +0100
Change: 2026-11-03 10:15:22.000000000 +0100
 Birth: 2026-11-03 10:15:22.000000000 +0100
```

आपको size, inode number, links की गिनती, permissions अंकों (`0644`) और अक्षरों
दोनों में, owner और group, और यह मिलता है कि file कब पढ़ी गई, कब modify हुई और
कब बदली। `-c` से आप ठीक-ठीक चुनते हैं कि क्या दिखाना है: `%a` अंकों में
permissions है, `%U` owner और `%n` नाम।

```predict
$ stat -c '%a %U' /etc/shadow
640 root
```

## इसमें क्या है? – `file`

Linux को file के नाम के extension से कोई मतलब नहीं: `.jpg` नाम की file में कुछ भी
हो सकता है। `file` इसकी जगह content को देखता है:

```sh
file /usr/bin/ls {{documents}}/{{grades}} /etc
```

```predict
$ echo hello > {{vacationPic}}
$ file {{vacationPic}}
{{vacationPic}}: ASCII text
---
नाम `.jpg` पर ख़त्म होता है, लेकिन content text है – और `file` content के हिसाब
से ही बताता है।
```

## नई files की permissions – `umask`

नई files को permissions `rw-rw-rw-` (666) मिलती हैं और नई directories को
`rwxrwxrwx` (777) – **umask** के bits घटाकर। `umask` उसे दिखाता है:

```sh
umask
```

आम umask `0022` group और others से write permission हटा देता है, इसीलिए आपकी
files को `644` और directories को `755` मिलता है।

| umask | नई files | नई directories | मतलब |
|---|---|---|---|
| `022` | `644` `rw-r--r--` | `755` `rwxr-xr-x` | आम setting |
| `027` | `640` `rw-r-----` | `750` `rwxr-x---` | Group पढ़ सकता है, others कुछ नहीं |
| `077` | `600` `rw-------` | `700` `rwx------` | सिर्फ़ आप |

```predict
$ umask 027
$ touch plan.txt
$ stat -c %a plan.txt
640
---
666 में से 027 घटाइए: group का `w` चला जाता है, और others का सब कुछ।
```

`umask` सिर्फ़ उन files पर असर डालता है जो बाद में बनती हैं, और सिर्फ़ उसी shell
में जहाँ आपने उसे चलाया। Umask को बनाए रखने के लिए line को `~/.bashrc` में डाल
दीजिए।

```quiz
आपका umask `077` है। नई डायरेक्टरी को कौन-सी अनुमतियाँ मिलती हैं?
- [ ] `755`
- [ ] `600`
- [x] `700`
---
डायरेक्टरी 777 से शुरू होती हैं। 777 में से 077 घटाने पर 700 बचता है: आपके लिए
सब कुछ, बाक़ी किसी के लिए कुछ नहीं।
```
