# Git في الطرفية

هل سبق أن حفظت ملفات بأسماء مثل `report-final.txt` و`report-final-2.txt`
و`report-REALLY-final.txt`؟ إذن فقد مارست *التحكم في الإصدارات* (version control)
يدويًا. ونظام التحكم في الإصدارات يفعل الشيء نفسه بالطريقة الصحيحة: فهو يحفظ لقطات
للمشروع كله، ويتذكّر من غيّر ماذا ولماذا، ويتيح لك العودة بالزمن إلى الوراء، ويجعل
من الممكن أن يعمل أشخاص كثيرون على الملفات نفسها في الوقت نفسه.

**Git** هو أشهر أنظمة التحكم في الإصدارات بفارق كبير. كتبه Linus Torvalds عام
2005 – الشخص نفسه الذي كتب نواة لينكس – لإدارة الشيفرة المصدرية للنواة. واليوم
يُستخدم git في كل البرمجيات تقريبًا، لكنه يصلح أيضًا لصفحات الويب وملفات الإعداد
والملاحظات والكتب. فكل ما هو نص يناسبه تمامًا.

صُمّم git للعمل في الطرفية. صحيح أن للبرامج الرسومية والمحررات أزرارًا لـ git،
لكنها في الخلفية تشغّل الأوامر نفسها التي ستتعلمها هنا.

## ثبّت git

لا يكون git مثبّتًا مسبقًا دائمًا. في طرفية Ubuntu تثبّته باستخدام apt:

```sh
sudo apt update
sudo apt install git
```

أما التوزيعات الأخرى فتثبّته بمدير الحزم الخاص بها، كما تعلّمت في الجزء الخاص
بالتوزيعات والحزم – واسم الحزمة هناك أيضًا `git`. تحقّق من أنه يعمل:

```sh
git --version
```

كل أوامر git على الصورة `git COMMAND`، مثل `git status` أو `git log`. والدليل
متاح عبر `man git`.

## عرّف git بنفسك

كل نسخة محفوظة في git تحمل اسم الشخص الذي أنشأها وعنوان بريده الإلكتروني. لذلك
يريد git أن يعرف من أنت قبل أن تتمكن من حفظ أي شيء. وتضبط ذلك مرة واحدة لكل
حاسوب:

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

لا تتردد في استخدام اسمك أنت. يعني `--global` أن الإعداد ينطبق على كل مشاريعك،
ويُحفظ في الملف النصي العادي `~/.gitconfig`:

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

إذا نسيت هذه الخطوة، فسيشتكي git عندما تحاول الحفظ:
`*** Please tell me who you are.` – ويقترح عليك هذين الأمرين بالضبط.

> **نصيحة:** أضف أيضًا `git config --global init.defaultBranch main`. عندها
> يُسمّى الفرع الرئيسي لكل مشروع جديد `main` على كل حواسيبك. أما الإصدارات الأقدم
> من git فتسمّيه `master`، وسترى الاسمين كليهما في العالم الحقيقي.

## مستودع جديد

في مجلد المنزل الخاص بك مشروع ويب صغير، `~/{{webProject}}`، فيه ثلاثة
ملفات. انتقل إليه وألقِ نظرة:

```sh
cd ~/{{webProject}}
ls
```

لكي يبدأ git بتتبّع المجلد، حوّله إلى **مستودع** (repository، أو *repo*
اختصارًا):

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

كل ما حدث هو إنشاء مجلد مخفي اسمه `.git`. وفيه يحفظ git التاريخ كله. ولا يلمس git
ملفاتك.

```sh
ls -a
ls .git
```

لا تحذف `.git` أبدًا إلا إذا أردت أن تفقد التاريخ – ولا تعدّل الملفات التي فيه
يدويًا. وإذا أردت التوقف عن استخدام git في مشروع ما، فيكفي حذف `.git`؛ وتبقى
ملفاتك العادية كما هي.

```quiz
تريد التوقف عن استخدام git في مشروع، لكن مع الاحتفاظ بكل ملفاتك. ماذا تفعل؟
- [ ] تشغّل `git init` مرة أخرى
- [x] تحذف المجلد المخفي `.git`
- [ ] تحذف كل الملفات ما عدا `.git`
---
التاريخ كله موجود في `.git`، ولا يمسّ git ملفاتك العادية. ومن دون `.git` تبقى
الملفات – ويختفي التاريخ فقط.
```

## ثلاثة أماكن: شجرة العمل والفهرس والتاريخ

أهم شيء يجب أن تفهمه في git هو أن كل تغيير يمرّ عبر ثلاثة أماكن:

