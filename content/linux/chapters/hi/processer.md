# Processes और jobs

हर चलने वाला program एक **process** होता है। इस समय simulated computer पर लगभग
दर्जन भर processes चल रहे हैं: system की services, आपका shell – और कुछ और भी,
जिसकी झलक आपको जल्द मिलेगी। इस chapter में आप सीखेंगे कि क्या चल रहा है यह कैसे
देखें, गड़बड़ करने वाले programs को कैसे रोकें और चीज़ों को background में कैसे
चलाएँ।

## Process क्या है?

Process एक चलता हुआ program है, उन सब चीज़ों के साथ जिनकी उसे ज़रूरत है: memory,
खुली files और वह user जिसके रूप में वह चलता है। हर process का एक **PID**
(*process ID*) होता है – एक number जो उसे पहचानता है – और एक parent, यानी
**PPID**, जिसने उसे शुरू किया। सब कुछ process number 1, `init` से शुरू होता है
(लगभग हर distribution पर यह `systemd` है), जो बाक़ी सबको start करता है।

```quiz
किसी प्रोसेस का PPID क्या है?
- [ ] उस प्रोसेसर का नंबर जिस पर वह चलता है
- [x] उस प्रोसेस का PID जिसने उसे शुरू किया – उसका पैरेंट
- [ ] उसकी प्राथमिकता
---
हर प्रोसेस का एक पैरेंट होता है। पैरेंट्स के पीछे काफ़ी दूर तक चलते जाइए, तो आप
प्रोसेस नंबर 1 पर पहुँचते हैं।
```

## मेरे processes – `ps`

बिना options के `ps` (*process status*) आपके अपने terminal के processes दिखाता है:

```sh
ps
```

आपको अपना shell, `bash`, और ख़ुद `ps` दिखेगा – जो सिर्फ़ तब तक ज़िंदा रहता है जब
तक वह चल रहा है।

## सारे processes – `ps aux`

Computer पर चल रही हर चीज़ देखने के लिए आम तौर पर `ps aux` इस्तेमाल होता है:

```sh
ps aux
```

| Column | मतलब |
|---|---|
| `USER` | वह user जिसके रूप में process चलता है |
| `PID` | Process का ID number |
| `%CPU` / `%MEM` | यह कितना processor और memory इस्तेमाल करता है |
| `STAT` | State: `R` running, `S` sleeping, `s` session leader |
| `COMMAND` | वह command जिसने process शुरू किया |

List लंबी हो जाती है, इसलिए इसे अक्सर `grep` या `sort` के साथ जोड़ा जाता है:

```sh
ps aux | grep sshd
ps aux --sort=-%cpu | head -5
```

`ps -ef` वाला रूप वही processes दिखाता है, लेकिन parent के PID के लिए एक अलग
column के साथ। अगर आपको सिर्फ़ किसी ऐसे process का PID चाहिए जिसका नाम आप जानते
हैं, तो `pgrep` है:

```sh
pgrep -l sshd
```

```try
pgrep -l sshd
---
`-l` PID के बगल में नाम भी दिखाता है।
```

## Live view – `top` और `htop`

`top` processes को इस हिसाब से sort करके दिखाता है कि वे कितना processor time
लेते हैं, और हर second refresh होता है – computer को धीमा करने वाली चीज़ ढूँढने के
लिए बिल्कुल सही। सबसे ऊपर आपको load (*load average*), processes की संख्या और
memory दिखती है।

```sh
top
```

असली terminal में `top` से `q` दबाकर बाहर निकलते हैं। बहुत से लोग `htop` पसंद
करते हैं, जिसमें colors होते हैं और जिसे mouse से चलाया जा सकता है, लेकिन उसे
आम तौर पर पहले install करना पड़ता है।

## Processes रोकना – `kill`

नाम नाटकीय है, लेकिन `kill` असल में process को एक **signal** भेजता है। Default
signal, `SIGTERM` (15), process से आराम से ख़ुद को बंद करने को कहता है। अगर वह न
सुने, तो आप `SIGKILL` (9) भेज सकते हैं, जो उसे तुरंत रुकने पर मजबूर कर देता है –
लेकिन तब उसे कुछ save करने या साफ़-सफ़ाई करने का मौक़ा नहीं मिलता।

```text
kill 1234        # process 1234 से बंद होने को कहो (SIGTERM)
kill -9 1234     # ज़बरदस्ती बंद करो (SIGKILL) – आख़िरी उपाय
```

अगर आपको नाम पता है लेकिन PID नहीं, तो आप `pkill` (pattern से match करता है) या
`killall` (सटीक नाम) इस्तेमाल कर सकते हैं:

