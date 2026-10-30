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

## root और sudo

कुछ files, जैसे `/etc/shadow` जिसमें passwords रखे जाते हैं, सिर्फ़ root पढ़
सकता है। `sudo` (*superuser do*) से आप एक अकेला command root के रूप में चलाते हैं:

```sh
sudo whoami
```

पहली बार `sudo` **आपका अपना** password माँगता है। सिर्फ़ administrators के group
वाले users ही sudo इस्तेमाल कर सकते हैं। {{distro}} पर उस group का नाम
**{{adminGroup}}** है:

:::debian
Debian family में इस group का नाम `sudo` है।
:::

:::arch
Arch family में इस group का नाम `wheel` है – "ज़िम्मेदार लोगों" के लिए एक पुराना
Unix नाम (अंग्रेज़ी मुहावरे *big wheel* से, यानी कोई बड़ा आदमी)।
:::

:::redhat
Red Hat family में इस group का नाम `wheel` है – "ज़िम्मेदार लोगों" के लिए एक
पुराना Unix नाम (अंग्रेज़ी मुहावरे *big wheel* से, यानी कोई बड़ा आदमी)।
:::

अगर आपको root के रूप में बहुत सारे commands चलाने हैं, तो आप `sudo -i` से एक
root shell शुरू कर सकते हैं। तब prompt `#` में बदल जाता है। `exit` से वापस
आइए।

> **ध्यान रखिए!** sudo के साथ कोई safety net नहीं होता। सिर्फ़ वही commands
> चलाइए जिन्हें आप समझते हैं।

### एक आम जाल

```text
sudo echo "text" > /etc/file     # यह काम नहीं करता
```

`>` के लिए file *आपका* shell खोलता है – sudo नहीं। इसकी जगह `tee` इस्तेमाल कीजिए,
जो sudo के साथ चलता है:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```