```text
 working tree  ──git add──▶  index  ──git commit──▶  history
 (the files you see)       (next commit)             (.git)
```

- **شجرة العمل** (working tree) هي الملفات كما تبدو الآن، أي التي تعدّلها.
- **الفهرس** (index، ويسمى أيضًا *staging area*) أشبه بطاولة تعبئة. فيه تضع ما
  يجب أن يدخل في النسخة المحفوظة التالية.
- **التاريخ** (history) يتكوّن من **commits**. والـ commit لقطة محفوظة لكل الملفات،
  مع رسالة ومؤلف ووقت.

لماذا الخطوة الوسطى؟ لكي تستطيع الاختيار. فإذا عدّلت خمسة ملفات لكن اثنين منها
فقط مرتبطان معًا، تستطيع وضع هذين الاثنين في الفهرس، وعمل commit لهما، وترك البقية
لـ commit مستقل.

```quiz
غيّرت خمسة ملفات، لكن تغييرين فقط منها مترابطان. كيف تحفظ هذين الاثنين فقط في
commit؟
- [ ] تشغّل `git commit` أولًا ثم `git add` على الملفين بعد ذلك
- [x] تشغّل `git add` على الملفين، ثم `git commit`
- [ ] تحفظ الخمسة كلها في commit – فالـ commit يأخذ دائمًا كل ملف تغيّر
---
يحفظ الـ commit ما هو موجود في الفهرس. وتبقى التغييرات الثلاثة الأخرى في شجرة
العمل حتى تضيفها.
```

## `git status` هو بوصلتك

الأمر الذي ستشغّله أكثر من غيره هو `git status`. فهو يخبرك أين يوجد كل تغيير –
وكثيرًا ما يقترح عليك ما تفعله بعد ذلك. والأفضل أن تشغّله أكثر من اللازم على أن
تشغّله أقل من اللازم!

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

*Untracked files* هي ملفات يراها git لكنه لا يتتبّعها بعد. وفي الطرفية الحقيقية
تظهر باللون الأحمر. ضعها في الفهرس باستخدام `git add`:

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

صارت الآن مدرجة تحت *Changes to be committed* – باللون الأخضر. وبدلًا من تسمية كل
ملف يمكنك كتابة `git add .`، الذي يضيف كل شيء في المجلد الحالي (النقطة تعني
«هنا»). أما `git add -A` فيضيف كل التغييرات في المستودع كله.

## أول commit

احفظ اللقطة باستخدام `git commit`. والخيار `-m` يحدد الرسالة:

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

يمكنك كتابة الرسالة بأي لغة تشاء. و`3f2a9c1` هو بداية **معرّف** الـ commit – وهو *hash* من 40 محرفًا يُحسب من
المحتوى. وسيختلف معرّفك، لأن الوقت واسمك جزء منه. وعادةً تكفي المحارف السبعة
الأولى لتمييز الـ commit.

شغّل `git status` مرة أخرى:

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

تعني *working tree clean* أن كل شيء محفوظ. رائع!

## انظر ما الذي تغيّر: `git diff`

أضف سطرًا إلى `README.md` واسأل git عمّا حدث:

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index 6b9db42..d0ee2c5 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # {{siteTitle}}
 
 موقع إلكتروني صغير أدير نسخه باستخدام git.
+{{builtWith}}
```

السطر الذي يبدأ بـ `+` جديد (أخضر)، والأسطر التي تبدأ بـ `-` حُذفت (أحمر)، والبقية
تُعرض للسياق. ويعني `@@ -1,3 +1,4 @@` أن الأسطر 1–3 في النسخة القديمة تقابل الأسطر
1–4 في النسخة الجديدة.

يقارن `git diff` شجرة العمل بالفهرس – أي ما *لم* تضفه بعد. ولكي ترى ما في الفهرس
بانتظار الـ commit، اكتب `git diff --staged`.

أضف التغيير واعمل له commit. الخيار `-a` يشغّل `git add` على كل ملف يتتبّعه git
أصلًا، فيتم الأمر في خطوة واحدة:

```sh
git commit -a -m "{{commitDescribe}}"
```

لاحظ أن `-a` *لا* يشمل الملفات الجديدة التي لا يتتبّعها git بعد. فهذه يجب أن تضيفها
دائمًا باستخدام `git add` أولًا.

الأسئلة التي فيها أوامر في هذا الفصل تبدأ في طرفية جديدة، لذا تثبّت git أولًا
وتنشئ أول commit. ويرمي `> /dev/null 2>&1` مخرجات تلك الأسطر، كما تعلّمت في فصل
إعادة التوجيه والأنابيب. ماذا يطبع الأمر الأخير؟

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ echo '{{anotherLine}}' >> README.md
$ git commit -m "{{anotherLine}}" > /dev/null
$ git log --oneline | wc -l
1
---
الـ commit الثاني لم يحدث قط: فالتغيير على `README.md` لم يكن في الفهرس، لذا لم
يكن هناك ما يُحفظ. ولو شغّلت `git add README.md` أولًا – أو `git commit -a` –
لحصلت على commit اثنين.
```

