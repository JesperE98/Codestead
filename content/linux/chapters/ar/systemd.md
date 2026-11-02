# الخدمات والسجلات مع systemd

حاسوب Linux يفعل باستمرار أشياء لا يشغّلها أحد يدويًا: يستقبل اتصالات SSH،
ويُبقي الساعة متزامنة، ويشغّل المهام المجدولة، ويكتب السجلات. البرامج التي
تفعل ذلك تُسمّى **خدمات** (services)، وفي كل توزيعة حديثة تقريبًا يتولّى
**systemd** تنظيمها. في هذا الفصل ستتعلّم كيف تبدأ الخدمات وتوقفها، وكيف تجعلها
تبدأ عند الإقلاع، و– وهذا أهم شيء – كيف تقرأ السجلات عندما يحدث خطأ ما.

## init وsystemd

عندما تبدأ نواة Linux، فإنها تشغّل برنامجًا واحدًا: **init**، العملية رقم 1.
ثم يبدأ init كل شيء آخر. واليوم يكون init دائمًا تقريبًا هو **systemd** – في
Debian وUbuntu وArch وFedora على حد سواء. ألقِ نظرة:

```sh
ps -p 1
```

اسم العملية `/sbin/init`، لكنه مجرد رابط إلى البرنامج `systemd`.

لا يقتصر عمل systemd على بدء الخدمات. فهو يتابع هل هي حيّة، ويعيد تشغيلها إذا
انهارت (إن أردت ذلك)، ويجمع كل ما تطبعه في سجل مشترك – **الـ journal** – ولديه
أدوات لمعظم أجزاء النظام:

| الأداة | ماذا تفعل |
|---|---|
| `systemctl` | تتحكّم في الخدمات: الحالة، والبدء، والإيقاف، والإقلاع |
| `journalctl` | تقرأ الـ journal (السجل) |
| `hostnamectl` | تعرض اسم الحاسوب وتغيّره |
| `systemd-analyze` | تعرض المدة التي استغرقها الإقلاع |

## الوحدات والخدمات

كل ما يتابعه systemd يُسمّى **وحدة** (unit). وهناك أنواع عدة، ويظهر النوع في
اللاحقة: `.service` (خدمة)، و`.timer` (مهمة مجدولة)، و`.socket`، و`.mount`،
و`.target` (مجموعة من الوحدات، تشبه نوعًا ما "مرحلة" من الإقلاع) وغيرها. وهذا
الفصل يتناول الخدمات.

كل وحدة يصفها **ملف وحدة** (unit file)، وهو ملف نصي صغير. وتوجد هذه الملفات
في مكانين:

| المجلد | المحتوى |
|---|---|
| `/usr/lib/systemd/system/` | ملفات الوحدات التي تأتي مع الحزم. لا تعدّل هنا! |
| `/etc/systemd/system/` | ملفات الوحدات الخاصة بالمدير. ولها الأولوية. |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

في إصدارات Debian وUbuntu الأقدم غالبًا ما ترى `/lib/systemd/system` بدلًا من
ذلك. وهو المجلد نفسه – فـ `/lib` رابط إلى `/usr/lib`.

اسم الخدمة هو اسم الملف، مثل `myserver.service`. وعندما تكتب الأوامر يمكنك
حذف `.service`: فالأمر `systemctl status myserver` يعمل بالقدر نفسه.

## كيف حال الخدمة؟ – `systemctl status`

الأمر الذي ستستخدمه أكثر من غيره هو `systemctl status`:

```sh
systemctl status ssh
```

على Ubuntu يُسمّى خادم SSH باسم `ssh`. تبدو المخرجات تقريبًا هكذا:

```text
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled; preset: enabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 UTC; 2h 13min ago
       Docs: man:sshd(8)
             man:sshd_config(5)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/ssh.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 ubuntu systemd[1]: Starting ssh.service - OpenBSD Secure Shell server...
Oct 30 07:54:07 ubuntu sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 ubuntu systemd[1]: Started ssh.service - OpenBSD Secure Shell server.
```

سطرًا سطرًا:

| السطر | المعنى |
|---|---|
| `●` | نقطة خضراء = تعمل. `×` حمراء = فشلت. `○` بيضاء = متوقفة. |
| `Loaded` | مكان ملف الوحدة، وهل تبدأ الخدمة عند الإقلاع (`enabled`/`disabled`/`static`)، والإعداد الافتراضي للتوزيعة (`preset`) |
| `Active` | أهم سطر: `active (running)` أو `inactive (dead)` أو `failed` – ومنذ متى |
| `Docs` | أين تقرأ المزيد (`man sshd`) |
| `Main PID` | العملية الرئيسية للخدمة – رقم PID نفسه الذي في `ps aux` |
| `Memory`، `CGroup` | مقدار الذاكرة التي تستخدمها والعمليات التي تنتمي إليها |
| الأسطر الأخيرة | آخر الأسطر من سجل الخدمة في الـ journal |

