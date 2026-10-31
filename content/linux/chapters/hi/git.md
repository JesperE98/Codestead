# Terminal में git

क्या आपने कभी `report-final.txt`, `report-final-2.txt` और
`report-REALLY-final.txt` नाम की files save की हैं? तब आप हाथ से *version control*
कर चुके हैं। Version control system यही काम ठीक से करता है: वह पूरे project के
snapshots save करता है, याद रखता है कि किसने क्या और क्यों बदला, आपको समय में
पीछे जाने देता है और कई लोगों के लिए एक ही समय पर एक ही files पर काम करना मुमकिन
बनाता है।

**Git** अब तक का सबसे आम version control system है। इसे 2005 में Linus Torvalds
ने लिखा था – वही व्यक्ति जिन्होंने Linux kernel लिखा – kernel के source code को
संभालने के लिए। आज git लगभग सारे software के लिए इस्तेमाल होता है, लेकिन यह web
pages, configuration files, notes और किताबों के लिए भी उतना ही अच्छा काम करता है।
जो कुछ भी text है, वह इसके लिए बिलकुल सही है।

Git terminal के लिए बना है। Graphical programs और editors में git के buttons होते
हैं, लेकिन अंदर से वे वही commands चलाते हैं जो आप यहाँ सीखेंगे।

## git install करना

Git हमेशा पहले से इंस्टॉल नहीं होता। Ubuntu टर्मिनल में आप इसे apt से इंस्टॉल करते
हैं:

```sh
sudo apt update
sudo apt install git
```

दूसरे डिस्ट्रीब्यूशन इसे अपने पैकेज मैनेजर से इंस्टॉल करते हैं, जैसा आपने डिस्ट्रीब्यूशन
और पैकेज वाले भाग में सीखा – वहाँ भी पैकेज का नाम `git` ही है। जाँचिए कि यह काम
करता है:

```sh
git --version
```

सारे git commands `git COMMAND` के रूप में होते हैं, जैसे `git status` या
`git log`। Manual `man git` से मिलता है।

## git को बताइए कि आप कौन हैं

Git में save किए गए हर version में उस व्यक्ति का नाम और email address होता है
जिसने उसे बनाया। इसीलिए कुछ भी save करने से पहले git जानना चाहता है कि आप कौन
हैं। यह आप हर computer पर एक बार set करते हैं:

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

बेझिझक अपना नाम इस्तेमाल कीजिए। `--global` का मतलब है कि यह setting आपके सारे
projects पर लागू होती है। यह साधारण text file `~/.gitconfig` में save होती है:

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

अगर आप यह step भूल जाते हैं, तो save करने की कोशिश पर git शिकायत करता है:
`*** Please tell me who you are.` – और ठीक यही दो commands सुझाता है।

> **Tip:** `git config --global init.defaultBranch main` भी जोड़ दीजिए। तब आपके
> सारे computers पर हर नए project की main branch का नाम `main` होगा। git के पुराने
> versions इसे `master` कहते हैं, और बाहर की दुनिया में आपको दोनों नाम दिखेंगे।

## एक नई repository

आपकी home directory में एक छोटा web project है, `~/{{webProject}}`, जिसमें तीन
files हैं। वहाँ जाइए और देखिए:

```sh
cd ~/{{webProject}}
ls
```

Git से इस directory को track करवाने के लिए इसे एक **repository** (छोटे में *repo*)
बनाइए:

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

हुआ बस इतना है कि एक hidden directory, `.git`, बन गई है। वहीं git पूरी history
रखता है। Git आपकी files को नहीं छूता।

```sh
ls -a
ls .git
```

`.git` को कभी delete मत कीजिए, जब तक आप history खोना न चाहें – और उसके अंदर की
files को हाथ से edit मत कीजिए। अगर आप किसी project में git इस्तेमाल करना बंद करना
चाहते हैं, तो `.git` हटाना काफ़ी है; आपकी साधारण files बनी रहती हैं।