## رسائل commit جيدة

بعد ستة أشهر من الآن، ستكون رسائل الـ commit هي التي تروي القصة – لك وللآخرين.
إليك بعض القواعد العامة:

- اكتب سطرًا أول قصيرًا، ويُفضَّل أن يكون أقل من 50 محرفًا، يلخّص التغيير.
- صِف *ماذا* يفعل التغيير، ويُفضَّل *لماذا*، لا *كيف* كتبته.
- ينبغي أن يفعل كل commit شيئًا واحدًا. ثلاثة commits صغيرة أفضل من واحد كبير.
- تحتاج إلى شرح أكثر؟ اترك سطرًا فارغًا واكتب نصًا أطول تحته. وكل `-m` يصبح فقرة
  مستقلة: `git commit -m "Title" -m "Explanation."`

| سيئة | أفضل |
|---|---|
| `fix` | `Fix broken link to the contact page` |
| `changes` | `Make headings larger on mobile` |
| `asdf` | `Add contact form` |

بالإنجليزية تُكتب الرسائل عادةً بصيغة الأمر: *Add contact form*، *Fix broken
link*. فهي تُقرأ كأنها «هذا الـ commit سوف …».

## ألقِ نظرة على التاريخ

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

يأتي أحدث commit أولًا. ويعني `HEAD -> main` أنك على الفرع `main` وأن هذا هو آخر
commit فيه. بعض الصيغ المفيدة:

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

يعطي `--oneline` سطرًا واحدًا لكل commit، ويعرض `-n 1` آخر commit فقط، ويعرض
`--stat` الملفات التي تغيّرت، ويعرض `git show` الـ commit مع التغيير نفسه. ويمكنك
أيضًا أن تنظر إلى ملف كما كان في commit معيّن:
`git show HEAD~1:README.md` (يعني `HEAD~1` «الـ commit الذي قبل الأخير»).

## التراجع

يجعل git التراجع سهلًا – وهذا نصف الفكرة منه:

| إذا أردت أن … | الأمر |
|---|---|
| تتخلّص من التغييرات في ملف (لم تُضف بعد) | `git restore FILE` |
| تُخرج ملفًا من الفهرس (ويبقى التغيير) | `git restore --staged FILE` |
| تغيّر رسالة آخر commit | `git commit --amend -m "New message"` |
| تعود إلى ما كان عليه كل شيء عند آخر commit | `git reset --hard` |

جرّب أن تخرّب ملفًا ثم تستعيده:

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **انتبه!** يتخلّص `git restore FILE` و`git reset --hard` من تغييرات لم يُعمل لها
> commit قط، ولا يمكن استعادتها. أما ما عُمل له commit في وقت ما، فيمكن إنقاذه
> دائمًا تقريبًا – اسأل `git reflog` عن الأماكن التي كنت فيها.

## الفروع

**الفرع** (branch) خط تطوير مستقل. يمكنك تجربة فكرة جديدة في فرع دون أن تلمس النسخة
العاملة في `main`. فإن نجحت الفكرة دمجت الفرع في `main`؛ وإن لم تنجح تخلّصت منه.

من الناحية التقنية، الفرع مجرد لافتة تشير إلى commit وتتحرك معك كلما عملت commits
جديدة. ولهذا فالفروع رخيصة في git – استخدمها كثيرًا!

```sh
git branch
git switch -c {{newDesign}}
git branch
```

ينشئ `git switch -c {{newDesign}}` الفرع وينتقل إليه. وتُظهر
النجمة في `git branch` أين أنت. عدّل شيئًا واعمل له commit على الفرع:

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

عُد إلى `main` وانظر إلى `style.css`:

```sh
git switch main
tail -3 style.css
```

اختفى اللون البنفسجي! فعندما تنتقل بين الفروع، يعيد git كتابة شجرة العمل لتطابق آخر
commit في الفرع. والتغيير في أمان داخل `{{newDesign}}`. ويعرض `git log --oneline --all`
كل الفروع:

```sh
git log --oneline --all
```

