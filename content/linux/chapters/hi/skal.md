# दूसरे shells: zsh और fish

अब तक आपने हर command **bash** में टाइप किया है। लेकिन bash कई shells में से
सिर्फ़ एक है – और बहुत-से लोग कुछ और पसंद करते हैं। इस chapter में आप दो लोकप्रिय
विकल्प, **zsh** और **fish**, install करेंगे, उन्हें आज़माएँगे और देखेंगे कि वे bash
से कैसे अलग हैं। आप यह भी सीखेंगे कि scripts अब भी लगभग हमेशा bash के लिए ही क्यों
लिखे जाते हैं।

## Shell आख़िर है क्या?

**Shell** वह program है जो आपका टाइप किया हुआ पढ़ता है, उसका मतलब निकालता है और
दूसरे programs start करता है। `|`, `>`, `$VARIABLES`, `*.txt` जैसे wildcards और
loops को shell ही समझता है। Terminal बस वह window है जिसमें shell चलता है।

`ls`, `grep` और `cat` जैसे programs `/usr/bin` में अलग programs हैं – आप कोई भी
shell इस्तेमाल करें, वे एक जैसे काम करते हैं। Shells के बीच जो अलग होता है, वह है
**उनके आसपास की भाषा**: variables कैसे set होते हैं, loops और conditions कैसे लिखे
जाते हैं, prompt कैसा दिखता है और कौन-सी सुविधाएँ मिलती हैं।

```quiz
आप bash से किसी दूसरे शेल पर जाते हैं। इनमें से क्या बिल्कुल वैसा ही रहता है?
- [ ] आप वेरिएबल कैसे सेट करते हैं
- [ ] आप लूप कैसे लिखते हैं
- [x] `grep` अपने ऑप्शनों के साथ क्या करता है
- [ ] प्रॉम्प्ट कैसा दिखता है
---
`grep` `/usr/bin` में एक अलग प्रोग्राम है। शेल उसे सिर्फ़ शुरू करता है – शेलों के
बीच उसके आसपास की भाषा अलग होती है।
```

## वंश-वृक्ष: sh, bash, zsh और fish

| Shell | कब से | ख़ासियतें |
|---|---|---|
| `sh` | 1979 | Bourne shell। आज का `sh` **POSIX** standard को मानता है और सबसे बुनियादी साझा आधार है। |
| `bash` | 1989 | *Bourne Again SHell*। लगभग हर Linux distribution में default। |
| `zsh` | 1990 | काफ़ी हद तक bash-compatible, लेकिन ज़्यादा features के साथ। macOS पर default। |
| `fish` | 2005 | *Friendly interactive shell*। इस्तेमाल में आसान, लेकिन **अपने ख़ुद के syntax** के साथ। |

**POSIX** एक standard है जो बताता है कि एक `sh` shell को कैसे व्यवहार करना चाहिए।
जो script सिर्फ़ POSIX features इस्तेमाल करता है, वह हर `sh`-compatible shell में
चलता है: bash, zsh, `dash` (जो Debian और Ubuntu पर `/bin/sh` है) और `ash` (Alpine
जैसे छोटे systems पर)। fish जान-बूझकर POSIX-compatible **नहीं** है – यही उसे आसान
बनाता है, लेकिन अलग भी।

## कौन-से shells installed हैं?

File `/etc/shells` उन shells की list है जिन्हें login shell के रूप में इस्तेमाल
किया जा सकता है:

```sh
cat /etc/shells
```

Login करने पर आपको कौन-सा shell मिलता है, यह `/etc/passwd` में आपकी line का आख़िरी
field है, और यह variable `$SHELL` में भी होता है:

```sh
grep {{user}} /etc/passwd
echo $SHELL
```

## zsh – extras के साथ bash

### zsh install कीजिए

Ubuntu टर्मिनल में आप zsh को apt से इंस्टॉल करते हैं:

```sh
sudo apt update
sudo apt install zsh
```

दूसरे डिस्ट्रीब्यूशन अपना पैकेज मैनेजर इस्तेमाल करते हैं, जैसा आपने डिस्ट्रीब्यूशन और
पैकेज वाले भाग में सीखा। वहाँ भी पैकेज का नाम `zsh` है।

`/etc/shells` फिर से देखिए – package ने `/usr/bin/zsh` (और `/bin/zsh`) जोड़ दिया
है:

```sh
cat /etc/shells
```

### zsh start कीजिए