```quiz
आप किसी प्रोजेक्ट में git इस्तेमाल करना बंद करना चाहते हैं, लेकिन अपनी सारी फ़ाइलें रखना चाहते हैं। आप क्या करेंगे?
- [ ] `git init` फिर से चलाएँगे
- [x] छिपी हुई डायरेक्टरी `.git` हटाएँगे
- [ ] `.git` को छोड़कर हर फ़ाइल हटाएँगे
---
पूरी हिस्ट्री `.git` में रहती है, और git आपकी साधारण फ़ाइलों को नहीं छूता।
`.git` के बिना फ़ाइलें बनी रहती हैं – सिर्फ़ हिस्ट्री चली जाती है।
```

## तीन जगहें: working tree, index और history

Git के बारे में समझने वाली सबसे ज़रूरी बात यह है कि एक बदलाव तीन जगहों से होकर
गुज़रता है:

```text
 working tree  ──git add──▶  index  ──git commit──▶  history
 (जो files आप देखते हैं)    (अगला commit)             (.git)
```

- **Working tree** files का वह रूप है जैसी वे अभी दिखती हैं, यानी वे files जिन्हें
  आप edit करते हैं।
- **Index** (जिसे *staging area* भी कहते हैं) एक तरह की packing table है। वहाँ आप
  वह रखते हैं जो अगले save किए गए version में जाना चाहिए।
- **History** **commits** से बनी होती है। Commit सारी files का एक save किया गया
  snapshot है, जिसमें एक message, एक author और एक समय होता है।

बीच वाला step क्यों? ताकि आप चुन सकें। अगर आपने पाँच files बदली हैं लेकिन उनमें
से सिर्फ़ दो एक साथ जाती हैं, तो आप उन दो को index में रखकर commit कर सकते हैं और
बाक़ी को उनके अपने commit के लिए बचा सकते हैं।

```quiz
आपने पाँच फ़ाइलें बदली हैं, लेकिन उनमें से सिर्फ़ दो बदलाव एक साथ जाते हैं। आप
सिर्फ़ उन दो को एक commit में कैसे सेव करेंगे?
- [ ] पहले `git commit` चलाइए और उसके बाद दोनों फ़ाइलों पर `git add`
- [x] दोनों फ़ाइलों पर `git add` चलाइए, फिर `git commit`
- [ ] पाँचों को commit कीजिए – commit हमेशा हर बदली हुई फ़ाइल लेता है
---
commit वही सेव करता है जो index में है। बाक़ी तीन बदलाव तब तक working tree में
रहते हैं जब तक आप उन्हें add नहीं करते।
```

## `git status` आपका compass है

जो command आप सबसे ज़्यादा चलाएँगे, वह है `git status`। यह बताता है कि हर बदलाव
कहाँ है – और अक्सर सुझाता है कि आगे क्या करना है। इसे कम के बजाय ज़्यादा बार
चलाइए!

```sh
git status
```

```text
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	README.md
	index.html
	style.css

nothing added to commit but untracked files present (use "git add" to track)
```

*Untracked files* ऐसी files हैं जिन्हें git देख सकता है लेकिन अभी follow नहीं
करता। असली terminal में ये लाल रंग में दिखती हैं। इन्हें `git add` से index में
रखिए:

```sh
git add index.html style.css README.md
git status
```

```text
Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md
	new file:   index.html
	new file:   style.css
```

अब ये *Changes to be committed* के नीचे दिखती हैं – हरे रंग में। हर file का नाम
लेने के बजाय आप `git add .` टाइप कर सकते हैं, जो current directory की हर चीज़ जोड़
देता है (dot का मतलब है "यहाँ")। `git add -A` पूरी repository का हर बदलाव जोड़ता
है।

## पहला commit

Snapshot को `git commit` से save कीजिए। `-m` option message देता है:

```sh
git commit -m "{{commitFirst}}"
```

```text
[main (root-commit) 3f2a9c1] {{commitFirst}}
 3 files changed, 24 insertions(+)
 create mode 100644 README.md
 create mode 100644 index.html
 create mode 100644 style.css
```

आप अपना message किसी भी भाषा में लिख सकते हैं। `3f2a9c1` commit की **id** की शुरुआत है – 40
characters का एक *hash* जो content से calculate किया जाता है। आपकी id अलग होगी,
क्योंकि समय और आपका नाम उसका हिस्सा हैं। किसी commit को पहचानने के लिए आम तौर पर
पहले सात characters काफ़ी होते हैं।

