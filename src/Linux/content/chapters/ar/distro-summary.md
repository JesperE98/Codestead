# ملخّص: التوزيعات والحزم

## العائلات

الأساس واحد في كل التوزيعات: نواة لينكس، وbash وأدوات GNU، وتنظيم المجلدات، و(في
كل مكان تقريبًا) systemd. أما ما يميّز العائلات بعضها من بعض فهو أساسًا طريقة
تثبيت البرامج.

| | عائلة Debian | عائلة Arch | عائلة Red Hat |
|---|---|---|---|
| أمثلة | Debian وUbuntu وLinux Mint | Arch وManjaro وEndeavourOS | Fedora وRHEL وRocky Linux |
| مدير الحزم | `apt` | `pacman` | `dnf` |
| صيغة الحزم | `.deb` | `.pkg.tar.zst` | `.rpm` |
| الأداة منخفضة المستوى | `dpkg` | (pacman) | `rpm` |
| مجموعة sudo | `sudo` | `wheel` | `wheel` |
| الإصدارات | إصدارات مستقرة | متجددة (rolling) | إصدار جديد كل 6 أشهر (Fedora) |

- يعرض `cat /etc/os-release` التوزيعة التي تشغّلها، ويعرض `uname -r` إصدار
  النواة.
- **الحزمة** برنامج معبّأ في ملف، و**المستودع** خادم عليه حزم التوزيعة المختبَرة
  والموقّعة، و**الاعتمادية** حزمة أخرى مطلوبة – ويثبّتها مدير الحزم تلقائيًا.
- الأوامر التي تغيّر النظام تتطلب صلاحيات root، لذا تُشغَّل باستخدام `sudo`.

## الشيء نفسه – بثلاث لهجات

| ماذا | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| تحديث قائمة الحزم | `apt update` | `pacman -Sy` | `dnf check-update` |
| ترقية كل شيء | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| التثبيت | `apt install X` | `pacman -S X` | `dnf install X` |
| الإزالة | `apt remove X` | `pacman -R X` | `dnf remove X` |
| البحث | `apt search X` | `pacman -Ss X` | `dnf search X` |
| معلومات الحزمة | `apt show X` | `pacman -Si X` | `dnf info X` |
| عرض المثبّت | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

أمور يجب تذكّرها:

- **apt**: لا ينزّل `apt update` سوى قائمة الحزم – أما `apt upgrade` فيثبّت
  الإصدارات الجديدة. شغّل `update` أولًا. و`[Y/n]` يعني أن Enter يجيب بنعم.
- **pacman**: الحرف الكبير هو العملية (`-S` و`-R` و`-Q`) والأحرف الصغيرة
  معدِّلات. رقِّ دائمًا باستخدام `-Syu` – ولا تستخدم أبدًا `-Sy` ثم `-S package`
  (فالترقية الجزئية قد تعطّل النظام).
- **dnf**: يجلب معلومات الحزم بنفسه. ويخرج `dnf check-update` بالرمز `100` عندما
  توجد تحديثات. و`[y/N]` يعني أن Enter يجيب بـ **لا**.

للحزم عادةً الاسم نفسه في كل مكان، لكن ليس دائمًا – فاسم Vim في Fedora هو
`vim-enhanced`. ابحث إذا لم تكن متأكدًا.

## المستودعات الإضافية

| | PPA | AUR | COPR |
|---|---|---|---|
| العائلة | Ubuntu (ومثلًا Linux Mint) | Arch (ومثلًا Manjaro وEndeavourOS) | Fedora (وعائلة RHEL) |
| ما الذي تنزّله | حزم `.deb` جاهزة | وصفة بناء (`PKGBUILD`) – تبني الحزمة بنفسك | حزم `.rpm` جاهزة |
| إضافته | `add-apt-repository ppa:…` | `git clone …` و`makepkg -si` | `dnf copr enable …` |
| يُحدَّث باستخدام | `sudo apt update && sudo apt upgrade` | `yay -Syu` – أو أعد البناء بنفسك | `sudo dnf upgrade` |
| إزالة المستودع | `sudo add-apt-repository --remove ppa:…` | – (لا يوجد مستودع لإزالته) | `sudo dnf copr remove …` |
| تراجعه التوزيعة | لا | لا | لا |

- الحزم من مستودع إضافي تُثبَّت بصلاحيات root، وقد تتعارض مع حزم النظام نفسه، وقد
  يتوقف تحديثها. ابحث أولًا في مستودعات التوزيعة، ثم عن Flatpak، وبعد ذلك فقط في
  مستودع إضافي من شخص تثق به.
- يعرض `apt policy` من أين تأتي الحزمة، ويختار apt الإصدار الأعلى.
- اقرأ دائمًا الـ `PKGBUILD` قبل أن تبني. ولا تشغّل `makepkg` باستخدام sudo. يسرد
  `pacman -Qm` الحزم *الأجنبية* (foreign)، ولا يحدّثها `pacman -Syu` – بل تحدّثها
  أداة مساعدة للـ AUR مثل `yay`.

## الحزم العامة

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| مصدره | Flathub (أو *remotes* أخرى) | Snap Store (Canonical) | موقع المطوّر |
| عزل (sandbox) | نعم | نعم (ما عدا *classic*) | لا |
| التحديثات | `flatpak update` | تلقائيًا في الخلفية | بنفسك – تنزّل ملفًا جديدًا |
| التثبيت | `flatpak install flathub ID` | `sudo snap install name` | `chmod +x file` ثم شغّله |

- لبرامج Flatpak معرّف يُكتب كاسم نطاق معكوس (`org.gimp.GIMP`)، وتُشغَّل باستخدام
  `flatpak run`. ويثبّت `--user` في مجلد المنزل، مع remotes خاصة به.
- Snap هو الافتراضي على Ubuntu. تحتاج حزم snap ذات العزل الكلاسيكي إلى `--classic`،
  ولكل snap قنوات مثل `stable` و`edge`.
- يحتاج AppImage إلى FUSE 2 (`libfuse2t64` على Ubuntu 24.04 وDebian 13، و`fuse2`
  على Arch، و`fuse-libs` على Fedora)، وليس له عزل ولا تحديثات تلقائية.

**قاعدة عامة:** حزم التوزيعة لبرامج النظام وبرامج سطر الأوامر، وFlatpak لبرامج سطح
المكتب، وSnap على Ubuntu أو عندما لا يوجد البرنامج إلا كـ snap، وAppImage لتجربة
برنامج بسرعة.
