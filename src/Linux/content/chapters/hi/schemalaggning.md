# cron से scheduled jobs

हर रात एक backup, हर हफ़्ते पुराने logs की सफ़ाई, हर पाँच minute में data लाना –
computer तय समय पर ख़ुद commands चला सकता है। इसके लिए classic tool **cron** है,
और systemd के अपने **timers** हैं।

## cron और crontab

cron service हर minute जागती है और उन jobs को चलाती है जिनका समय आ गया है। हर user
की jobs की अपनी list होती है, एक **crontab**:

```sh
crontab -l
```

*no crontab for {{user}}* का मतलब है कि आपकी अभी कोई jobs नहीं हैं।

## पाँच time fields

Crontab की हर line में पाँच time fields होते हैं और फिर command:

```text
┌───────────── मिनट (0–59)
│ ┌─────────── घंटा (0–23)
│ │ ┌───────── महीने का दिन (1–31)
│ │ │ ┌─────── महीना (1–12)
│ │ │ │ ┌───── हफ़्ते का दिन (0–7, रविवार 0 या 7 है)
│ │ │ │ │
* * * * *  command
```

| आप लिखते हैं | मतलब |
|---|---|
| `*` | हर |
| `5` | ठीक 5 |
| `1-5` | 1 से 5 तक |
| `1,15` | 1 और 15 |
| `*/10` | हर दसवाँ: 0, 10, 20 … |

| Line | कब चलती है |
|---|---|
| `* * * * * command` | हर minute |
| `*/5 * * * * command` | हर पाँच minute में |
| `30 2 * * * command` | हर रात 02:30 पर |
| `0 7 * * 1-5 command` | सोमवार से शुक्रवार 07:00 पर |
| `0 0 1 * * command` | हर महीने की पहली तारीख़ को आधी रात में |
| `@reboot command` | एक बार, जब computer start होता है |

`@hourly`, `@daily`, `@weekly` और `@monthly` भी shortcuts हैं।

```quiz
Job `15 8 * * 6 ~/backup.sh` कब चलती है?
- [ ] हर दिन 15:08 पर
- [x] हर शनिवार 08:15 पर
- [ ] हर महीने की 15 तारीख़ को 08:00 पर
---
क्रम है मिनट, घंटा, महीने का दिन, महीना और हफ़्ते का दिन: मिनट 15, घंटा 8, कोई भी
तारीख़, कोई भी महीना, दिन 6 – शनिवार।
```

```quiz
`0 */2 * * * command` कितनी बार चलता है?
- [ ] हर दो मिनट में
- [x] हर दूसरे घंटे, घंटे की शुरुआत में
- [ ] दिन में दो बार
---
मिनट 0 और हर दूसरा घंटा: 00:00, 02:00, 04:00 …
```

## Jobs install करना

`crontab -e` आपका crontab एक text editor में खोलता है और save करने पर उसे install
कर देता है। Simulator में अभी कोई editor नहीं है, इसलिए यहाँ आप `crontab` को jobs
उसके input पर देते हैं – `-` का मतलब है "input से पढ़ो":

```sh
echo '* * * * * date >> ~/cron.log' | crontab -
crontab -l
```

सावधान: `crontab -` और `crontab FILE` पूरे crontab को **बदल देते** हैं। Job जोड़ने
के लिए पुरानी jobs को नई job के साथ मिलाइए:

```sh
(crontab -l; echo '30 2 * * * ~/backup.sh') | crontab -
```

एक line हटाने के लिए उसे `grep -v` से छाँटकर बाक़ी को install कीजिए – या
`crontab -r` से सब कुछ हटा दीजिए:

```sh
crontab -l | grep -v backup.sh | crontab -
```

`crontab` कुछ भी install करने से पहले lines को जाँचता है:

```predict
$ echo '0 25 * * * date' | crontab -
"-":1: bad hour
errors in crontab file, can't install.
---
घंटा 25 होता ही नहीं – घंटे 0 से 23 तक होते हैं। कुछ भी install नहीं हुआ।
```

## उसे चलते हुए देखना

हर minute चलने वाली job install करने के बाद एक minute रुकिए और देखिए:

```sh
cat ~/cron.log
journalctl -u cron
```

हर run journal में लिखा जाता है, जैसे
`CRON[4211]: ({{user}}) CMD (date >> ~/cron.log)`। Simulator में cron सिर्फ़ तब
चलता है जब app खुली हो – बिल्कुल असली computer की तरह, बंद रहने के दौरान छूटी
jobs की भरपाई वह बाद में नहीं करता।

## cron का जाल: दूसरा environment

Jobs आपके terminal में नहीं चलतीं, और इससे लगभग हर कोई हैरान होता है:

- वे `/bin/sh` से चलती हैं, आपके aliases और आपकी `~/.bashrc` के बिना।
- `PATH` छोटा होता है (`/usr/bin:/bin`), इसलिए दूसरी जगहों के programs को उनका पूरा
  path चाहिए।
- वे आपकी home directory में start होती हैं।
- जो output किसी file में नहीं भेजा जाता, वह खो जाता है। Line के आख़िर में हमेशा
  कुछ ऐसा लगाइए, जैसे `>> ~/job.log 2>&1`।

पहले command को हाथ से चलाइए। जब वह वहाँ काम करे, तब उसे crontab में डालिए।

```quiz
Job `* * * * * echo hi` हर मिनट चलती है, लेकिन आपको `hi` कहीं भी नहीं दिखता।
क्यों?
- [ ] cron `echo` की इजाज़त नहीं देता
- [x] आउटपुट के जाने की कोई जगह नहीं है – उसे `>>` से किसी फ़ाइल में भेजिए
- [ ] Jobs सिर्फ़ root के रूप में चलती हैं
---
cron jobs का आउटपुट किसी टर्मिनल में नहीं दिखता। असली cron उसे ईमेल करने की
कोशिश करता है, और ज़्यादातर कंप्यूटरों पर मेल नहीं होता – इसलिए वह खो जाता है।
```

## System की अपनी jobs

Users के crontabs के अलावा `/etc/crontab` है, और `/etc/cron.daily` और
`/etc/cron.weekly` जैसी directories भी। उनमें रखी scripts दिन में एक बार या हफ़्ते
में एक बार चलाई जाती हैं:

```sh
cat /etc/crontab
ls /etc/cron.daily
```

`/etc/crontab` की lines में command से पहले एक field और होता है: वह user जिसके रूप
में job चलती है।

## systemd timers

नई distributions पर इसमें से बहुत-सा काम systemd के **timers** करते हैं: एक
`.timer` unit जो तय समय पर एक `.service` unit start करती है। वे journal में log
करते हैं और छूटे हुए runs की भरपाई कर सकते हैं, लेकिन हर job के लिए दो unit files
चाहिए। आपकी अपनी छोटी jobs के लिए cron सबसे तेज़ तरीक़ा है। Computer के timers की
list देखिए, अगले और पिछले run के साथ:

```try
systemctl list-timers
```

## दूसरी distributions पर

| | Ubuntu और Debian | Fedora | Arch |
|---|---|---|---|
| Package | `cron` | `cronie` | `cronie` |
| Service | `cron` | `crond` | `cronie` |
| शुरू से installed | हाँ | हाँ | नहीं |

Arch पर आप `sudo pacman -S cronie` और `sudo systemctl enable --now cronie` से
शुरुआत करते हैं।