`git status` फिर से चलाइए:

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean* का मतलब है कि सब कुछ save हो चुका है। बढ़िया!

## देखिए क्या बदला: `git diff`

`README.md` में एक line जोड़िए और git से पूछिए कि क्या हुआ:

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index c5ea3c9..e243b6c 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # {{siteTitle}}
 
 एक छोटी वेबसाइट, जिसका संस्करण-नियंत्रण git से होता है।
+{{builtWith}}
```

`+` से शुरू होने वाली line नई है (हरी), `-` से शुरू होने वाली lines हटाई गई थीं
(लाल) और बाक़ी context के तौर पर दिखाई जाती हैं। `@@ -1,3 +1,4 @@` का मतलब है कि
पुराने version की lines 1–3 नए version की lines 1–4 से मेल खाती हैं।

`git diff` working tree की तुलना index से करता है – यानी वह जो आपने अभी तक add
*नहीं* किया है। Index में commit का इंतज़ार कर रही चीज़ें देखने के लिए
`git diff --staged` टाइप कीजिए।

बदलाव को add और commit कीजिए। `-a` option उन सारी files पर `git add` चलाता है
जिन्हें git पहले से follow करता है, इसलिए एक ही step काफ़ी है:

```sh
git commit -a -m "{{commitDescribe}}"
```

ध्यान दीजिए कि `-a` उन नई files को शामिल *नहीं* करता जिन्हें git अभी follow नहीं
करता। उन्हें आपको हमेशा पहले `git add` से जोड़ना होता है।

इस अध्याय के कमांड वाले सवाल एक नए टर्मिनल में शुरू होते हैं, इसलिए वे पहले git
इंस्टॉल करते हैं और पहला commit बनाते हैं। `> /dev/null 2>&1` उन पंक्तियों का
आउटपुट फेंक देता है, जैसा आपने रीडायरेक्शन और पाइप वाले अध्याय में सीखा। आख़िरी
कमांड क्या छापता है?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ echo 'एक और पंक्ति।' >> README.md
$ git commit -m "एक और पंक्ति" > /dev/null
$ git log --oneline | wc -l
1
---
दूसरा commit कभी हुआ ही नहीं: `README.md` का बदलाव index में नहीं था, इसलिए
commit करने को कुछ नहीं था। पहले `git add README.md` – या `git commit -a` – से
दो commit बनते।
```

## अच्छे commit messages

छह महीने बाद commit messages ही कहानी बताते हैं – आपको भी और दूसरों को भी। कुछ
आसान नियम:

- एक छोटी पहली line लिखिए, हो सके तो 50 characters से कम, जो बदलाव का सार बताए।
- बताइए कि बदलाव *क्या* करता है और हो सके तो *क्यों*, यह नहीं कि आपने उसे *कैसे*
  लिखा।
- एक commit को एक ही काम करना चाहिए। तीन छोटे commits एक बड़े से बेहतर हैं।
- और समझाना है? एक ख़ाली line छोड़िए और नीचे लंबा text लिखिए। हर `-m` अपना अलग
  paragraph बनता है: `git commit -m "Title" -m "Explanation."`

| बुरा | बेहतर |
|---|---|
| `fix` | `Fix broken link to the contact page` |
| `changes` | `Make headings larger on mobile` |
| `asdf` | `Add contact form` |

English में messages आम तौर पर आज्ञार्थ (imperative) में लिखे जाते हैं: *Add
contact form*, *Fix broken link*। इसे "यह commit …" की तरह पढ़ा जाता है।

## History देखना

```sh
git log
```

```text
commit 8d41b7e0c2a3f1d5e9b6a7c8d9e0f1a2b3c4d5e6 (HEAD -> main)
Author: {{gitName}} <{{user}}@example.com>
Date:   Fri Oct 30 14:12:09 2026 +0100

    {{commitDescribe}}

commit 3f2a9c1...
```

