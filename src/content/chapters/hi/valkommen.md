# Linux shell में आपका स्वागत है

यह गाइड आपको command line से Linux इस्तेमाल करना सिखाती है – आपके सबसे पहले
commands से लेकर अलग-अलग distributions पर package management तक। हर chapter
एक topic समझाता है और आख़िर में कुछ **tasks** होते हैं, जिन्हें आप दाईं ओर
वाले terminal में हल करते हैं। जैसे ही आप कोई task सही कर लेते हैं, उस पर अपने-आप
टिक लग जाता है। सीखने का सबसे अच्छा तरीक़ा है *करके देखना*: पढ़िए, आज़माइए,
ग़लतियाँ कीजिए, और फिर से कोशिश कीजिए।

## Linux क्या है?

सख़्ती से कहें तो **Linux** सिर्फ़ *kernel* है: वह program जो hardware से बात
करता है और बाक़ी programs को processor, memory और disks आपस में बाँटने देता है।
Kernel को Linus Torvalds ने 1991 में बनाया था और यह free software है।

एक इस्तेमाल लायक़ system के लिए इससे कहीं ज़्यादा चाहिए: एक shell, files
संभालने के tools, एक package manager, शायद एक desktop भी। एक **distribution**
(*distro*) यह सब मिलाकर एक तैयार पैकेज बना देता है। अभी आप **{{distro}}**
चला रहे हैं।

Distributions को *families* में बाँटा जाता है, जो एक-दूसरे पर आधारित होती हैं
और एक ही package manager इस्तेमाल करती हैं:

| Family | Package manager | उदाहरण |
|---|---|---|
| Debian | `apt` | Debian, Ubuntu, Linux Mint, Pop!_OS |
| Arch | `pacman` | Arch Linux, Manjaro, EndeavourOS |
| Red Hat | `dnf` | Fedora, RHEL, Rocky Linux, AlmaLinux |

इस गाइड में आप जो कुछ सीखेंगे, उसमें से ज़्यादातर हर जगह एक जैसा काम करता है।
जो चीज़ें अलग हैं – मुख्य रूप से package management – उनके लिए अलग chapters हैं।
आप ऊपर दिए menu से कभी भी distribution बदल सकते हैं।

## Shell क्या है?

**Shell** वह program है जो आपके टाइप किए गए commands पढ़ता है और उन्हें चलाता
है। सबसे आम shell **bash** है, जो लगभग हर distribution पर default है। दूसरे
लोकप्रिय shells हैं **zsh** (macOS पर default) और **fish**। बुनियादी बातें
सभी में एक जैसी हैं।

*Terminal* और *shell* का फ़र्क़ ध्यान में रखिए: terminal वह window है जो text
दिखाती है, और shell वह program है जो उसके अंदर चलता है।

## Prompt

जब shell किसी command का इंतज़ार कर रहा होता है, तो वह एक **prompt** दिखाता है।
{{distro}} पर यह कुछ ऐसा दिखता है:

:::debian
```text
elev@{{hostname}}:~$
```
:::

:::arch
```text
[elev@{{hostname}} ~]$
```
:::

:::redhat
```text
[elev@{{hostname}} ~]$
```
:::

यह बताता है कि आप कौन हैं (`elev`), किस computer पर हैं (`{{hostname}}`) और
file system में कहाँ हैं (`~` का मतलब है आपकी home directory)। `$` का निशान
बताता है कि आप एक सामान्य user हैं। अगर आप administrator (*root*) हैं, तो
इसकी जगह `#` दिखेगा।

## आपका पहला command

Terminal में click कीजिए, नीचे दिया command टाइप कीजिए और **Enter** दबाइए:

```sh
echo Hej världen
```

`echo` बस वही print कर देता है जो आप उसे देते हैं – यहाँ *Hej världen*, जो
Swedish में "Hello world" है। ज़्यादातर commands इसी pattern पर चलते हैं:

```text
command  -options  arguments
ls       -l        /etc
```

*Command* वह program है जिसे चलाना है, *options* (या *flags*) उसके बर्ताव को
बदलते हैं, और *arguments* वह चीज़ें हैं जिन पर command को काम करना है।

## Simulator कैसे काम करता है

यहाँ का terminal एक **simulator** है जो पूरी तरह आपके browser में चलता है। यह
एक असली Linux computer की तरह बर्ताव करता है, लेकिन आप जो भी करें उससे आपकी
अपनी machine को कोई नुक़सान नहीं हो सकता – और अगर कुछ गड़बड़ हो जाए, तो आप
*Reset* button से हमेशा फिर से शुरू कर सकते हैं।

- **किसी code example पर click कीजिए** ताकि command terminal में आ जाए।
- **Tab** commands और file names को पूरा कर देता है।
- **ऊपर/नीचे arrow keys** से पिछले commands पर जा सकते हैं।
- **Ctrl+L** screen साफ़ करता है और **Ctrl+C** टाइप की जा रही line रद्द कर देता है।
- `help` सारे commands की list दिखाता है, और `man command` एक manual page दिखाता है।

### कुछ Swedish शब्द

यह गाइड मूल रूप से Swedish में लिखी गई थी, इसलिए simulator में user और practice
files के नाम Swedish में हैं। आपको Swedish आने की ज़रूरत नहीं – commands बिल्कुल
वही हैं – लेकिन यह छोटी-सी शब्दावली आपकी मदद कर सकती है:

| नाम | मतलब |
|---|---|
| `elev` | छात्र (आपका user name) |
| `dokument` | documents |
| `anteckningar.txt` | notes |
| `frukter.txt` | फल |
| `betyg.csv` | ग्रेड / अंक |
| `bilder` | तस्वीरें |
| `gammalt` | पुराना सामान |