> **نصيحة:** كثيرًا ما تستخدم الأدلة الأقدم `git checkout {{newDesign}}`
> و`git checkout -b new-branch`. يفعل `checkout` ما يفعله `switch`، لكنه يستطيع
> أيضًا استعادة الملفات. أما الأمران الأحدث `switch` و`restore` فيقسمان المهمتين
> بينهما، وهما أسهل في التذكّر.

التغييرات التي لم يُعمل لها commit تنتقل معك عندما تبدّل الفرع – ما لم تتعارض مع
الفرع الآخر. عندها يرفض git ويطلب منك عمل commit أولًا (أو وضع التغييرات جانبًا
مؤقتًا باستخدام `git stash` واستعادتها باستخدام `git stash pop`).

كم سطرًا يحتوي على `purple` في `style.css` في النهاية؟

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
حُفظ السطر البنفسجي في commit على `{{newDesign}}`. وعندما تنتقل إلى `main`، يجعل git
شجرة العمل تبدو مثل آخر commit في `main` – حيث لا يوجد السطر بعد.
```

## دمج الفروع: `git merge`

قف على الفرع الذي يجب أن *يستقبل* التغييرات – وهو هنا `main` – وادمج:

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

يعني *Fast-forward* أن `main` لم يتغيّر منذ إنشاء الفرع. لذا لا يحتاج git إلا إلى
تحريك `main` إلى الأمام إلى الـ commit نفسه الذي يشير إليه `{{newDesign}}`.

أما إذا كانت في الفرعين commits جديدة، فيقوم git بـ **دمج ثلاثي** (three-way
merge): يقارن الفرعين بسلفهما المشترك، وينشئ *merge commit* جديدًا له أبوان. ويعرض
`git log --oneline --graph --all` كيف يتفرّع التاريخ ثم يلتقي من جديد:

```text
*   e4b1d0a (HEAD -> main) Merge branch 'heading'
|\
| * 7c3f9e2 (heading) عنوان أكبر
* | 52d8a71 عنوان أحمر
|/
* c19e2f4 {{commitPurple}}
```

الفرع المدموج لم تعد له حاجة ويمكن حذفه. ويرفض `-d` الحذف إذا كانت في الفرع commits
غير موجودة في الفرع الذي أنت عليه:

```sh
git branch -d {{newDesign}}
```

## التعارضات

إذا غيّر الفرعان كلاهما *الأسطر نفسها*، فلا يستطيع git أن يعرف أي النسختين هي
الصحيحة. وهذا يسمى **تعارضًا** (conflict)، وعندها تقرّر أنت. لننشئ تعارضًا عن قصد:

```sh
git switch -c heading
sed -i 's/<h1>/<h1 class="big">/' index.html
git commit -am "عنوان أكبر"
git switch main
sed -i 's/<h1>/<h1 class="red">/' index.html
git commit -am "عنوان أحمر"
git merge heading
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

اهدأ – لم ينكسر شيء. يُدرج `git status` الملف تحت *Unmerged paths* بوصفه
`both modified`. انظر داخله:

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1 class="red">أهلا وسهلا!</h1>
=======
  <h1 class="big">أهلا وسهلا!</h1>
>>>>>>> heading
```

ما بين `<<<<<<< HEAD` و`=======` هو نسختك (الفرع الذي أنت عليه)؛ وما بين `=======`
و`>>>>>>> heading` هو نسخة الفرع الآخر. وهكذا تحلّ التعارض:

1. افتح الملف في محرر واجعله كما تريد – اختر أحد السطرين أو اجمع بينهما – واحذف
   أسطر العلامات.
2. أخبر git بأن التعارض قد حُلّ باستخدام `git add FILE`.
3. أنهِ الدمج باستخدام `git commit`.

لا يوجد في المحاكي محرر حقيقي، لكن إذا أردت فقط اختيار نسخة أحد الطرفين، فيمكن
لـ git أن يفعل ذلك عنك: `--ours` يأخذ نسختك، و`--theirs` يأخذ نسخة الفرع الآخر.

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "دمج فرع العنوان"
```

وإذا غيّرت رأيك في منتصف التعارض، فإن `git merge --abort` يعيدك إلى ما كنت عليه
قبل الدمج.

التعارضات أمر طبيعي تمامًا عندما يعمل عدة أشخاص على المشروع نفسه. ومن الطرق الجيدة
لتقليلها أن تعمل commits صغيرة وأن تدمج كثيرًا.