تعني `static` أن الخدمة لا يمكن تفعيلها وحدها – بل تبدأ عندما تحتاج إليها
وحدة أخرى.

> **نصيحة:** في طرفية حقيقية تُعرض المخرجات الطويلة في أداة تصفّح (pager، مثل
> `less`). اضغط `q` لتعود. وأضف `--no-pager` إذا كنت تفضّل الاستغناء عنها.

## البدء والإيقاف وإعادة التشغيل

```text
sudo systemctl start myserver      # ابدأ الآن
sudo systemctl stop myserver       # أوقف الآن
sudo systemctl restart myserver    # أوقف وابدأ من جديد
sudo systemctl reload myserver     # اطلب منها إعادة قراءة إعداداتها
```

كل ما **يغيّر** شيئًا يتطلّب root، لذا لا تنسَ `sudo`. فمن دونه يجيب
systemctl:

```text
Failed to start myserver.service: Interactive authentication required.
```

لا يعمل `reload` إلا مع الخدمات التي تدعمه. وميزته أن الخدمة تستمر في العمل
في هذه الأثناء – فلا ينقطع أي اتصال. وعندما تغيّر ملف إعدادات خدمة ما، يكون
`reload` أو `restart` هو الخطوة الأخيرة.

> **جرّب ذلك!** في فصل العمليات أوقفت خادم التدريب باستخدام `pkill`. انظر إلى
> `systemctl status myserver` – لقد لاحظ systemd أن العملية اختفت. شغّله من
> جديد باستخدام `systemctl` وقارن رقم PID بما يعرضه `pgrep -l myserver`.

## الآن أم عند الإقلاع؟ `start` و`enable`

هذا أشيع سوء فهم بشأن systemd: **`start` و`enable` شيئان مختلفان.**

| الأمر | ماذا يفعل |
|---|---|
| `systemctl start X` | يبدأ الخدمة **الآن**. وبعد إعادة التشغيل تختفي من جديد. |
| `systemctl enable X` | يبدأ الخدمة تلقائيًا **عند الإقلاع** – لكن ليس الآن. |
| `systemctl enable --now X` | الاثنان معًا. |
| `systemctl disable X` | لا تبدأ عند الإقلاع (و`--now` يوقفها أيضًا). |

ينشئ `enable` رابطًا في مجلد يحمل اسم الهدف (target) المذكور في القسم
`[Install]` من ملف الوحدة، وهو عادةً `multi-user.target.wants`:

```text
$ sudo systemctl enable --now myserver
Created symlink /etc/systemd/system/multi-user.target.wants/myserver.service → /etc/systemd/system/myserver.service.
```

عندما يُقلع الحاسوب، يمرّ systemd على ذلك المجلد ويبدأ كل ما فيه. ويمكنك
السؤال عن الحالة:

```sh
systemctl is-active myserver
systemctl is-enabled myserver
```

الأمران `is-active` و`is-enabled` رائعان في السكربتات – فهما يطبعان كلمة واحدة،
هي الحالة نفسها التي تراها في `systemctl status` (`active` أو `inactive` أو
`failed`، و`enabled` أو `disabled` أو `static`)، وينتهيان بالحالة 0 إذا كان
الجواب "نعم". ومع `-q` يصمتان تمامًا:

```text
if systemctl is-active -q myserver; then echo "the server is running"; fi
```

على حاسوب بدأ للتو في المحاكي، تعمل `myserver`، لكن لم يفعّلها أحد. ماذا يطبع
هذان الأمران؟

```predict
$ systemctl is-active myserver
$ systemctl is-enabled myserver
active
disabled
---
تعمل myserver **الآن**، لكن أحدًا لم يشغّل `enable` – فبعد إعادة التشغيل لن
تبدأ. فـ `start` و`enable` شيئان مختلفان فعلًا.
```

## سرد الخدمات

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- يعرض `list-units` الخدمات التي تعمل (أو التي فشلت). ومع `--all` تُضاف
  المتوقفة أيضًا.
- يعرض `--failed` التي فشلت فقط. أمر أول جيد عندما تشعر بأن شيئًا ما ليس على
  ما يرام!
- يعرض `list-unit-files` كل ملفات الوحدات المثبّتة وهل هي `enabled` أو
  `disabled` أو `static`.

## الـ journal – `journalctl`

كل ما تطبعه الخدمات والنواة وsystemd نفسه ينتهي في الـ journal. ومن دون خيارات
تحصل على الـ journal كاملًا، الأقدم أولًا:

```sh
journalctl
```

يصبح ذلك كثيرًا بسرعة، لذا تقوم بالتصفية دائمًا تقريبًا:

