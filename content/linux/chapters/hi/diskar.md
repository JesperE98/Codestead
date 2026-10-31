# Disks और file systems

आप जो files save करते हैं, वे असल में जाती कहाँ हैं? Windows में जवाब एक अक्षर
होता है – `C:`, `D:`, `E:`। Linux में drive letters होते ही नहीं, बस **एक**
directory tree होता है जो `/` से शुरू होता है। इस chapter में आप अंदर झाँकेंगे:
computer में कौन-सी disks हैं, उन्हें कैसे बाँटा गया है, कितनी जगह बची है – और
USB stick को कैसे लगाएँ और कुछ भी खोए बिना कैसे निकालें।

## Disk, partition और file system

तीन शब्द जो अक्सर आपस में गड्डमड्ड हो जाते हैं, लेकिन इनका मतलब अलग-अलग है:

- **Disk** ख़ुद storage device है: एक SSD, hard drive, SD card या USB stick।
- **Partition** disk का एक हिस्सा है। एक disk को कई partitions में बाँटा जा सकता
  है जो अलग-अलग कामों के लिए इस्तेमाल होते हैं। हर partition कहाँ शुरू होता है और
  कहाँ ख़त्म, यह disk की **partition table** में दर्ज होता है – नए computers पर
  **GPT** type की, और पुराने computers और ज़्यादातर USB sticks पर पुरानी **MBR**
  (जिसे tools `dos` कहते हैं)।
- **File system** partition के *अंदर* की व्यवस्था है: file names, directories,
  permissions और ख़ुद content किस तरह store होते हैं। नया partition तब तक ख़ाली और
  बेकार होता है जब तक आप उस पर file system न बनाएँ – **formatting** का यही मतलब है।

Disk को एक ख़ाली godown समझिए, partitions को वे दीवारें जो उसे कमरों में बाँटती
हैं, और file system को हर कमरे की shelves और labels। Shelves के बिना आपको कुछ भी
नहीं मिलेगा।

```quiz
आपने अभी-अभी एक डिस्क पर नया पार्टिशन बनाया है। आप उस पर अभी फ़ाइलें सेव क्यों
नहीं कर सकते?
- [ ] पहले उसे पार्टिशन टेबल में जोड़ना होगा
- [x] उस पर अभी कोई फ़ाइल सिस्टम नहीं है – पहले उसे फ़ॉर्मैट करना होगा
- [ ] पार्टिशन में फ़ाइलें नहीं रह सकतीं, सिर्फ़ डिस्क में रह सकती हैं
- [ ] पहले उसे एक ड्राइव लेटर मिलना चाहिए
---
नया पार्टिशन तब तक ख़ाली और बेकार रहता है जब तक आप उस पर फ़ाइल सिस्टम नहीं
बनाते। फ़ॉर्मैट करने का यही मतलब है।
```

## Disks `/dev` में files हैं

Linux में लगभग हर चीज़ एक file है – disks भी। हर disk और partition की `/dev` में
एक **device file** होती है:

```sh
ls -l /dev/sd*
```

| Device file | क्या है |
|---|---|
| `/dev/sda` | पहली disk (SATA, USB या virtual disk) |
| `/dev/sda1`, `/dev/sda2` | `sda` पर partitions 1 और 2 |
| `/dev/sdb` | दूसरी disk – इस computer में USB stick |
| `/dev/nvme0n1`, `/dev/nvme0n1p1` | एक NVMe SSD और उसका पहला partition |
| `/dev/vda` | Virtual machine में एक disk |
| `/dev/mmcblk0p1` | SD card पर पहला partition (जैसे Raspberry Pi में) |

अक्षर उसी क्रम में बाँटे जाते हैं जिसमें disks मिलती हैं। अगर computer में NVMe
SSD है, तो USB stick भी `sda` बन सकती है – इसलिए **कभी अंदाज़ा मत लगाइए**, हमेशा
जाँचिए। Device files का owner root और group `disk` होते हैं, इसलिए सामान्य user के
रूप में आप disks को सीधे नहीं पढ़ सकते।

## कौन-सी disks हैं? – `lsblk`

`lsblk` (*list block devices*) disks को एक tree की तरह बनाता है, हर disk के नीचे
उसके partitions के साथ:

```sh
lsblk
```

| Column | मतलब |
|---|---|
| `NAME` | `/dev` में नाम |
| `RM` | 1 = removable, जैसे USB stick |
| `SIZE` | Size |
| `TYPE` | `disk` या `part` (partition) |
| `MOUNTPOINTS` | File system directory tree में कहाँ दिखता है, swap के लिए `[SWAP]` |

इस कंप्यूटर पर `sda1` **EFI partition** है (जिससे कंप्यूटर का firmware boot करता
है) `/boot/efi` पर, `sda2` **root file system** `/` है और `sda3` **swap** है। दूसरे
डिस्ट्रीब्यूशन – और दूसरे इंस्टॉलेशन – डिस्क को अलग तरह से बाँट सकते हैं, इसलिए
मान लेने के बजाय हमेशा देख लीजिए।

`-f` के साथ `lsblk` file systems भी दिखाता है – type, label, UUID और कितनी जगह
ख़ाली है:

```sh
lsblk -f
```

`sdb1` पर ध्यान दीजिए: एक `vfat` file system जिसका label `USBMINNE` है और जो कहीं
mount नहीं है। यही वह USB stick है जिसे हम लगाने वाले हैं।

## अलग-अलग file systems

File systems बहुत-से हैं, और हर एक की अपनी ख़ूबियाँ हैं:

| File system | किसके लिए |
|---|---|
| `ext4` | Classic Linux standard। Stable और तेज़ – Debian और Ubuntu इसे इस्तेमाल करते हैं |
| `btrfs` | Snapshots, compression और subvolumes। Fedora और openSUSE में default |
| `xfs` | बड़ी files और servers के लिए अच्छा। Red Hat Enterprise Linux में default |
| `vfat` (FAT32) | हर जगह चलता है: Windows, macOS, cameras, car stereos। Linux permissions नहीं, और हर file ज़्यादा से ज़्यादा 4 GiB। EFI partition का FAT होना ज़रूरी है |
| `exfat` | FAT जैसा, लेकिन 4 GiB की limit के बिना। नई USB sticks और SD cards पर आम |
| `ntfs` | Windows का file system। Linux इसे पढ़ और लिख सकता है |
| `swap` | Files के लिए file system नहीं – disk पर अतिरिक्त "memory" |
| `tmpfs` | एक file system जो सिर्फ़ RAM में होता है और reboot पर ग़ायब हो जाता है |

## सब कुछ एक tree है – mounting

File system को **mount** करने का मतलब है उसे directory tree में किसी ख़ास
directory, यानी **mount point**, पर जोड़ना। Root file system `/` पर mount होता है,
और बाक़ी सब कुछ उसके नीचे कहीं टाँग दिया जाता है। इसीलिए Linux को drive letters की
ज़रूरत नहीं पड़ती: दूसरी disk बस एक और directory है।

`findmnt` सारे mounts को tree की तरह दिखाता है:

```sh
findmnt
```

और बिना arguments के `mount` वही चीज़ list करता है, हर file system के लिए एक line:

```sh
mount
```

आपको ऐसी चीज़ें भी दिखेंगी जो disks नहीं हैं: `/proc` पर `proc` और `/sys` पर
`sysfs` kernel की जानकारी हैं जो files का रूप धरे हुए हैं, और `tmpfs` RAM में
file systems हैं। आम mount points:

| Directory | किसके लिए |
|---|---|
| `/` | Root file system |
| `/boot`, `/boot/efi` | Kernel और EFI partition |
| `/mnt` | अस्थायी mounts जो आप हाथ से करते हैं |
| `/media/{{user}}/…` या `/run/media/{{user}}/…` | जहाँ desktop USB sticks को अपने-आप mount करता है |

## कितनी जगह बची है? – `df`

`df` (*disk free*) दिखाता है कि हर mounted file system कितना भरा है। `-h` से आपको
इंसानों के पढ़ने लायक sizes मिलते हैं:

```sh
df -h
```

