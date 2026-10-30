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

Git हमेशा पहले से install नहीं होता। {{distro}} में आप इसे ऐसे install करते हैं:

:::debian
```sh
sudo apt update
sudo apt install git
```
:::

:::arch
```sh
sudo pacman -S git
```

जब pacman पूछे कि आगे बढ़ना है या नहीं, तो हाँ में जवाब दीजिए।
:::

:::redhat
```sh
sudo dnf install git
```

`y` जवाब दीजिए – `[y/N]` में बड़े `N` का मतलब है कि No default है।
:::

हर family में package का नाम `git` ही है। Check कीजिए कि यह काम करता है:

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
git config --global user.name "Elev Elevsson"
git config --global user.email "elev@example.com"
```

बेझिझक अपना नाम इस्तेमाल कीजिए। `--global` का मतलब है कि यह setting आपके सारे
projects पर लागू होती है। यह साधारण text file `~/.gitconfig` में save होती है:

```sh
cat ~/.gitconfig
```

```text
[user]
	name = Elev Elevsson
	email = elev@example.com
```

अगर आप यह step भूल जाते हैं, तो save करने की कोशिश पर git शिकायत करता है:
`*** Please tell me who you are.` – और ठीक यही दो commands सुझाता है।

> **Tip:** `git config --global init.defaultBranch main` भी जोड़ दीजिए। तब आपके
> सारे computers पर हर नए project की main branch का नाम `main` होगा। git के पुराने
> versions इसे `master` कहते हैं, और बाहर की दुनिया में आपको दोनों नाम दिखेंगे।

## एक नई repository

आपकी home directory में एक छोटा web project है, `~/projekt-webb` (Swedish में
*web project*), जिसमें तीन files हैं। वहाँ जाइए और देखिए:

```sh
cd ~/projekt-webb
ls
```

Git से इस directory को track करवाने के लिए इसे एक **repository** (छोटे में *repo*)
बनाइए:

```sh
git init
```

```text
Initialized empty Git repository in /home/elev/projekt-webb/.git/
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
git commit -m "Första versionen av webbplatsen"
```

```text
[main (root-commit) 3f2a9c1] Första versionen av webbplatsen
 3 files changed, 24 insertions(+)
 create mode 100644 README.md
 create mode 100644 index.html
 create mode 100644 style.css
```

(Message Swedish में है और इसका मतलब है *website का पहला version* – आप अपना message
किसी भी भाषा में लिख सकते हैं।) `3f2a9c1` commit की **id** की शुरुआत है – 40
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
echo 'Sidan är byggd med HTML och CSS.' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index 1100cf4..e5bd3a0 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # Min webbplats
 
 En liten webbplats som jag versionshanterar med git.
+Sidan är byggd med HTML och CSS.
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
git commit -a -m "Beskriv hur sidan är byggd"
```

ध्यान दीजिए कि `-a` उन नई files को शामिल *नहीं* करता जिन्हें git अभी follow नहीं
करता। उन्हें आपको हमेशा पहले `git add` से जोड़ना होता है।

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
Author: Elev Elevsson <elev@example.com>
Date:   Fri Oct 30 14:12:09 2026 +0100

    Beskriv hur sidan är byggd

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
git switch -c ny-design
git branch
```

`git switch -c ny-design` (*नया design*) branch बनाता है और उस पर switch करता है।
`git branch` में star दिखाता है कि आप कहाँ हैं। कोई बदलाव कीजिए और उसे branch पर
commit कीजिए:

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "Lila rubriker"
```

वापस `main` पर switch कीजिए और `style.css` देखिए:

```sh
git switch main
tail -3 style.css
```

बैंगनी रंग ग़ायब है! जब आप branch बदलते हैं, तो git working tree को इस तरह दोबारा
लिखता है कि वह branch के सबसे नए commit जैसा दिखे। बदलाव `ny-design` में सुरक्षित
है। `git log --oneline --all` सारी branches दिखाता है:

```sh
git log --oneline --all
```

> **Tip:** पुरानी guides अक्सर `git checkout ny-design` और
> `git checkout -b new-branch` इस्तेमाल करती हैं। `checkout` वही करता है जो `switch`
> करता है, लेकिन files भी restore कर सकता है। नए commands `switch` और `restore` इन
> कामों को बाँट देते हैं और याद रखने में आसान हैं।