Shell भी किसी दूसरे program जैसा ही एक program है, इसलिए zsh को उसका नाम टाइप करके
start किया जाता है:

```sh
zsh
```

पहली बार आपका स्वागत **zsh-newuser-install** करता है, क्योंकि अभी आपके पास zsh की
कोई configuration file नहीं है। यह एक menu है जो शुरुआत करने में मदद करता है:

| Key | क्या करती है |
|---|---|
| `q` | कुछ किए बिना बाहर निकलो (अगली बार फिर पूछा जाएगा) |
| `0` | लगभग ख़ाली `~/.zshrc` बनाओ |
| `1` | सारी settings वाला main menu (simulator में उपलब्ध नहीं) |
| `2` | सुझाई गई settings के साथ `~/.zshrc` बनाओ |

`2` जवाब दीजिए। Prompt बदलकर `{{user}}@ubuntu ~ %` हो जाता है – zsh में `%`
सामान्य user का आम निशान है (root को `#` मिलता है, बिल्कुल bash की तरह)।

अभी आप कौन-सा shell चला रहे हैं? Variable `$0` में shell का नाम होता है:

```sh
echo $0
ps
```

`ps` दिखाता है कि zsh bash के **अंदर** चल रहा है: bash ने zsh को एक नए process के
रूप में start किया। यह भी ध्यान दीजिए कि `$SHELL` अब भी `/bin/bash` है – यह
variable आपका *login shell* बताता है, न कि वह shell जो आप इस समय चला रहे हैं।

```sh
echo $SHELL
```

### ज़्यादातर चीज़ें bash की तरह ही चलती हैं

zsh लगभग सारा bash syntax समझता है। Pipes, redirection, variables, `if`, `for` और
functions वैसे ही काम करते हैं जैसे आप आदी हैं:

```sh
for f in ~/{{documents}}/*.txt; do wc -l $f; done
```

### Feature 1: `**` सारी subdirectories में ढूँढ़ता है

zsh में `**/` का मतलब है "सारी directories, हर level पर"। यह आपकी home directory
और उसके नीचे की हर चीज़ में मौजूद हर `.txt` file की list बनाता है:

```sh
ls ~/**/*.txt
```

bash में `**` एक साधारण `*` की तरह काम करता है – जब तक आप पहले
`shopt -s globstar` से इसे चालू न करें।

### Feature 2: autocd

`autocd` option (जो सुझाई गई settings का हिस्सा है) के साथ किसी directory में जाने
के लिए आपको बस उसका नाम टाइप करना होता है – `cd` की ज़रूरत नहीं:

```sh
{{documents}}
..
```

Options को `setopt` और `unsetopt` से चालू और बंद किया जाता है:

```sh
setopt
unsetopt autocd
setopt autocd
```

### एक फ़र्क़ जिससे सावधान रहना है: variables split नहीं होते

bash में बिना quotes वाला variable spaces पर split हो जाता है। zsh में नहीं होता:

```sh
files="a.txt b.txt"
for f in $files; do echo "[$f]"; done
```

bash `[a.txt]` और `[b.txt]` print करता है – zsh `[a.txt b.txt]` print करता है। zsh
वाला तरीक़ा आम तौर पर वही है जो आप चाहते हैं, लेकिन इसका मतलब है कि कोई bash script
zsh में हमेशा वही काम नहीं करता। (`setopt shwordsplit` के साथ zsh bash जैसा व्यवहार
करता है।)

किसी शेल में एक अकेला कमांड आज़माने के लिए उसे शुरू करना ज़रूरी नहीं है। `-c` के साथ
शेल कमांड चलाता है और तुरंत बंद हो जाता है – `zsh -c 'echo $0'` `zsh` छापता है, और
उसके बाद भी आप bash में ही रहते हैं।

नीचे का सवाल एक नए टर्मिनल में शुरू होता है, इसलिए पहले वह zsh इंस्टॉल करता है।
`> /dev/null 2>&1` उस पंक्ति का आउटपुट फेंक देता है। आख़िरी कमांड क्या छापता है?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ zsh -c 'files="x.txt y.txt z.txt"; for f in $files; do echo "<$f>"; done'
<x.txt y.txt z.txt>
---
zsh वेरिएबल को स्पेस पर नहीं बाँटता, इसलिए लूप पूरे मान के साथ एक बार चलता है।
bash में यही लूप तीन पंक्तियाँ छापता: `<x.txt>`, `<y.txt>` और `<z.txt>`।
```

### ~/.zshrc और prompt

bash start होते समय `~/.bashrc` पढ़ता है – zsh `~/.zshrc` पढ़ता है।
zsh-newuser-install ने जो file बनाई, उसे देखिए:

```sh
cat ~/.zshrc
```

Prompt variable `PROMPT` से set होता है और `%` codes इस्तेमाल करता है:

| Code | मतलब |
|---|---|
| `%n` | User का नाम |
| `%m` | Computer का नाम |
| `%~` | पूरी directory (home directory के लिए `~` के साथ) |
| `%1~` | Directory का सिर्फ़ आख़िरी हिस्सा |
| `%#` | सामान्य users के लिए `%`, root के लिए `#` |
| `%F{green}` … `%f` | रंग (red, green, blue, yellow …) |