| Column | मतलब |
|---|---|
| `Filesystem` | File system कहाँ है, जैसे कोई partition या `tmpfs` |
| `Size`, `Used`, `Avail` | Size, इस्तेमाल हुई और उपलब्ध जगह |
| `Use%` | कितना भरा है |
| `Mounted on` | Mount point |

`-T` file system का type जोड़ देता है, और अगर आप कोई path दें तो सिर्फ़ वही file
system दिखता है जिस पर वह path है:

```sh
df -hT
df -h ~
```

ध्यान दिया कि `Used` और `Avail` जोड़ने पर ठीक `Size` नहीं बनता? ext4 root के लिए
5 % जगह reserve रखता है, ताकि सामान्य user के disk भर देने पर भी system चलता रहे।

```try
df -hT
---
`Type` कॉलम दिखाता है कि `/` `ext4` है और `/boot/efi` `vfat` है।
```

## `df` या `du`?

लगभग एक जैसे नाम वाले दो commands, लेकिन ये अलग-अलग सवालों के जवाब देते हैं:

| सवाल | Command |
|---|---|
| **Disk** कितनी भरी है? | `df -h` – file system से पूछता है |
| ये **files** कितनी जगह लेती हैं? | `du -sh directory` – files में से गुज़रकर उन्हें जोड़ता है |

जब disk भर जाती है तो आप दोनों इस्तेमाल करते हैं: पहले `df -h` से देखते हैं कि
*कौन-सा* file system भरा है, फिर `du` से पता करते हैं कि जगह *क्या* ले रहा है:

```sh
du -h -d 1 ~
```

## USB stick mount करना

अब USB stick लगाते हैं। पहले: यह कौन-सा device है? `lsblk -f` ने एक removable
disk, `sdb`, दिखाई थी, जिस पर `USBMINNE` label वाला partition `sdb1` है। Mount आप
**partition** को करते हैं, पूरी disk को नहीं।

फिर आपको एक mount point चाहिए – एक साधारण, ख़ाली directory। उसे बनाने और mount
करने, दोनों के लिए root चाहिए:

```sh
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
```

`mount` FAT file system को ख़ुद पहचान लेता है; अगर आप साफ़-साफ़ बताना चाहें तो
`-t vfat` जोड़ सकते हैं। अब stick की files directory में दिखती हैं:

```sh
ls -l /mnt/usb
df -h /mnt/usb
```

अब से stick किसी भी दूसरी directory की तरह काम करती है। एक file अपनी home
directory में copy कीजिए:

```sh
cp /mnt/usb/{{todo}} ~
```

> **सब कुछ root का क्यों है?** FAT में Linux permissions नहीं होतीं। इसलिए जब FAT
> stick mount होती है, तो *सारी* files को एक ही owner और permissions मिलती हैं –
> owner वह है जिसने mount किया, यानी root। Stick पर लिखने के लिए आपको या तो `sudo`
> चाहिए, या उसे ऐसे mount करना होगा कि owner आप बनें:
> `sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb` (1000 आपका user id है –
> `id` देखिए)।

Device name की जगह label से भी mount किया जा सकता है:
`sudo mount LABEL=USBMINNE /mnt/usb`। Desktop वाले computer पर stick लगाते ही
file manager यह सब अपने-आप कर देता है।

```quiz
`sudo mount /dev/sdb1 /mnt/usb` के बाद FAT स्टिक की हर फ़ाइल का मालिक root है।
क्यों?
- [ ] फ़ाइलें किसी दूसरे कंप्यूटर पर root ने बनाई थीं
- [x] FAT में Linux अनुमतियाँ नहीं होतीं, इसलिए सभी फ़ाइलों को माउंट करने वाले का स्वामित्व मिलता है – root
- [ ] `/mnt` में सब कुछ हमेशा root का होता है
- [ ] USB स्टिक सिर्फ़ root इस्तेमाल कर सकता है
---
`-o uid=1000,gid=1000` से आप माउंट करते समय मालिक ख़ुद चुन सकते हैं।
```

## Unmount – stick निकालने से पहले!

Linux हमेशा तुरंत disk पर नहीं लिखता। बदलाव RAM (*cache*) में इकट्ठा होते हैं और
थोड़ी देर बाद लिखे जाते हैं, क्योंकि ऐसा करना बहुत तेज़ है। अगर आप ऐसी stick निकाल
लें जो अब भी mounted है, तो जो files आपने "save" की थीं वे ग़ायब या ख़राब हो सकती
हैं। इसीलिए पहले **unmount** किया जाता है – जिसकी spelling `umount` है, बिना n के:

```text
sudo umount /mnt/usb
```

`umount` इंतज़ार कर रही हर चीज़ लिख देता है और फिर file system को अलग कर देता है।
Prompt वापस आने पर stick निकालना सुरक्षित है। (`sync` भी इंतज़ार कर रही हर चीज़
लिख देता है, लेकिन unmount किए बिना।)

अगर कोई चीज़ file system इस्तेमाल कर रही है, तो `umount` मना कर देता है:

```text
$ cd /mnt/usb
$ sudo umount /mnt/usb
umount: /mnt/usb: target is busy.
```

यहाँ आपका अपना shell उसी directory में खड़ा है। `cd ~` से बाहर निकलिए और फिर से
कोशिश कीजिए। Unmount के बाद `/mnt/usb` फिर से एक ख़ाली directory है – लेकिन files,
और आपके किए बदलाव, अगली बार mount करने पर भी stick पर मौजूद रहते हैं।

```quiz
USB स्टिक निकालने से पहले उसे अनमाउंट क्यों करना चाहिए?
- [ ] वरना स्टिक की फ़ाइलें मिट जाती हैं
- [x] बदलाव अभी भी RAM में इंतज़ार कर रहे हो सकते हैं – `umount` फ़ाइल सिस्टम को अलग करने से पहले उन्हें लिख देता है
- [ ] वरना अगली बार स्टिक को नया डिवाइस नाम मिलता है
- [ ] स्टिक तब तक दोबारा माउंट नहीं हो सकती जब तक उसे उसी कंप्यूटर पर अनमाउंट न किया जाए
---
Linux बदलावों को RAM (*cache*) में इकट्ठा करता है और उन्हें थोड़ी देर बाद लिखता है।
अगर स्टिक माउंट रहते हुए निकाल ली जाए, तो वे फ़ाइलें खो सकती हैं जिन्हें आपने
"सेव" किया था।
```

## `/etc/fstab` – boot पर क्या mount होता है

Root file system, `/boot` और swap हर बार computer start होने पर अपने-आप mount हो
जाते हैं। क्या mount होना चाहिए, यह file `/etc/fstab` (*file system table*) में
लिखा होता है:

```sh
cat /etc/fstab
```

हर line में छह columns होते हैं:

| Column | उदाहरण | मतलब |
|---|---|---|
| Device | `UUID=3f1c…` | कौन-सा file system |
| Mount point | `/` | Tree में कहाँ (swap के लिए `none`) |
| Type | `ext4` | File system का type |
| Options | `defaults`, `errors=remount-ro` | Mount options, comma से अलग किए हुए |
| dump | `0` | पुराना backup flag, लगभग हमेशा 0 |
| pass | `1` | Boot पर `fsck` इन्हें किस क्रम में जाँचता है (1 = root, 2 = बाक़ी, 0 = कभी नहीं) |

Option `errors=remount-ro` का मतलब है कि कोई error मिलने पर root file system को
read-only कर दिया जाता है – और ज़्यादा नुकसान होने से यह बेहतर है।
`# / was on /dev/sda2 during installation` जैसे comments installer ने लिखे थे।

सिर्फ़ `/dev/sda2` की जगह `UUID=…` क्यों? Device names बदल सकते हैं – नई disk
लगाइए और पुरानी disk को नया अक्षर मिल सकता है। UUID file system के साथ ही बनता है
और कभी नहीं बदलता। इसे आप `lsblk -f`, `blkid` या `findmnt` से पता कर सकते हैं:

```sh
sudo blkid
findmnt -n -o UUID /
```

`findmnt` में `-o` चुनता है कि कौन-से कॉलम दिखें और `-n` शीर्षक छोड़ देता है – तब
काम का जब आपको सिर्फ़ मान चाहिए।

```predict
$ findmnt -n -o FSTYPE /boot/efi
vfat
---
`/boot/efi` EFI पार्टिशन है, और EFI पार्टिशन का FAT होना ज़रूरी है।
```