| الأمر | يعرض |
|---|---|
| `journalctl -u ssh` | خدمة واحدة فقط (`-u` من *unit*) |
| `journalctl -n 20` | آخر 20 سطرًا |
| `journalctl -f` | آخر الأسطر، ثم الأسطر الجديدة فور وصولها (اخرج بـ Ctrl+C) |
| `journalctl -b` | هذا الإقلاع فقط (`-b -1` = الإقلاع السابق) |
| `journalctl --since today` | منذ منتصف الليل. وأيضًا `yesterday` و`"10:00"` و`"1 hour ago"` |
| `journalctl -p err` | الأخطاء وما هو أسوأ منها فقط |
| `journalctl -xe` | اقفز إلى النهاية وأضف شروحات |
| `journalctl -k` | رسائل النواة فقط (مثل `dmesg`) |

يمكن الجمع بين الخيارات. وإليك بعض الأمثلة الكلاسيكية:

```sh
journalctl -u myserver -n 5
journalctl -p err -b
journalctl --since today -u myserver
```

### الأولويات

لكل سطر في الـ journal **أولوية** (priority). ويعرض `-p` الأولوية التي تختارها
*وكل ما هو أشد خطورة منها*:

| الرقم | الاسم | المعنى |
|---|---|---|
| 0 | `emerg` | النظام غير قابل للاستخدام |
| 1 | `alert` | يجب الإصلاح فورًا |
| 2 | `crit` | خطأ حرج |
| 3 | `err` | خطأ – يُعرض بالأحمر |
| 4 | `warning` | تحذير – يُعرض بالأصفر |
| 5 | `notice` | عادي لكنه جدير بالملاحظة |
| 6 | `info` | معلومات |
| 7 | `debug` | معلومات لتصحيح الأخطاء |

لا تقلق إذا عرض `journalctl -p err` بعض أخطاء النواة مثل `ACPI BIOS Error`.
فهي موجودة في كل حاسوب تقريبًا وعادةً ما تكون غير ضارة – علل في البرنامج الثابت
(firmware) للحاسوب تلتفّ عليها النواة.

عادةً يجب أن تكون root، أو عضوًا في مجموعة يحق لها قراءة الـ journal (`adm` أو
`systemd-journal` على Ubuntu – وتستخدم العائلات الأخرى مجموعات أخرى)، لترى كل شيء.
أما مستخدمك في المحاكي فيحق له قراءة الـ journal كاملًا.

```quiz
أيّ الأولويات يعرضها `journalctl -p warning`؟
- [x] `err`
- [x] `warning`
- [x] `crit`
- [ ] `notice`
- [ ] `info`
---
يعرض `-p` الأولوية التي تختارها *وكل ما هو أخطر منها* – أي كل ما له الرقم نفسه
أو رقم أصغر (`warning` رقمها 4).
```

## استكشاف أخطاء خدمة لا تبدأ

أعدّ أحدهم الخدمة **reportd** على هذا الحاسوب، لكن فيها خللًا ما. وهذه هي
الطريقة المعتادة للتعامل مع ذلك:

1. **ما الذي فشل؟** اسرد الخدمات التي فشلت:

   ```sh
   systemctl --failed
   ```

2. **انظر إلى الحالة.** غالبًا ما تكفي الأسطر الأخيرة:

   ```sh
   systemctl status reportd
   ```

3. **اقرأ السجل كاملًا** للخدمة. فهو يخبرك دائمًا تقريبًا بما هو خطأ – اقرأه
   بعناية، كلمة كلمة:

   ```sh
   journalctl -xeu reportd
   ```

   يقترح `systemctl` نفسه هذا الأمر بالضبط عندما يفشل البدء:
   `See "systemctl status reportd.service" and "journalctl -xeu
   reportd.service" for details.`

4. **أصلح المشكلة**، مثل ملف إعدادات مفقود أو فيه خطأ مطبعي.

5. **أعد التشغيل وتحقّق:**

   ```text
   sudo systemctl restart reportd
   systemctl status reportd
   ```

يعني السطر `Main process exited, code=exited, status=1/FAILURE` أن البرنامج
انتهى من تلقاء نفسه بخطأ. وإذا كُتب `status=203/EXEC`، فإن systemd لم يجد
البرنامج أصلًا – تحقّق من المسار في `ExecStart=`.

```quiz
خدمة لا تبدأ، والـ journal يقول `status=203/EXEC`. أين تنظر أولًا؟
- [ ] في `/etc/fstab`
- [x] في المسار الموجود في `ExecStart=` في ملف الوحدة
- [ ] في الأولوية باستخدام `journalctl -p err`
- [ ] لا مكان – فهذا يعني أن البرنامج انتهى من تلقاء نفسه بخطأ
---
تعني 203/EXEC أن systemd لم يجد البرنامج إطلاقًا. أما البرنامج الذي يبدأ ثم
ينتهي بخطأ فيعطي `status=1/FAILURE` بدلًا من ذلك.
```

