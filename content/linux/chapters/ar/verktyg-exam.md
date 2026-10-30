# اختبار: أدوات أخرى

أربعة عشر سؤالًا عن git وأصداف shell الأخرى. تحتاج إلى 80 % من الإجابات الصحيحة
للنجاح. الأسئلة التي فيها أوامر تبدأ في طرفية جديدة، لذا تثبّت أولًا البرنامج الذي
تحتاج إليه – ويتخلص `> /dev/null 2>&1` من مخرجات تلك الأسطر.

```quiz
غيّرت `index.html` وأنشأت الملف الجديد `kontakt.html`. ثم
شغّلت `git commit -am "Contact page"`. ما الذي ينتهي في الـ commit؟
- [x] التغيير في `index.html` فقط
- [ ] `kontakt.html` فقط
- [ ] كلا الملفين
---
يضيف `-a` كل ملف متغيّر يتتبّعه git أصلًا – لكن لا يضيف الملفات الجديدة أبدًا.
يجب أن يُضاف `kontakt.html` باستخدام `git add` أولًا.
```

```quiz
شغّلت `git add` على تغيير في `style.css`. أيّ أمر يعرض ذلك
التغيير؟
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
يقارن `git diff` شجرة العمل بالفهرس، لذا لا يعرض شيئًا بعد أن يدخل التغيير
الفهرس. أما `--staged` فيعرض ما ينتظر حفظه في commit.
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
لم يتغير `main` منذ إنشاء الفرع، لذا كان الدمج *fast-forward* (تقديمًا سريعًا):
لم يفعل git سوى تحريك `main` إلى الأمام حتى commit الفرع `ny-design`.
ولم يُنشأ commit دمج.
```

```quiz
ما هو الفرع في git، من الناحية التقنية؟
- [ ] نسخة كاملة من كل ملف في المشروع
- [x] تسمية تشير إلى commit وتتحرك معك عندما تعمل commits جديدة
- [ ] مستودع منفصل له مجلد `.git` خاص به
---
ولهذا الفروع رخيصة في git – فاستخدمها كثيرًا.
```

```quiz
توقّف `git merge` بسبب تعارض في `index.html`. أصلحت الملف
وأزلت أسطر العلامات. ماذا تفعل بعد ذلك؟
- [ ] تشغّل `git merge` مرة أخرى
- [x] `git add index.html` ثم `git commit`
- [ ] `git restore index.html`
---
يخبر `git add` الأمرَ git بأن التعارض قد حُلّ، وينهي `git commit` الدمج. أما
`git restore` فكان سيتخلص من إصلاحك.
```

```quiz
حُفظ الملف `fel.log` في commit عن طريق الخطأ. تضيف `*.log` إلى `.gitignore`،
لكن git ما زال يتتبّع الملف. كيف تزيله من المستودع مع إبقائه على
القرص؟
- [ ] `rm fel.log`
- [x] `git rm --cached fel.log`
- [ ] `git restore fel.log`
---
لا يسري `.gitignore` إلا على الملفات التي لا يتتبّعها git أصلًا. ويزيل `--cached`
الملف من git لكنه يتركه على القرص.
```

```quiz
أيّ أمر يجلب الـ commits الجديدة من الـ remote **دون** دمجها
مع الـ commits الخاصة بك؟
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
يجلب `git pull` ويدمج، أما `git fetch` فيجلب فقط.
```

```quiz
أيّ هذه التغييرات تضيع إلى الأبد؟ اختر كل ما ينطبق.
- [x] تغييرات في ملف لم يُحفظ في commit قط، تخلّصت منها باستخدام `git restore`
- [x] تغييرات لم تُحفظ في commit قط، تخلّصت منها باستخدام `git reset --hard`
- [ ] commit عملته أمس، قبل أن تشغّل `git reset --hard`
---
كل ما حُفظ في commit في وقت ما يمكن إنقاذه دائمًا تقريبًا –
فيعرض `git reflog` أين كنت.
```

```quiz
بدأت zsh من bash. أيّ أمر يعرض الـ shell الذي تشغّله
الآن؟
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` هو الـ shell الخاص بتسجيل دخولك – وما زال `/bin/bash`. ويسرد `/etc/shells`
الأصداف التي يجوز استخدامها كأصداف تسجيل دخول.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
يتعامل `math` مع الكسور العشرية.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
في fish تُسمّى حالة خروج آخر أمر `$status` – و`false`
يفشل دائمًا.
```

```quiz
كيف تجعل `EDITOR` متغيّر بيئة بالقيمة `nano` في fish؟
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
يصدّر `-x` المتغيّر، أما `-e` فيمحوه.
```

```quiz
أيّ ملف يقرؤه zsh عندما يبدأ؟
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep elev /etc/passwd
---
الحقل الأخير في السطر هو الـ shell الخاص بتسجيل دخولك – وهو ما يغيّره `chsh -s`.
```