आज़माइए:

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

यह बदलाव तभी तक रहता है जब तक आप zsh से बाहर न निकलें। अगर आप इसे हर बार चाहते
हैं, तो यह line `~/.zshrc` में डाल दीजिए।

### Oh My Zsh

बहुत-से zsh users **Oh My Zsh** install करते हैं, जो themes और plugins का एक
संग्रह है – जैसे prompt में Git की जानकारी, बेहतर tab completion और टाइप करते समय
सुझाव। यह project की website से एक script के ज़रिए install होता है और
`~/.zshrc` में configure किया जाता है। यह simulator में उपलब्ध नहीं है, लेकिन अब
आप जानते हैं कि लोग इसकी बात करते हैं तो उनका क्या मतलब होता है।

### वापस bash में

zsh bash के अंदर चल रहा एक process है। `exit` से इससे बाहर निकलिए और आप वापस bash
में होंगे – जहाँ zsh के variables, aliases और directory बदलाव ग़ायब हो चुके होंगे:

```sh
exit
echo $0
```

## fish – friendly interactive shell

fish बिना किसी configuration के, शुरू से ही इस्तेमाल में आसान होना चाहता है: रंग,
tab completion और **autosuggestions** – fish आपकी history के आधार पर command का बाक़ी
हिस्सा grey text में सुझाता है, और आप right arrow key से सुझाव स्वीकार करते हैं।
(Simulator सुझाव नहीं दिखाता, लेकिन syntax काम करता है।)

### fish install और start कीजिए

fish भी इसी तरह apt से इंस्टॉल होता है – दूसरे डिस्ट्रीब्यूशनों पर उनके अपने पैकेज
मैनेजर से:

```sh
sudo apt update
sudo apt install fish
```

```sh
fish
```

fish आपका स्वागत करता है और prompt `{{user}}@ubuntu ~>` बन जाता है। कुछ
directories नीचे जाइए और देखिए कि fish prompt में path को कैसे छोटा करता है:

```sh
mkdir -p ~/{{documents}}/{{project}}
cd ~/{{documents}}/{{project}}
cd ~
```

Directory `~/{{documents}}/{{project}}` में prompt `~/d/{{project}}>` दिखाता है – आख़िरी को
छोड़कर हर directory एक अक्षर तक छोटी कर दी जाती है।

### fish का अपना syntax है

यहीं fish, bash और zsh से सबसे ज़्यादा अलग है:

| क्या | bash और zsh | fish |
|---|---|---|
| Variable set करना | `{{fruitVar}}={{fruitWord}}` | `set {{fruitVar}} {{fruitWord}}` |
| Environment variable | `export EDITOR=nano` | `set -x EDITOR nano` |
| Variable हटाना | `unset {{fruitVar}}` | `set -e {{fruitVar}}` |
| Command substitution | `$(pwd)` | `(pwd)` |
| आख़िरी exit status | `$?` | `$status` |
| Script arguments | `$@`, `$1` | `$argv`, `$argv[1]` |
| Condition | `if …; then …; fi` | `if …; …; end` |
| Loop | `for …; do …; done` | `for …; …; end` |
| Function | `greet() { …; }` | `function greet; …; end` |
| गणित | `$((17 * 23))` | `math 17 x 23` |

### set के साथ variables

bash के तरीक़े से एक variable set करके देखिए:

```sh
{{fruitVar}}={{fruitWord}}
```

fish मना कर देता है और बताता है कि इसे कैसे लिखें:

```text
fish: Unsupported use of '='. In fish, please use 'set {{fruitVar}} {{fruitWord}}'.
```

fish में यह ऐसे किया जाता है:

```sh
set {{fruitVar}} {{fruitWord}}
echo ${{fruitVar}}
set -x EDITOR nano
set -e {{fruitVar}}
```