## ملف الوحدة – `systemctl cat`

لترى بالضبط كيف تبدأ خدمة ما، اقرأ ملف الوحدة الخاص بها:

```sh
systemctl cat myserver
```

```text
# /etc/systemd/system/myserver.service
[Unit]
Description=Myserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/myserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| القسم | المحتوى |
|---|---|
| `[Unit]` | الوصف والترتيب: `After=network.target` = ابدأ بعد الشبكة |
| `[Service]` | كيف يعمل البرنامج: `ExecStart=` (الأمر)، `User=`، `Restart=on-failure` … |
| `[Install]` | ما يجب أن يفعله `enable`: `WantedBy=multi-user.target` |

إذا غيّرت ملف وحدة، فيجب أن يحمّله systemd من جديد قبل أن يسري التغيير – وإلا
فستحصل على تحذير في `systemctl status`:

```text
sudo systemctl daemon-reload
```

لا تعدّل أبدًا الملفات الموجودة في `/usr/lib/systemd/system` – فهي تُستبدل في
المرة القادمة التي تُحدَّث فيها الحزمة. ضع نسختك الخاصة في
`/etc/systemd/system` بدلًا من ذلك.

```quiz
تريد تغيير طريقة بدء خدمة جاءت مع حزمة. ما الطريقة الصحيحة؟
- [ ] تعديل ملفها في `/usr/lib/systemd/system` ثم إعادة تشغيل الخدمة
- [x] وضع نسختك الخاصة في `/etc/systemd/system`، وتشغيل `sudo systemctl daemon-reload` ثم إعادة تشغيل الخدمة
- [ ] وضع نسختك الخاصة في `/etc/systemd/system` – وسيلاحظ systemd التغيير بنفسه
- [ ] تعديل الملف في `/usr/lib/systemd/system` وتشغيل `sudo systemctl enable` عليه
---
للملفات في `/etc/systemd/system` الأولوية، ولا يُكتب فوقها عندما تُحدَّث الحزمة.
ويجعل `daemon-reload` الأمر systemd يحمّل ملف الوحدة المعدَّل من جديد.
```

## ما أسماء الخدمات؟

يعمل systemd بالطريقة نفسها في كل مكان، لكن **الخدمات لا تحمل الأسماء نفسها
دائمًا** – فذلك يعتمد على أسماء الحزم وعلى البرامج التي اختارتها التوزيعة. على
Ubuntu:

| الخدمة | الاسم على Ubuntu |
|---|---|
| خادم SSH | `ssh` (والاسم البديل `sshd`) |
| المهام المجدولة (cron) | `cron` |
| الشبكة | `NetworkManager` |
| الجدار الناري | `ufw` (إن كان مثبّتًا) |
| الساعة | `systemd-timesyncd` |

تُسمّى خدمة SSH في الحقيقة `ssh.service`. ولها الاسم البديل `sshd.service`، لذا
يعمل `systemctl status sshd` أيضًا – لكن المخرجات تعرض الاسم الحقيقي. وقد تسمّي
العائلات الأخرى الخدمات نفسها بأسماء مختلفة (ففي Arch وFedora تُسمّى خدمة SSH
`sshd`) – والجزء الخاص بالتوزيعات والحزم يتناول مثل هذه الاختلافات.

لست متأكدًا من اسم شيء ما؟ ابحث في القائمة:

```sh
systemctl list-unit-files | grep ssh
```

```try
systemctl list-unit-files | grep ssh
---
`ssh.service` هو ملف الوحدة الحقيقي، و`sshd.service` مسرود بوصفه `alias` (اسمًا
بديلًا) له.
```

## إعادة تشغيل الحاسوب

لا يظهر أثر `enable` إلا عندما يُعاد تشغيل الحاسوب. ويمكنك تجربة ذلك في المحاكي
– فهو يعيد التشغيل في لحظة:

```text
sudo systemctl reboot
```

بعد إعادة التشغيل لا تعمل إلا الخدمات المفعّلة. ومع `journalctl -b -1` ترى سجل
الإقلاع السابق (وكيف أُغلق كل شيء)، ويعرض `journalctl --list-boots` كل عمليات
الإقلاع الموجودة في الـ journal.

## المزيد من systemd

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

يعرض `hostnamectl` اسم الحاسوب ونظام التشغيل والنواة (ويغيّر الاسم باستخدام
`sudo hostnamectl set-hostname NEWNAME`). ويعرض `systemd-analyze` المدة التي
استغرقها الإقلاع، ويعرض `blame` الخدمات التي استغرقت أطول وقت – وهذا مثالي
عندما يُقلع الحاسوب ببطء.