सबसे नया commit सबसे पहले आता है। `HEAD -> main` का मतलब है कि आप branch `main`
पर हैं और यह उसका सबसे नया commit है। कुछ काम के रूप:

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` हर commit के लिए एक line देता है, `-n 1` सिर्फ़ सबसे नया दिखाता है,
`--stat` दिखाता है कि कौन-सी files बदलीं और `git show` एक commit को बदलाव समेत
दिखाता है। आप किसी file को वैसे भी देख सकते हैं जैसी वह किसी ख़ास commit में थी:
`git show HEAD~1:README.md` (`HEAD~1` का मतलब है "सबसे नए से पहले वाला commit")।

## Undo करना

Git में undo करना आसान है – आधा मक़सद यही है:

| अगर आप चाहते हैं … | Command |
|---|---|
| किसी file के बदलाव फेंक देना (अभी add नहीं किए) | `git restore FILE` |
| किसी file को index से बाहर निकालना (बदलाव बना रहता है) | `git restore --staged FILE` |
| सबसे नए commit का message बदलना | `git commit --amend -m "New message"` |
| सब कुछ वापस वैसा कर देना जैसा सबसे नए commit में था | `git reset --hard` |

किसी file को बिगाड़कर उसे वापस लाकर देखिए:

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **ध्यान दीजिए!** `git restore FILE` और `git reset --hard` उन बदलावों को फेंक देते
> हैं जो कभी commit नहीं हुए। उन्हें वापस नहीं लाया जा सकता। दूसरी तरफ़, जो कुछ भी
> कभी commit हुआ था, उसे लगभग हमेशा बचाया जा सकता है – `git reflog` से पूछिए कि आप
> कहाँ-कहाँ रहे हैं।

## Branches

**Branch** development की एक अलग line है। आप `main` के चालू version को छुए बिना
किसी branch में नया idea आज़मा सकते हैं। अगर बात बन जाए तो आप branch को `main` में
merge कर देते हैं; अगर नहीं, तो उसे फेंक देते हैं।

तकनीकी रूप से branch बस एक label है जो किसी commit की ओर point करता है और नए
commits बनाने पर साथ-साथ आगे बढ़ता है। इसीलिए git में branches सस्ती होती हैं –
इन्हें अक्सर इस्तेमाल कीजिए!

```sh
git branch
git switch -c {{newDesign}}
git branch
```

`git switch -c {{newDesign}}` branch बनाता है और उस पर switch करता है।
`git branch` में star दिखाता है कि आप कहाँ हैं। कोई बदलाव कीजिए और उसे branch पर
commit कीजिए:

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

वापस `main` पर switch कीजिए और `style.css` देखिए:

```sh
git switch main
tail -3 style.css
```

बैंगनी रंग ग़ायब है! जब आप branch बदलते हैं, तो git working tree को इस तरह दोबारा
लिखता है कि वह branch के सबसे नए commit जैसा दिखे। बदलाव `{{newDesign}}` में सुरक्षित
है। `git log --oneline --all` सारी branches दिखाता है:

```sh
git log --oneline --all
```

> **Tip:** पुरानी guides अक्सर `git checkout {{newDesign}}` और
> `git checkout -b new-branch` इस्तेमाल करती हैं। `checkout` वही करता है जो `switch`
> करता है, लेकिन files भी restore कर सकता है। नए commands `switch` और `restore` इन
> कामों को बाँट देते हैं और याद रखने में आसान हैं।

Branch बदलने पर uncommitted बदलाव साथ आ जाते हैं – जब तक कि वे दूसरी branch से
टकराएँ नहीं। तब git मना कर देता है और आपसे पहले commit करने को कहता है (या बदलावों
को `git stash` से कुछ देर के लिए अलग रखने और `git stash pop` से वापस लाने को)।

आख़िर में `style.css` में `purple` वाली कितनी पंक्तियाँ हैं?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ git switch -c {{newDesign}} > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "{{commitPurple}}" > /dev/null
$ git switch main > /dev/null 2>&1
$ grep purple style.css | wc -l
0
---
purple वाली पंक्ति `{{newDesign}}` पर commit हुई थी। जब आप `main` पर जाते हैं, तो git
working tree को `main` के सबसे नए commit जैसा बना देता है – जहाँ वह पंक्ति अभी
है ही नहीं।
```

## Branches merge करना: `git merge`

