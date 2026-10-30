# Flatpak وSnap وAppImage

الحزمة العادية مبنية لتوزيعة معيّنة وإصدار معيّن. وهذه مشكلة لمن يصنع برنامجًا لسطح
المكتب: فالبرنامج نفسه يجب أن يُعاد تحزيمه لـ Debian وUbuntu وFedora وArch وكل
إصداراتها. وتحلّ **صيغ الحزم العامة** (universal package formats) هذه المشكلة بأن
تضمّ معظم ما يحتاجه البرنامج داخل الحزمة – فتعمل الحزمة الواحدة نفسها على كل
التوزيعات.

الصيغ الثلاث الكبرى هي **Flatpak** و**Snap** و**AppImage**. وهي لا تحلّ محل مدير
الحزم الخاص بالتوزيعة بل تكمّله، وذلك أساسًا لبرامج سطح المكتب.

> لا يحتوي المحاكي إلا على طرفية. فعندما تشغّل برنامجًا رسوميًا، يظهر لك سطر يقول إنه
> كان سيفتح في نافذة.

## أربع طرق لتثبيت برنامج

| | حزمة التوزيعة | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| مصدره | مستودعات التوزيعة | Flathub (أو *remotes* أخرى) | Snap Store (Canonical) | موقع المطوّر |
| يعمل على | توزيعة وإصدار واحد | الكل | كل ما فيه `snapd` | الكل (يحتاج إلى FUSE) |
| عزل (sandbox) | لا | نعم | نعم (ما عدا *classic*) | لا |
| الحجم | صغير – يتشارك المكتبات مع النظام | كبير في المرة الأولى (runtimes)، ثم مشترك | كبير – كل snap مع قاعدته | كبير – كل شيء في ملف واحد |
| التحديثات | مع النظام (`apt upgrade` …) | `flatpak update` | تلقائيًا في الخلفية | بنفسك – تنزّل ملفًا جديدًا |
| يصلح لـ | برامج النظام، وأدوات سطر الأوامر، والخوادم | برامج سطح المكتب | Ubuntu، وأسطح المكتب والخوادم | برامج منفردة، وتجربة إصدارات جديدة |

**العزل** (sandbox) يعني أن البرنامج لا يصل إلا إلى ما سُمح له به، مثل الشبكة أو
مجلد التنزيلات، بدلًا من مجلد المنزل كله.

```quiz
أيّ صيغة تُحدَّث تلقائيًا في الخلفية؟
- [ ] Flatpak
- [x] Snap
- [ ] AppImage
---
تُحدَّث برامج Flatpak باستخدام `flatpak update`، أما AppImage فيُستبدل بتنزيل ملف
جديد.
```

## Flatpak

Flatpak هي الصيغة التي اتفقت عليها معظم التوزيعات لبرامج سطح المكتب. تُنزَّل البرامج
من **remote** (مصدر بعيد) – وهو **Flathub** في كل الأحوال تقريبًا – وتتشارك
**runtimes** (بيئات تشغيل) مشتركة (مثل `org.gnome.Platform`)، حتى لا يضطر كل برنامج
إلى حمل كل شيء معه.

:::debian
### ثبّت Flatpak

Flatpak غير مثبّت مسبقًا على {{distro}}:

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### ثبّت Flatpak

Flatpak موجود في مستودعات Arch:

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### Flatpak على {{distro}}

يأتي Fedora Workstation مع Flatpak، والمصدر البعيد الخاص بـ Fedora، `fedora`، مضاف
مسبقًا:

```sh
flatpak --version
flatpak remotes
```
:::

### أضف Flathub

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

يجعل `--if-not-exists` الأمر لا يفشل إذا كان Flathub موجودًا أصلًا – وهذا مفيد في
السكربتات وأدلة التثبيت.

### البحث والتثبيت والتشغيل

لكل برنامج **معرّف** (ID) يُكتب على شكل اسم نطاق معكوس، مثل `org.gimp.GIMP`:

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

