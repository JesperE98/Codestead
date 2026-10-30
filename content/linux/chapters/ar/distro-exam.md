# اختبار: التوزيعات والحزم

أجب عن الأسئلة أدناه. تحتاج إلى 80 % للنجاح.

```quiz
أيّ ملف يخبرك باسم التوزيعة وإصدارها في كل التوزيعات الحديثة؟
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
يعرض `uname -r` إصدار نواة لينكس.
```

```quiz
أيّ مدير حزم وصيغة حزم يتلازمان؟
- [x] `pacman` و`.pkg.tar.zst`
- [ ] `dnf` و`.deb`
- [ ] `apt` و`.rpm`
```

```quiz
أيّ توزيعة متجددة (*rolling release*) بلا إصدارات؟
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
ما الفرق بين `apt update` و`apt upgrade`؟
- [x] ينزّل `update` قائمة الحزم المتاحة، ويثبّت `upgrade` الإصدارات الجديدة
- [ ] يثبّت `update` الإصدارات الجديدة، وينزّل `upgrade` القائمة
- [ ] لا فرق بينهما
```

```quiz
أيّ أمر يثبّت الحزمة `htop` على Arch؟
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
لماذا من السيئ أن تشغّل `pacman -Sy` ثم `pacman -S package`؟
- [ ] لأنه يثبّت الحزمة مرتين
- [x] لأنها ترقية جزئية قد تعطّل النظام
- [ ] لأن `-Sy` يزيل كل الحزم المثبّتة
```

```quiz
يسألك dnf `Is this ok [y/N]` فتضغط Enter فقط. ماذا يحدث؟
- [ ] تُثبَّت الحزمة
- [x] لا يُثبَّت شيء – «لا» هي الإجابة الافتراضية
```

```quiz
أيّ مما يلي صحيح عن الـ AUR؟
- [x] يحتوي على وصفات بناء (`PKGBUILD`)، لا على حزم جاهزة
- [x] حزمه لا تراجعها Arch
- [ ] يحدّث `sudo pacman -Syu` حزم الـ AUR
- [ ] يجب تشغيل `makepkg` باستخدام sudo
```

```quiz
أيّ أمر يضيف مستودع COPR على Fedora؟
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` و`makepkg -si`
```

```quiz
كيف تُحدَّث حزم Snap؟
- [ ] باستخدام `flatpak update`
- [x] تلقائيًا في الخلفية
- [ ] بتنزيل ملف جديد من موقع المطوّر
```

```predict
$ ~/Nedladdningar/Kalkylator.AppImage
bash: /home/elev/Nedladdningar/Kalkylator.AppImage: Permission denied
---
الملف المنزّل لا يكون قابلًا للتنفيذ في البداية أبدًا. شغّل
`chmod +x ~/Nedladdningar/Kalkylator.AppImage` أولًا.
```

```quiz
تريد إصدارًا أحدث من برنامج سطح مكتب غير موجود في مستودعات التوزيعة. بماذا توصي
القاعدة العامة أولًا؟
- [ ] بمستودع إضافي من شخص لا تعرفه
- [x] بحزمة Flatpak
- [ ] ببناء البرنامج من الشيفرة المصدرية بصلاحيات root
```