`-x` (*export*) variable को एक environment variable बना देता है जिसे आपके start किए
programs देख सकते हैं, और `-e` (*erase*) उसे हटा देता है।

fish में हर variable एक **list** है। Elements की numbering 1 से शुरू होती है:

```sh
set fruits सेब नाशपाती केला
echo $fruits[2]
count $fruits
```

`-c` fish में भी काम करता है। आख़िरी कमांड क्या छापता है?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'set fruits सेब नाशपाती केला; echo $fruits[3]'
केला
---
fish की सूची के तत्वों की गिनती 1 से शुरू होती है, इसलिए `[3]` तीसरा और आख़िरी
तत्व है।
```

### Command substitution और $status

fish में command substitution सादे parentheses से लिखा जाता है:

```sh
echo "I am in" (pwd)
```

Quotes के अंदर parentheses साधारण text होते हैं – इसीलिए `(pwd)` बाहर है। आख़िरी
command के exit status का नाम `$status` है। `false` एक छोटा-सा command है जो fail
होने के सिवा कुछ नहीं करता – उसका exit status हमेशा 1 होता है:

```sh
false
echo $status
```

### and, or और not

Conditions को जोड़ने के लिए fish के अपने commands हैं:

```sh
test -f ~/.bashrc; and echo exists
test -f ~/missing.txt; or echo missing
```

fish के नए versions (3.0 और बाद के) `&&` और `||` भी समझते हैं, और 3.4 से `$(...)`
भी काम करता है। लेकिन `X=1`, `$?` और `$((...))` अब भी काम नहीं करते – वे errors
देते हैं जो आपको fish वाला तरीक़ा बताती हैं।

### Blocks end से ख़त्म होते हैं

fish में हर block – `if`, `for`, `while`, `switch` और `function` – `end` से ख़त्म
होता है। कोई `then`, `do`, `done` या `fi` नहीं है:

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo exists; else; echo missing; end
```

आप block को कई lines में भी लिख सकते हैं। Loop चलाने से पहले shell `end` का इंतज़ार
करता है:

```sh
for f in ~/{{documents}}/*.txt
echo (basename $f)
end
```

Functions को उनके arguments list `$argv` में मिलते हैं:

```sh
function hello; echo "Hello $argv!"; end
hello Kim
```

### math के साथ गणित

fish में `$((...))` नहीं है। इसकी जगह `math` command है, जो decimals भी संभालता है:

```sh
math 17 x 23
math 10 / 4
```

गुणा के लिए `x` लिखिए (या quotes में `"17 * 23"`) – अकेला `*` fish में भी एक
wildcard है, बिल्कुल bash की तरह।

### fish की settings

fish start होते समय `~/.config/fish/config.fish` पढ़ता है। अगर आप welcome message
से छुटकारा पाना चाहते हैं, तो variable `fish_greeting` को ख़ाली कर दीजिए। `-U` के
साथ variable **universal** बन जाता है: वह `~/.config/fish/fish_variables` में save
हो जाता है और हर fish shell में लागू होता है, restart के बाद भी।

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

`exit` से fish से बाहर निकलिए:

```sh
exit
```

## Scripts अब भी bash के लिए क्यों लिखे जाते हैं

Terminal में आप कौन-सा shell इस्तेमाल करते हैं, यह पसंद की बात है। लेकिन
**scripts** लगभग हमेशा bash के लिए (या POSIX `sh` के लिए) लिखे जाते हैं:

- bash लगभग हर Linux system पर installed होता है – zsh और fish नहीं।
- fish का syntax bash में काम नहीं करता, और bash का fish में नहीं।
- Script के सबसे ऊपर वाली `#!` line तय करती है कि उसे कौन-सा shell चलाएगा – इससे
  **कोई फ़र्क़ नहीं पड़ता** कि आप किस shell में बैठे हैं।

एक bash script लिखकर उसे fish से चलाकर देखिए:

```sh
cat > ~/{{helloScript}} << '{{heredocEnd}}'
#!/bin/bash
name=Kim
echo "Hello $name, I am run by bash"
{{heredocEnd}}
chmod +x ~/{{helloScript}}
fish
~/{{helloScript}}
exit
```

Script fish में चलता है, भले ही वहाँ `name=Kim` मना है – क्योंकि उसे bash चलाता है।
इसीलिए `#!/bin/bash` (या `#!/usr/bin/env bash`) इतना मायने रखता है। जिस script को
हर जगह चलना है, वहाँ भी जहाँ bash नहीं है, उसे `#!/bin/sh` और सिर्फ़ POSIX syntax
के साथ लिखा जाता है।

