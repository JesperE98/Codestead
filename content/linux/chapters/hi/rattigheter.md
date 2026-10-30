# Users, permissions और sudo

Linux इस तरह बना है कि कई users एक ही computer share कर सकें। इसीलिए हर file
का एक owner होता है और नियम होते हैं कि कौन क्या कर सकता है।

## Users और groups

आप user `elev` के रूप में logged in हैं। हर user एक या ज़्यादा **groups** का
हिस्सा होता है:

```sh
id
```

सबसे ज़रूरी user है **root** – administrator, जिसे सब कुछ करने की इजाज़त है।
Root के रूप में login कम ही किया जाता है। इसकी जगह आप `sudo` इस्तेमाल करते हैं
(नीचे देखिए)।

## Permissions पढ़ना

`ls -l` चलाइए और पहला column देखिए:

```text
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
```

पहला character type बताता है: file के लिए `-`, directory के लिए `d`। उसके बाद
तीन-तीन characters के तीन sets आते हैं:

```text
-     rw-     r--     r--
type  owner   group   others
```

| Character | File के लिए | Directory के लिए |
|---|---|---|
| `r` (read) | Content पढ़ना | Content की list देखना |
| `w` (write) | Content बदलना | उसमें files बनाना और delete करना |
| `x` (execute) | File को program की तरह चलाना | `cd` से directory में जाना |

उसके बाद owner (`elev`) और group (`elev`) आते हैं।

```quiz
एक डायरेक्टरी की अनुमतियाँ `drwxr-x---` हैं। उसके समूह के सदस्य क्या कर सकते हैं?
- [ ] कुछ भी नहीं
- [x] सामग्री की सूची देख सकते हैं और `cd` से उसमें जा सकते हैं, लेकिन उसमें फ़ाइलें बना या हटा नहीं सकते
- [ ] वह सब कुछ जो मालिक कर सकता है
---
समूह का सेट `r-x` है: `r` से आप सामग्री की सूची देख सकते हैं और `x` से
डायरेक्टरी में जा सकते हैं। `w` के बिना आप उसमें फ़ाइलें बना या हटा नहीं सकते।
```

## Permissions बदलना – `chmod`

Permissions **numbers** में दी जा सकती हैं। हर set को एक अंक मिलता है जो
r = 4, w = 2 और x = 1 का जोड़ होता है:

| Number | Permissions | आम तौर पर किसके लिए |
|---|---|---|
| `755` | `rwxr-xr-x` | Programs और directories |
| `644` | `rw-r--r--` | सामान्य files |
| `600` | `rw-------` | गुप्त files |

```sh
chmod 644 anteckningar.txt
```

या **symbols** से: `u` (owner), `g` (group), `o` (others), `a` (all), उसके बाद
`+`, `-` या `=` और permissions:

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

```predict
$ touch plan.txt
$ chmod 600 plan.txt
$ chmod g+r plan.txt
$ ls -l plan.txt | awk '{print $1}'
-rw-r-----
```

## Scripts

**Script** एक text file होती है जिसमें commands होते हैं। पहली line,
`#!/bin/bash`, को *shebang* कहते हैं और यह system को बताती है कि file किस
program से चलाई जाए:

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Today is:"; date' >> datum.sh
cat datum.sh
```

Script को program की तरह चलाने के लिए उसका executable होना ज़रूरी है:

```sh
chmod +x datum.sh
./datum.sh
```

`./` इसलिए ज़रूरी है क्योंकि जिस directory में आप हैं, वह `PATH` का हिस्सा नहीं है।

```quiz
आपने स्क्रिप्ट `test.sh` लिखी है और `./test.sh` चलाते हैं, लेकिन
`Permission denied` मिलता है। क्या कमी है?
- [ ] आगे एक `sudo`
- [x] चलाने (execute) की अनुमति – पहले `chmod +x test.sh` चलाइए
- [ ] `./` – सही है `test.sh`
---
किसी फ़ाइल को प्रोग्राम की तरह चलाने के लिए उसे `x` अनुमति चाहिए। `./` सही है:
उसके बिना शेल सिर्फ़ `PATH` की डायरेक्टरी में ढूँढता है।
```

## root और sudo

कुछ files, जैसे `/etc/shadow` जिसमें passwords रखे जाते हैं, सिर्फ़ root पढ़
सकता है। `sudo` (*superuser do*) से आप एक अकेला command root के रूप में चलाते हैं:

```sh
sudo whoami
```

पहली बार `sudo` **आपका अपना** password माँगता है। सिर्फ़ administrators के group
वाले users ही sudo इस्तेमाल कर सकते हैं। Ubuntu पर उस समूह का नाम **sudo** है –
जब आप `id` चलाते हैं, तो आप उसे अपने समूहों में देख सकते हैं। कुछ दूसरे
डिस्ट्रीब्यूशन इस समूह को `wheel` कहते हैं; डिस्ट्रीब्यूशनों के बीच के अंतर के
बारे में आप डिस्ट्रीब्यूशन वाले भाग में और पढ़ेंगे।

अगर आपको root के रूप में बहुत सारे commands चलाने हैं, तो आप `sudo -i` से एक
root shell शुरू कर सकते हैं। तब prompt `#` में बदल जाता है। `exit` से वापस
आइए।

> **ध्यान रखिए!** sudo के साथ कोई safety net नहीं होता। सिर्फ़ वही commands
> चलाइए जिन्हें आप समझते हैं।

```quiz
`sudo` पासवर्ड माँगता है। आपको किसका पासवर्ड टाइप करना चाहिए?
- [ ] root का पासवर्ड
- [x] अपना ख़ुद का पासवर्ड
- [ ] कोई पासवर्ड नहीं – बस Enter दबाइए
---
`sudo` **आपका अपना** पासवर्ड माँगता है, और आपको तभी आगे जाने देता है जब आप
प्रशासकों (administrators) के समूह में हों।
```

### एक आम जाल

```text
sudo echo "text" > /etc/file     # यह काम नहीं करता
```

`>` के लिए file *आपका* shell खोलता है – sudo नहीं। इसकी जगह `tee` इस्तेमाल कीजिए,
जो sudo के साथ चलता है:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```

```quiz
`sudo echo "text" > /etc/file` काम क्यों नहीं करता?
- [ ] `echo` को sudo के साथ नहीं चलाया जा सकता
- [x] `>` के लिए फ़ाइल आपका अपना शेल खोलता है, और वह root के रूप में नहीं चलता
- [ ] `/etc` की फ़ाइलें कभी बदली नहीं जा सकतीं
---
sudo सिर्फ़ कमांड (`echo`) पर लागू होता है। रीडायरेक्शन आपका शेल संभालता है,
जो आपके रूप में चलता है। फ़ाइल लिखने वाला प्रोग्राम `tee` है, इसलिए sudo की
ज़रूरत `tee` को है।
```
