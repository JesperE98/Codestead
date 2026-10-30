# परीक्षा: और टूल

git और दूसरे शेलों के बारे में चौदह प्रश्न। पास होने के लिए आपको 80 % सही उत्तर
चाहिए। कमांड वाले प्रश्न एक नए टर्मिनल में शुरू होते हैं, इसलिए वे पहले अपनी ज़रूरत का
प्रोग्राम इंस्टॉल करते हैं – `> /dev/null 2>&1` उन पंक्तियों का आउटपुट फेंक देता है।

```quiz
आपने `index.html` बदली है और नई फ़ाइल `kontakt.html` बनाई है। आप
`git commit -am "Contact page"` चलाते हैं। कमिट में क्या पहुँचता है?
- [x] सिर्फ़ `index.html` का बदलाव
- [ ] सिर्फ़ `kontakt.html`
- [ ] दोनों फ़ाइलें
---
`-a` हर उस बदली हुई फ़ाइल को जोड़ता है जिस पर git पहले से नज़र रखता है – लेकिन नई
फ़ाइलों को कभी नहीं। `kontakt.html` को पहले `git add` से जोड़ना होगा।
```

```quiz
आपने `style.css` के एक बदलाव पर `git add` चलाया है। कौन-सा कमांड वह बदलाव दिखाता
है?
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` working tree की तुलना index से करता है, इसलिए बदलाव index में पहुँचते ही
वह कुछ नहीं दिखाता। `--staged` दिखाता है कि कमिट होने के लिए क्या इंतज़ार कर रहा है।
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "Elev Elevsson"
$ git config --global user.email "elev@example.com"
$ cd ~/projekt-webb && git init > /dev/null 2>&1
$ git add . && git commit -m "Första versionen" > /dev/null
$ git switch -c ny-design > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "Lila rubriker" > /dev/null
$ git switch main > /dev/null 2>&1
$ git merge ny-design > /dev/null
$ git log --oneline | wc -l
2
---
ब्रांच बनने के बाद से `main` नहीं बदली थी, इसलिए मर्ज एक *fast-forward* था: git ने
सिर्फ़ `main` को आगे `ny-design` के कमिट तक खिसका दिया। कोई मर्ज कमिट नहीं बना।
```

```quiz
तकनीकी रूप से git में ब्रांच क्या है?
- [ ] प्रोजेक्ट की हर फ़ाइल की पूरी कॉपी
- [x] एक लेबल जो किसी कमिट की ओर इशारा करता है और नए कमिट करने पर आगे बढ़ता है
- [ ] अपनी `.git` डायरेक्टरी वाली एक अलग रिपॉज़िटरी
---
इसीलिए git में ब्रांच सस्ती हैं – उन्हें अक्सर इस्तेमाल कीजिए।
```

```quiz
`git merge` `index.html` में एक टकराव के साथ रुक गया। आपने फ़ाइल ठीक कर दी है और
चिह्न वाली पंक्तियाँ हटा दी हैं। आगे आप क्या करते हैं?
- [ ] `git merge` फिर से चलाते हैं
- [x] `git add index.html` और फिर `git commit`
- [ ] `git restore index.html`
---
`git add` git को बताता है कि टकराव सुलझ गया है, और `git commit` मर्ज पूरा करता है।
`git restore` आपका सुधार फेंक देता।
```

```quiz
फ़ाइल `fel.log` ग़लती से कमिट हो गई थी। आप `.gitignore` में `*.log` जोड़ते हैं,
लेकिन git अब भी उस फ़ाइल पर नज़र रखता है। आप उसे रिपॉज़िटरी से कैसे हटाएँगे लेकिन
डिस्क पर रखेंगे?
- [ ] `rm fel.log`
- [x] `git rm --cached fel.log`
- [ ] `git restore fel.log`
---
`.gitignore` सिर्फ़ उन फ़ाइलों पर लागू होती है जिन पर git पहले से नज़र नहीं रखता।
`--cached` फ़ाइल को git से हटा देता है लेकिन डिस्क पर छोड़ देता है।
```

```quiz
कौन-सा कमांड remote से नए कमिट **बिना** उन्हें आपके कमिट से मिलाए लाता है?
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` लाता है और मिलाता है; `git fetch` सिर्फ़ लाता है।
```

```quiz
इनमें से कौन-से बदलाव हमेशा के लिए खो जाते हैं? जो भी लागू हों, सब चुनिए।
- [x] किसी ऐसी फ़ाइल के बदलाव जो कभी कमिट नहीं हुई, `git restore` से फेंके गए
- [x] ऐसे बदलाव जो कभी कमिट नहीं हुए, `git reset --hard` से फेंके गए
- [ ] कल किया गया एक कमिट, जिसके बाद आपने `git reset --hard` चलाया
---
जो कुछ भी कभी कमिट हुआ था, उसे लगभग हमेशा बचाया जा सकता है – `git reflog` दिखाता
है कि आप कहाँ-कहाँ रहे हैं।
```

```quiz
आपने bash से zsh शुरू किया। कौन-सा कमांड वह शेल दिखाता है जो आप अभी चला रहे हैं?
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` आपका लॉगिन शेल है – अब भी `/bin/bash`। `/etc/shells` उन शेलों की सूची है
जो लॉगिन शेल के रूप में इस्तेमाल हो सकते हैं।
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` दशमलव संख्याएँ संभालता है।
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
fish में पिछले कमांड के एग्ज़िट स्टेटस को `$status` कहते हैं – `false` हमेशा विफल
होता है।
```

```quiz
fish में आप `EDITOR` को `nano` मान वाला एनवायरनमेंट वेरिएबल कैसे बनाते हैं?
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` वेरिएबल को एक्सपोर्ट करता है; `-e` उसे मिटा देता है।
```

```quiz
शुरू होने पर zsh कौन-सी फ़ाइल पढ़ता है?
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep elev /etc/passwd
---
पंक्ति का आख़िरी फ़ील्ड आपका लॉगिन शेल है – वही जिसे `chsh -s` बदलता है।
```