```quiz
أنت على `main` وتشغّل `git merge heading`. فيحصل الملف على تعارض:

    <<<<<<< HEAD
      <h1>Hello!</h1>
    =======
      <h1>Welcome!</h1>
    >>>>>>> heading

أيّ سطر يأتي من `main`؟
- [x] `<h1>Hello!</h1>`
- [ ] `<h1>Welcome!</h1>`
---
`HEAD` هو الفرع الذي أنت عليه – هنا `main`. ونسخته موجودة بين
`<<<<<<< HEAD` و`=======`؛ أما نسخة الفرع الآخر فتأتي بعد `=======`.
```

## ملفات يجب أن يتجاهلها git: `.gitignore`

بعض الملفات لا ينبغي أن تدخل التاريخ أبدًا: كلمات المرور والمفاتيح، والسجلات،
والملفات المؤقتة، والأشياء التي تُبنى تلقائيًا. اكتب أسماءها أو أنماطها في الملف
`.gitignore` في جذر المستودع:

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

لم يعد `secret.txt` و`error.log` يظهران – بل لا يلتقطهما حتى `git add .`. تطابق `*` أي شيء، والشرطة المائلة في النهاية (`build/`) تعني مجلدًا
كاملًا. أما `.gitignore` نفسه فينبغي أن يُعمل له commit، حتى يتجاهل كل من يعمل على
المشروع الأشياء نفسها:

```sh
git add .gitignore
git commit -m "تجاهل الأسرار والسجلات"
```

لاحظ أن `.gitignore` لا ينطبق إلا على الملفات التي لا يتتبّعها git أصلًا. فإذا كان
الملف قد عُمل له commit من قبل، فأزله من المستودع (لا من القرص) باستخدام
`git rm --cached FILE`.

## GitHub وGitLab والمستودعات البعيدة

حتى الآن عاش كل شيء في مستودعك أنت. وللتعاون مع الآخرين، أو للحصول على نسخة
احتياطية فحسب، تحتفظ عادةً بنسخة من المستودع على خادم – وتسمى **remote** (مستودعًا
بعيدًا). وأشهر الخدمات هي **GitHub** و**GitLab** و**Codeberg**.

| الأمر | ماذا يفعل |
|---|---|
| `git clone URL` | ينزّل مستودعًا كاملًا، بكل تاريخه، إلى مجلد جديد |
| `git push` | يرسل commits الجديدة إلى المستودع البعيد |
| `git pull` | يجلب commits جديدة من المستودع البعيد ويدمجها مع ما لديك |
| `git fetch` | يجلب commits جديدة دون أن يدمج شيئًا |
| `git remote -v` | يعرض المستودعات البعيدة |

يسمى المستودع البعيد عادةً `origin`، وتبدو طريقة العمل المعتادة هكذا: `git pull`
عندما تبدأ، ثم التعديل و`git add` و`git commit` – وأخيرًا `git push`. ويستخدم
GitHub وGitLab مفتاح SSH أو رمز وصول (access token) لتسجيل دخولك، لا كلمة مرور.

كل هذا يحتاج إلى شبكة، والمحاكي ليست فيه شبكة. لكن `clone` و`push` و`pull` تعمل
بالجودة نفسها بين مستودعين على الحاسوب نفسه، لذا يمكنك تجربتها على أي حال. انسخ
مشروعك إلى مجلد جديد:

```sh
cd ~
git clone ~/{{webProject}} ~/copy
cd ~/copy
git log --oneline
git remote -v
```

الخادم مثل GitHub لا يحتوي إلا على التاريخ، دون شجرة عمل. ومثل هذا المستودع *المجرّد*
(bare) يُنشأ باستخدام `git init --bare`. تخيّل أنه حسابك على GitHub وادفع `main`
إليه:

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

يربط `-u` فرعك `main` بـ `origin/main`، حتى يستطيع `git status` أن يخبرك هل أنت متقدّم
على الخادم أم متأخر عنه، وحتى يكفيك من الآن فصاعدًا `git push` و`git pull` وحدهما.

## الخلاصة

| الأمر | ماذا يفعل |
|---|---|
| `git init` | يحوّل المجلد إلى مستودع |
| `git status` | يعرض الحالة – شغّله كثيرًا! |
| `git add FILE` / `git add .` | يضع التغييرات في الفهرس |
| `git commit -m "…"` | يحفظ الفهرس بوصفه commit جديدًا |
| `git diff` / `git diff --staged` | يعرض التغييرات التي لم يُعمل لها commit |
| `git log --oneline --graph --all` | يعرض التاريخ |
| `git restore FILE` | يتخلّص من التغييرات في ملف |
| `git switch -c BRANCH` | ينشئ فرعًا وينتقل إليه |
| `git merge BRANCH` | يدمج فرعًا في الفرع الذي أنت عليه |
| `git clone`، `git pull`، `git push` | التعاون عبر مستودع بعيد |