```quiz
आप fish में हैं और एक स्क्रिप्ट चलाते हैं जो `#!/bin/bash` से शुरू होती है और जिसमें
पंक्ति `count=3` है। क्या होता है?
- [ ] fish मना कर देता है, क्योंकि fish में `count=3` की अनुमति नहीं है
- [x] यह काम करता है – स्क्रिप्ट bash चलाता है, चाहे आप किसी भी शेल में हों
- [ ] यह तभी काम करता है जब आप पहले `chsh` से अपना लॉगिन शेल bash कर दें
---
`#!` पंक्ति तय करती है कि स्क्रिप्ट कौन-सा शेल चलाएगा। fish उसे सिर्फ़ शुरू करता है।
```

## chsh से अपना default shell बदलना

हर बार terminal खोलने पर `zsh` टाइप करना जल्दी ही उबाऊ हो जाता है। `chsh`
(*change shell*) से आप अपना **login shell** बदलते हैं – वही जो `/etc/passwd` में
है:

```sh
chsh -s /usr/bin/zsh
grep {{user}} /etc/passwd
```

- Shell उसके पूरे path के साथ देना होता है और उसका `/etc/shells` में list होना
  ज़रूरी है।
- `chsh` आपका password माँगता है (simulator यह step छोड़ देता है)।
- बदलाव **अगले login** पर लागू होता है। जो terminal आपने खोल रखा है उसमें पुराना
  shell ही रहता है, और `$SHELL` तभी बदलता है जब आप दोबारा login कर लेते हैं।
- root दूसरों का shell बदल सकता है: `sudo chsh -s /usr/bin/fish kim`।

वापस bash पर जाने के लिए यही कीजिए:

```sh
chsh -s /bin/bash
```

fish के लिए एक आम सलाह यह है कि bash को अपना login shell रहने दें और उसकी जगह
terminal program से fish start कराएँ – तब login पर POSIX shell की उम्मीद रखने वाली
हर चीज़ काम करती रहती है।

यह सवाल एक नए टर्मिनल में शुरू होता है, zsh इंस्टॉल करता है और उसे लॉगिन शेल बनाता
है। आख़िरी कमांड क्या छापता है?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ chsh -s /usr/bin/zsh > /dev/null 2>&1
$ echo $SHELL
/bin/bash
---
`chsh` ने `/etc/passwd` में आपकी पंक्ति बदल दी, लेकिन बदलाव अगले लॉगिन पर लागू होता
है। जो टर्मिनल आपने खोल रखा है उसमें bash ही रहता है, और `$SHELL` भी।
```

## आपको कौन-सा shell चुनना चाहिए?

- **bash** – हर जगह default। यहाँ जो आप सीखते हैं, वह हर उस server पर काम करता है
  जिस पर आप कभी login करेंगे। अपने scripts bash के लिए लिखिए।
- **zsh** – उनके लिए जो ज़्यादा आराम चाहते हैं लेकिन bash syntax रखना चाहते हैं। Oh
  My Zsh आपको themes और plugins देता है।
- **fish** – box से निकालते ही सबसे अच्छा अनुभव, लेकिन अलग syntax के साथ। Web से
  copy किए गए commands हमेशा काम नहीं करते।
- **sh/dash** – उन scripts के लिए जिन्हें हर जगह चलना है, और छोटे systems पर।

## सारांश

| Command | क्या करता है |
|---|---|
| `cat /etc/shells` | इस्तेमाल किए जा सकने वाले shells की list |
| `echo $0` / `ps` | देखिए कि आप इस समय कौन-सा shell चला रहे हैं |
| `echo $SHELL` | अपना login shell देखिए |
| `zsh` / `fish` / `exit` | दूसरा shell start करें / वापस जाएँ |
| `ls ~/**/*.txt` | सारी subdirectories में ढूँढ़ें (zsh, fish) |
| `setopt autocd` | zsh का कोई option चालू करें |
| `set {{fruitVar}} {{fruitWord}}` | fish में variable set करें |
| `set -x NAME value` | fish में environment variable set करें |
| `chsh -s /usr/bin/zsh` | अपना login shell बदलें |

Configuration files: `~/.bashrc` (bash), `~/.zshrc` (zsh) और
`~/.config/fish/config.fish` (fish)।