Branch बदलने पर uncommitted बदलाव साथ आ जाते हैं – जब तक कि वे दूसरी branch से
टकराएँ नहीं। तब git मना कर देता है और आपसे पहले commit करने को कहता है (या बदलावों
को `git stash` से कुछ देर के लिए अलग रखने और `git stash pop` से वापस लाने को)।

## Branches merge करना: `git merge`

उस branch पर रहिए जिसे बदलाव *मिलने* चाहिए – यहाँ `main` – और merge कीजिए:

```sh
git merge ny-design
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward* का मतलब है कि branch बनने के बाद से `main` नहीं बदली है। तब git को
बस `main` को आगे बढ़ाकर उसी commit पर ले जाना होता है जिस पर `ny-design` है।

अगर दोनों branches में नए commits हैं, तो git एक **three-way merge** करता है: वह
दोनों branches की तुलना उनके साझा पूर्वज (common ancestor) से करता है और दो parents
वाला एक नया *merge commit* बनाता है। `git log --oneline --graph --all` दिखाता है कि
history कैसे बँटती है और फिर से जुड़ती है:

```text
*   e4b1d0a (HEAD -> main) Merge branch 'rubrik'
|\
| * 7c3f9e2 (rubrik) Vänligare rubrik
* | 52d8a71 Kortare text
|/
* c19e2f4 Lila rubriker
```

Merge हो चुकी branch की अब ज़रूरत नहीं है और उसे delete किया जा सकता है। अगर branch
में ऐसे commits हैं जो उस branch में नहीं हैं जिस पर आप हैं, तो `-d` मना कर देता
है:

```sh
git branch -d ny-design
```

## Conflicts

अगर दोनों branches ने *वही lines* बदली हैं, तो git नहीं जान सकता कि कौन-सा version
सही है। इसे **conflict** कहते हैं, और तब फ़ैसला आप करते हैं। चलिए जान-बूझकर एक
conflict बनाते हैं (*rubrik* Swedish में *heading* है):

```sh
git switch -c rubrik
sed -i 's/Välkommen!/Hej och välkommen!/' index.html
git commit -am "Vänligare rubrik"
git switch main
sed -i 's/Välkommen!/Välkommen till min sida!/' index.html
git commit -am "Längre rubrik"
git merge rubrik
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
  <h1>Välkommen till min sida!</h1>
=======
  <h1>Hej och välkommen!</h1>
>>>>>>> rubrik
```

`<<<<<<< HEAD` और `=======` के बीच आपका version है (वह branch जिस पर आप हैं);
`=======` और `>>>>>>> rubrik` के बीच दूसरी branch का। Conflict ऐसे सुलझाते हैं:

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
git commit -m "Slå ihop grenen rubrik"
```

अगर conflict के बीच में आपका मन बदल जाए, तो `git merge --abort` आपको वहीं वापस ले
जाता है जहाँ आप merge से पहले थे।

जब कई लोग एक ही project पर काम करते हैं, तो conflicts बिलकुल आम बात हैं। इन्हें कम
करने का एक अच्छा तरीक़ा है छोटे commits करना और अक्सर merge करना।

## वे files जिन्हें git को ignore करना चाहिए: `.gitignore`

कुछ files को कभी history में नहीं पहुँचना चाहिए: passwords और keys, logs,
temporary files और वे चीज़ें जो अपने-आप build होती हैं। उनके नाम या patterns
repository की root में file `.gitignore` में लिखिए:

```sh
echo 'password=secret' > hemligt.txt
echo 'error' > fel.log
printf 'hemligt.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`hemligt.txt` (*secret.txt*) और `fel.log` (*error.log*) अब नहीं दिखतीं – `git add .`
भी उन्हें नहीं उठाता। `*` किसी भी चीज़ से match करता है, और आख़िर में slash
(`build/`) का मतलब है पूरी directory। दूसरी तरफ़, `.gitignore` को ख़ुद commit किया
जाना चाहिए, ताकि project पर काम करने वाला हर व्यक्ति वही चीज़ें ignore करे:

```sh
git add .gitignore
git commit -m "Ignorera hemligheter och loggar"
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
git clone ~/projekt-webb ~/kopia
cd ~/kopia
git log --oneline
git remote -v
```

GitHub जैसे server के पास सिर्फ़ history होती है, कोई working tree नहीं। ऐसी *bare*
repository `git init --bare` से बनाई जाती है। मान लीजिए कि यह आपका GitHub account
है और `main` को वहाँ push कीजिए:

```sh
git init --bare ~/server.git
cd ~/projekt-webb
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