अगर आप चाहते हैं कि stick हमेशा `/mnt/usb` पर mount की जा सके, तो आप इस तरह की
एक line जोड़ सकते हैं:

```text
LABEL=USBMINNE  /mnt/usb  vfat  noauto,user,uid=1000,gid=1000  0  0
```

`noauto` का मतलब है कि यह boot पर mount नहीं होती (हो सकता है stick लगी ही न हो),
और `user` का मतलब है कि सामान्य users इसे mount कर सकते हैं – तब `sudo` के बिना
`mount /mnt/usb` काफ़ी है।

> **चेतावनी:** `/etc/fstab` में एक ग़लती computer को ठीक से boot होने से रोक सकती
> है। Reboot करने से *पहले* बदलावों को हमेशा `sudo mount -a` से test कीजिए, जो file
> में लिखी हर वह चीज़ mount कर देता है जो अभी mount नहीं है। जो external disks
> हमेशा जुड़ी नहीं रहतीं, उनके लिए option `nofail` जोड़िए।

## Swap

**Swap** वह जगह है जो RAM ख़त्म होने पर इस्तेमाल होती है: memory के जो हिस्से अभी
इस्तेमाल नहीं हो रहे, उन्हें वहाँ भेज दिया जाता है, ताकि programs समा सकें। Swap
RAM से बहुत धीमा है, इसलिए जो computer बहुत swap करता है वह सुस्त हो जाता है –
लेकिन programs के crash होने से यह बेहतर है।

```sh
swapon --show
free -h
```

यहाँ swap एक अलग partition है, `sda3`। बहुत-सी installations (जैसे नए Ubuntu)
इसकी जगह root file system पर एक *swap file* इस्तेमाल करती हैं।

## Partitioning और formatting – पूरी सावधानी के साथ

`fdisk -l` सारी disks की partition tables दिखाता है: हर partition कहाँ शुरू और
कहाँ ख़त्म होता है और उसका type क्या है। इसके लिए root चाहिए:

```sh
sudo fdisk -l
```

`fdisk` (`-l` के बिना), `parted` या graphical `gparted` से आप partition table
बदल सकते हैं, और `mkfs` से आप नया file system बनाते हैं – यानी format करते हैं:

```text
sudo umount /mnt/usb
sudo mkfs.vfat -n USBMINNE /dev/sdb1    # FAT32 – हर जगह चलता है
sudo mkfs.ext4 -L BACKUP /dev/sdb1      # ext4 – Linux permissions, लेकिन सिर्फ़ Linux पर
```

> **चेतावनी!** `fdisk` और `mkfs` सबसे ख़तरनाक commands में से हैं। एक ग़लत अक्षर –
> `sdb` की जगह `sda` – और पूरी system disk ख़त्म। असली computer पर कुछ भी format
> करने से पहले: `lsblk -f` से जाँचिए कि size, `RM` column और label मेल खाते हैं,
> पक्का कीजिए कि partition mounted नहीं है, और हर ज़रूरी चीज़ का backup रखिए।

Simulator में आप USB stick पर `mkfs.ext4` और `mkfs.vfat` आज़मा सकते हैं – लेकिन
पहले tasks पूरे कर लीजिए, क्योंकि stick की files मिट जाती हैं। System के अपने
partitions सुरक्षित हैं क्योंकि वे mounted हैं, बिल्कुल असली system की तरह।

## सारांश

| Command | क्या करता है |
|---|---|
| `lsblk`, `lsblk -f` | Disks, partitions और file systems दिखाता है |
| `blkid` | Type, label और UUID दिखाता है |
| `df -h` | File systems कितने भरे हैं? |
| `du -sh directory` | Files कितनी जगह लेती हैं? |
| `findmnt`, `mount` | क्या mount है, और कहाँ? |
| `sudo mount /dev/sdb1 /mnt/usb` | File system mount करता है |
| `sudo umount /mnt/usb` | Unmount – stick निकालने से पहले |
| `cat /etc/fstab` | Boot पर क्या mount होता है? |
| `swapon --show` | Swap दिखाता है |
| `sudo fdisk -l` | Partition tables दिखाता है |