उस branch पर रहिए जिसे बदलाव *मिलने* चाहिए – यहाँ `main` – और merge कीजिए:

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward* का मतलब है कि branch बनने के बाद से `main` नहीं बदली है। तब git को
बस `main` को आगे बढ़ाकर उसी commit पर ले जाना होता है जिस पर `{{newDesign}}` है।

अगर दोनों branches में नए commits हैं, तो git एक **three-way merge** करता है: वह
दोनों branches की तुलना उनके साझा पूर्वज (common ancestor) से करता है और दो parents
वाला एक नया *merge commit* बनाता है। `git log --oneline --graph --all` दिखाता है कि
history कैसे बँटती है और फिर से जुड़ती है:

```text
*   e4b1d0a (HEAD -> main) Merge branch 'heading'
|\
| * 7c3f9e2 (heading) ज़्यादा दोस्ताना शीर्षक
* | 52d8a71 छोटा टेक्स्ट
|/
* c19e2f4 {{commitPurple}}
```

Merge हो चुकी branch की अब ज़रूरत नहीं है और उसे delete किया जा सकता है। अगर branch
में ऐसे commits हैं जो उस branch में नहीं हैं जिस पर आप हैं, तो `-d` मना कर देता
है:

```sh
git branch -d {{newDesign}}
```

## Conflicts

अगर दोनों branches ने *वही lines* बदली हैं, तो git नहीं जान सकता कि कौन-सा version
सही है। इसे **conflict** कहते हैं, और तब फ़ैसला आप करते हैं। चलिए जान-बूझकर एक
conflict बनाते हैं:

```sh
git switch -c heading
sed -i 's/स्वागत है!/नमस्ते और स्वागत है!/' index.html
git commit -am "ज़्यादा दोस्ताना शीर्षक"
git switch main
sed -i 's/स्वागत है!/मेरी साइट पर स्वागत है!/' index.html
git commit -am "लंबा शीर्षक"
git merge heading
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

घबराइए नहीं – कुछ भी टूटा नहीं है। `git status` file को *Unmerged paths* के नीचे
`both modified` के रूप में दिखाता है। उसके अंदर देखिए:

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>मेरी साइट पर स्वागत है!</h1>
=======
  <h1>नमस्ते और स्वागत है!</h1>
>>>>>>> heading
```

`<<<<<<< HEAD` और `=======` के बीच आपका version है (वह branch जिस पर आप हैं);
`=======` और `>>>>>>> heading` के बीच दूसरी branch का। Conflict ऐसे सुलझाते हैं:

1. File को किसी editor में खोलिए और उसे वैसा बनाइए जैसा आप चाहते हैं – किसी एक
   line को चुनिए, या दोनों को मिलाइए – और marker वाली lines delete कर दीजिए।
2. `git add FILE` से git को बताइए कि conflict सुलझ गया है।
3. `git commit` से merge पूरा कीजिए।

Simulator में कोई असली editor नहीं है, लेकिन अगर आप बस किसी एक तरफ़ का version
चुनना चाहते हैं, तो git यह आपके लिए कर सकता है: `--ours` आपका version लेता है और
`--theirs` दूसरी branch का।

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "heading branch को merge करें"
```

अगर conflict के बीच में आपका मन बदल जाए, तो `git merge --abort` आपको वहीं वापस ले
जाता है जहाँ आप merge से पहले थे।

जब कई लोग एक ही project पर काम करते हैं, तो conflicts बिलकुल आम बात हैं। इन्हें कम
करने का एक अच्छा तरीक़ा है छोटे commits करना और अक्सर merge करना।

```quiz
आप `main` पर हैं और `git merge heading` चलाते हैं। फ़ाइल में conflict आता है:

    <<<<<<< HEAD
      <h1>Hello!</h1>
    =======
      <h1>Welcome!</h1>
    >>>>>>> heading