يعرض Flatpak **الأذونات** التي يريدها البرنامج والـ runtimes التي تأتي معه. لاحظ
الحجم: أول برنامج يجلب معه runtime بحجم عدة مئات من الميغابايتات، لكن البرنامج
التالي الذي يستخدم الـ runtime نفسه يكون صغيرًا.

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### للنظام كله أم لك وحدك

دون خيارات يثبّت Flatpak البرنامج **للنظام كله** (في `/var/lib/flatpak`). وعلى سطح
المكتب يطلب Flatpak كلمة مرورك في نافذة، لذا لا حاجة إلى sudo. ومع `--user` ينتهي
البرنامج في مجلد المنزل الخاص بك بدلًا من ذلك (`~/.local/share/flatpak`) ولا يراه
أي مستخدم آخر. ولتثبيت المستخدم **مصادره البعيدة الخاصة**، لذا يجب أن يُضاف Flathub
باستخدام `--user` أيضًا:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

```quiz
ماذا يحدث عندما تثبّت Flatpak باستخدام `--user`؟
- [ ] يُثبَّت للنظام كله، في `/var/lib/flatpak`
- [x] ينتهي في مجلد المنزل الخاص بك، ولا يراه أي مستخدم آخر
- [ ] يعمل من دون عزل
---
تذكّر أن لتثبيت المستخدم مصادره البعيدة الخاصة – لذا يجب أن يُضاف Flathub
باستخدام `--user` أيضًا.
```

### التحديث والإزالة

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

يزيل `--unused` الـ runtimes التي لم يعد يستخدمها أي برنامج مثبّت.

## Snap

Snap هي صيغة **Canonical** والصيغة الافتراضية على Ubuntu – فهناك مثلًا يكون Firefox
حزمة snap. تأتي حزم snap من **Snap Store**، الذي تديره Canonical، وتديرها الخدمة
`snapd`. وتُحدَّث تلقائيًا في الخلفية.

:::debian
### Snap على Ubuntu وDebian

Snap موجود أصلًا في Ubuntu. أما على Debian فتثبّت `snapd` أولًا:

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Snap على Arch

Snap ليس في مستودعات Arch – بل في الـ AUR فقط. ابنِه كما في الفصل الخاص بعائلة
Arch:

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

على نظام حقيقي تحتاج أيضًا إلى تشغيل الخدمة باستخدام
`sudo systemctl enable --now snapd.socket`. وهذه علامة على أن Snap ليس في بيته على
Arch: فمعظم الناس هناك يستخدمون Flatpak.
:::

:::redhat
### Snap على Fedora

تراهن Fedora على Flatpak، لكن Snap موجود في المستودعات:

```sh
sudo dnf install snapd
```
:::

### استخدام snap

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

تظهر حزم snap المثبّتة بوصفها برامج في `/snap/bin`. ويتطلب التثبيت والإزالة صلاحيات
root.

### صارم أم classic

تعمل معظم حزم snap في عزل **صارم** (strict). أما البرامج التي تحتاج إلى الوصول إلى
النظام كله، مثل محررات الشيفرة، فتُنشر بـ **classic confinement**. وعندها يجب أن
توافق على ذلك بنفسك باستخدام `--classic`:

```sh
sudo snap install code
sudo snap install code --classic
```

```quiz
نُشرت حزمة snap بـ classic confinement. ما الذي يجب أن تضيفه لتثبيتها؟
- [ ] `--user`
- [x] `--classic`
- [ ] `--channel=edge`
```

### القنوات والتحديثات

لكل snap **قنوات** (channels): `stable` و`candidate` و`beta` و`edge` (أحدث إصدار،
غير مختبَر). يعرضها `snap info`، ويختار `--channel=beta` قناة أخرى. تجري التحديثات
تلقائيًا، لكن يمكنك فرضها وإزالة حزم snap:

```sh
sudo snap refresh
sudo snap remove hello-world
```

ولـ Snap منتقدون أيضًا: فـ Snap Store لا تديره إلا Canonical، والتحديثات التلقائية
لا يمكن إيقافها تمامًا، وقد تكون البرامج بطيئة في الإقلاع في المرة الأولى.