```text
pkill firefox
killall firefox
```

आप सिर्फ़ अपने **ख़ुद के** processes को signals भेज सकते हैं। Root या दूसरे users
के processes के लिए आपको `sudo` चाहिए।

```quiz
एक प्रोग्राम ने जवाब देना बंद कर दिया है। आपको **सबसे पहले** कौन-सा कमांड आज़माना चाहिए?
- [x] `kill 1234` – यह `SIGTERM` भेजता है और प्रोग्राम को आराम से बंद होने देता है
- [ ] `kill -9 1234` – यह हमेशा सबसे अच्छा काम करता है
- [ ] `sudo kill -9 1`
---
डिफ़ॉल्ट सिग्नल, `SIGTERM`, से शुरू कीजिए। `SIGKILL` (`-9`) आख़िरी उपाय है,
क्योंकि प्रोग्राम को कुछ सेव करने या साफ़-सफ़ाई करने का मौक़ा नहीं मिलता।
```

> **ढूँढिए और रोकिए!** इस computer पर कोई process लगभग 100 % processor इस्तेमाल
> कर रहा है। `top` या `ps aux --sort=-%cpu` से पता कीजिए कि उसका नाम क्या है और
> उसका PID क्या है – और फिर उसे रोक दीजिए।

## Foreground और background

जब आप कोई command चलाते हैं, तो shell उसके ख़त्म होने तक इंतज़ार करता है; वह
**foreground** में चलता है। अगर आप आख़िर में `&` लगा दें, तो वह **background**
में चलता है, और आपको prompt तुरंत वापस मिल जाता है:

```sh
sleep 300 &
```

Shell square brackets में job number और process का PID बताता है, जैसे
`[1] 4200`। Terminal से शुरू किए गए programs को **jobs** कहते हैं:

```sh
jobs
```

| Command | क्या करता है |
|---|---|
| `jobs` | इस terminal के jobs की list दिखाता है |
| `fg %1` | Job 1 को foreground में लाता है |
| `bg %1` | रुके हुए job को background में चलने देता है |
| `kill %1` | Job 1 को ख़त्म करता है |
| `Ctrl+C` | Foreground वाले program को बीच में रोकता है |
| `Ctrl+Z` | Foreground वाले program को pause करता है (`fg` या `bg` से फिर चलाइए) |

Variable `$!` में सबसे हाल के background job का PID होता है। जब कोई job ख़त्म होता
है, तो shell `[1]+  Done   sleep 300` जैसी एक line से आपको बताता है।

```quiz
आपने foreground में चल रहे एक प्रोग्राम पर `Ctrl+Z` दबाया है। आप उसे चलते रहने
कैसे देंगे, जबकि आपका प्रॉम्प्ट आपके पास बना रहे?
- [ ] `fg %1`
- [x] `bg %1`
- [ ] `Ctrl+C`
---
`Ctrl+Z` प्रोग्राम को रोक (pause कर) देता है। `bg` रुके हुए job को background में
आगे चलने देता है, जबकि `fg` उसे वापस foreground में ले आता।
```

## Computer का हाल कैसा है?

दो छोटे commands आपको जल्दी से एक overview देते हैं:

```sh
uptime
free -h
```

`uptime` दिखाता है कि computer कितनी देर से चल रहा है और पिछले 1, 5 और 15 minutes
का load कितना रहा। `free -h` दिखाता है कि कितनी memory इस्तेमाल में है।
*available* column पर ध्यान दीजिए: Linux ख़ाली memory को files के cache के रूप में
इस्तेमाल करता है, इसलिए *free* अक्सर कम दिखता है, भले ही memory भरपूर हो।

```quiz
`free -h` में *free* मेमोरी कम दिखती है लेकिन *available* मेमोरी बहुत है। इसका
क्या मतलब है?
- [ ] कंप्यूटर की मेमोरी ख़त्म होने वाली है
- [x] Linux ख़ाली मेमोरी को फ़ाइलों के कैश की तरह इस्तेमाल करता है – *available* देखिए
- [ ] कुछ मेमोरी ख़राब है
```

## हर जगह एक जैसा

प्रोसेस हर डिस्ट्रीब्यूशन पर एक जैसे काम करते हैं। Ubuntu पर टूल **procps** पैकेज
से आते हैं, और `killall` **psmisc** से। कुछ डिस्ट्रीब्यूशन इन पैकेजों को थोड़े
अलग नाम देते हैं, और शुरू से कौन-सी सर्विसें चल रही हैं, यह भी अलग होता है –
डिस्ट्रीब्यूशन वाले भाग में आपको डिस्ट्रीब्यूशनों की तुलना करने का मौक़ा मिलेगा।