कौन-सी पंक्ति `main` से आती है?
- [x] `<h1>Hello!</h1>`
- [ ] `<h1>Welcome!</h1>`
---
`HEAD` वह branch है जिस पर आप हैं – यहाँ `main`। उसका संस्करण `<<<<<<< HEAD` और
`=======` के बीच है; दूसरी branch का संस्करण `=======` के बाद आता है।
```

## वे files जिन्हें git को ignore करना चाहिए: `.gitignore`

कुछ files को कभी history में नहीं पहुँचना चाहिए: passwords और keys, logs,
temporary files और वे चीज़ें जो अपने-आप build होती हैं। उनके नाम या patterns
repository की root में file `.gitignore` में लिखिए:

```sh
echo 'password=secret' > secret.txt
echo 'error' > error.log
printf 'secret.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`secret.txt` और `error.log` अब नहीं दिखतीं – `git add .`
भी उन्हें नहीं उठाता। `*` किसी भी चीज़ से match करता है, और आख़िर में slash
(`build/`) का मतलब है पूरी directory। दूसरी तरफ़, `.gitignore` को ख़ुद commit किया
जाना चाहिए, ताकि project पर काम करने वाला हर व्यक्ति वही चीज़ें ignore करे:

```sh
git add .gitignore
git commit -m "secrets और logs को ignore करें"
```

ध्यान दीजिए कि `.gitignore` सिर्फ़ उन files पर लागू होती है जिन्हें git पहले से
follow नहीं करता। अगर कोई file पहले ही commit हो चुकी है, तो उसे repository से (लेकिन
disk से नहीं) `git rm --cached FILE` से हटाइए।

## GitHub, GitLab और remote repositories

अब तक सब कुछ आपकी अपनी repository में रहा है। मिलकर काम करने के लिए, या बस backup
रखने के लिए, आप आम तौर पर repository की एक copy किसी server पर रखते हैं – एक
**remote**। सबसे जानी-मानी services हैं **GitHub**, **GitLab** और **Codeberg**।

| Command | क्या करता है |
|---|---|
| `git clone URL` | पूरी repository, सारी history समेत, एक नई directory में download करता है |
| `git push` | आपके नए commits remote पर भेजता है |
| `git pull` | Remote से नए commits लाता है और उन्हें आपके commits के साथ merge करता है |
| `git fetch` | बिना कुछ merge किए नए commits लाता है |
| `git remote -v` | Remotes की list दिखाता है |

Remote का नाम आम तौर पर `origin` होता है, और एक आम workflow ऐसा दिखता है: शुरू
करते समय `git pull`, फिर edit, `git add` और `git commit` – और आख़िर में
`git push`। GitHub और GitLab आपको log in करने के लिए password नहीं, बल्कि SSH key
या access token इस्तेमाल करते हैं।

इस सबके लिए network चाहिए, और simulator में network नहीं है। लेकिन `clone`, `push`
और `pull` एक ही computer पर दो repositories के बीच भी उतने ही अच्छे से काम करते हैं,
इसलिए आप इन्हें फिर भी आज़मा सकते हैं। अपने project को एक नई directory में clone
कीजिए:

```sh
cd ~
git clone ~/{{webProject}} ~/copy
cd ~/copy
git log --oneline
git remote -v
```

GitHub जैसे server के पास सिर्फ़ history होती है, कोई working tree नहीं। ऐसी *bare*
repository `git init --bare` से बनाई जाती है। मान लीजिए कि यह आपका GitHub account
है और `main` को वहाँ push कीजिए:

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

`-u` आपकी `main` को `origin/main` से जोड़ता है, ताकि `git status` आपको बता सके कि
आप server से आगे हैं या पीछे, और ताकि उसके बाद सिर्फ़ `git push` और `git pull` काफ़ी
हों।

## सारांश

| Command | क्या करता है |
|---|---|
| `git init` | Directory को repository बनाता है |
| `git status` | स्थिति दिखाता है – इसे अक्सर चलाइए! |
| `git add FILE` / `git add .` | बदलावों को index में रखता है |
| `git commit -m "…"` | Index को एक नए commit के रूप में save करता है |
| `git diff` / `git diff --staged` | वे बदलाव दिखाता है जो commit नहीं हुए |
| `git log --oneline --graph --all` | History दिखाता है |
| `git restore FILE` | किसी file के बदलाव फेंक देता है |
| `git switch -c BRANCH` | एक branch बनाता है और उस पर switch करता है |
| `git merge BRANCH` | किसी branch को उस branch में merge करता है जिस पर आप हैं |
| `git clone`, `git pull`, `git push` | Remote के ज़रिए मिलकर काम करना |