## AppImage

**AppImage** برنامج كامل في **ملف واحد فقط**. تنزّله من موقع البرنامج، وتجعله
قابلًا للتنفيذ وتشغّله – دون تثبيت ودون root. وللتخلص من البرنامج تحذف الملف.

يوجد في مجلد المنزل الخاص بك ملف AppImage منزَّل مسبقًا، في `~/Nedladdningar`
(وتعني بالسويدية «التنزيلات»):

```sh
cd ~/Nedladdningar
ls -l
```

ماذا يحدث إذا شغّلته فورًا؟

```predict
$ ~/Nedladdningar/Kalkylator.AppImage
bash: /home/elev/Nedladdningar/Kalkylator.AppImage: Permission denied
---
ليست للملف الصلاحية `x`.
```

الملفات المنزَّلة لا تكون قابلة للتنفيذ في البداية أبدًا. اجعله قابلًا للتنفيذ
وشغّله:

```sh
chmod +x Kalkylator.AppImage
./Kalkylator.AppImage
```

```try
chmod +x ~/Nedladdningar/Kalkylator.AppImage
---
الآن صار الملف قابلًا للتنفيذ. تحقّق من ذلك باستخدام `ls -l ~/Nedladdningar`.
```

### FUSE

يركّب AppImage نفسه بوصفه نظام ملفات باستخدام **FUSE**، ويحتاج إلى الإصدار الأقدم 2
من المكتبة (`libfuse.so.2`). ومن دونها تحصل على الخطأ
*"AppImages require FUSE to run"*.

:::debian
على Ubuntu 24.04 وDebian 13 تسمى الحزمة `libfuse2t64` (تأتي *t64* من الانتقال
إلى الوقت بـ 64 بت؛ وفي الإصدارات الأقدم كانت تسمى `libfuse2`):

```sh
sudo apt update
sudo apt install libfuse2t64
./Kalkylator.AppImage
```

> **لا** تثبّت الحزمة `fuse` على Ubuntu – فهي تستبدل `fuse3`، التي يحتاجها سطح
> المكتب.
:::

:::arch
على Arch تسمى الحزمة `fuse2`:

```sh
sudo pacman -S fuse2
./Kalkylator.AppImage
```
:::

:::redhat
على Fedora تسمى الحزمة `fuse-libs`:

```sh
sudo dnf install fuse-libs
./Kalkylator.AppImage
```
:::

### انظر داخله

يمكن أيضًا فكّ AppImage. وهذا يعمل حتى دون FUSE:

```sh
./Kalkylator.AppImage --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

يفكّ `--appimage-extract-and-run` الملف مؤقتًا ويشغّله فورًا.

### تذكّر

- ليس لـ AppImage **أي عزل** – فالبرنامج يعمل بصفتك ويستطيع الوصول إلى كل ما تستطيع
  أنت الوصول إليه. لا تنزّل إلا من الموقع الرسمي للبرنامج.
- **لا توجد تحديثات تلقائية**. تنزّل ملفًا جديدًا عندما يصدر إصدار جديد (بعض البرامج
  تستطيع تحديث نفسها).
- لا يظهر البرنامج في قائمة التطبيقات من تلقاء نفسه. ويمكن لأدوات مثل *Gear Lever*
  أو *AppImageLauncher* إصلاح ذلك.

## أيّها أختار؟

1. **حزم التوزيعة** لبرامج النظام وسطر الأوامر – فهي الأصغر والأسرع، وتُحدَّث مع
   بقية النظام.
2. **Flatpak** لبرامج سطح المكتب عندما تريد إصدارًا أحدث أو برنامجًا غير موجود في
   المستودعات.
3. **Snap** إذا كنت تستخدم Ubuntu، أو عندما لا يتوفر البرنامج إلا بصيغة snap.
4. **AppImage** لتجربة برنامج بسرعة، أو عندما لا يقدّم المطوّر سوى هذه الصيغة.
