# systemd के साथ services और logs

Linux computer लगातार ऐसे काम करता रहता है जिन्हें कोई हाथ से start नहीं करता: वह
SSH connections स्वीकार करता है, घड़ी को sync रखता है, scheduled jobs चलाता है और
logs लिखता है। ये काम करने वाले programs **services** कहलाते हैं, और लगभग हर
modern distribution में **systemd** इन्हें व्यवस्थित रखता है। इस chapter में आप
सीखेंगे कि services को कैसे start और stop करें, उन्हें boot पर कैसे start कराएँ
और – सबसे ज़रूरी – जब कुछ गड़बड़ हो तो logs कैसे पढ़ें।

## init और systemd

Linux kernel start होने के बाद एक ही program चलाता है: **init**, process number
1। फिर init बाक़ी सब कुछ start करता है। आजकल init लगभग हमेशा **systemd** होता है –
Debian, Ubuntu, Arch और Fedora, सब में। देखिए:

```sh
ps -p 1
```

Process का नाम `/sbin/init` है, लेकिन यह बस `systemd` program का एक link है।

systemd सिर्फ़ services start करने से ज़्यादा करता है। यह नज़र रखता है कि वे ज़िंदा
हैं या नहीं, crash होने पर उन्हें फिर से start करता है (अगर आप चाहें), वे जो कुछ
भी print करती हैं उसे एक साझा log – **journal** – में इकट्ठा करता है, और system
के ज़्यादातर हिस्सों के लिए इसके पास tools हैं:

| Tool | क्या करता है |
|---|---|
| `systemctl` | Services को control करता है: status, start, stop, boot |
| `journalctl` | Journal (log) पढ़ता है |
| `hostnamectl` | Computer का नाम दिखाता है और बदलता है |
| `systemd-analyze` | दिखाता है कि boot में कितना समय लगा |

## Units और services

systemd जिस भी चीज़ पर नज़र रखता है, उसे **unit** कहते हैं। Units कई तरह की होती
हैं, और तरह suffix से पता चलती है: `.service` (एक service), `.timer` (एक scheduled
job), `.socket`, `.mount`, `.target` (units का एक group, कुछ-कुछ boot के एक
"level" जैसा) और भी। यह chapter services के बारे में है।

हर unit का वर्णन एक **unit file** करती है, जो एक छोटी text file है। ये दो जगह
रहती हैं:

| Directory | क्या है |
|---|---|
| `/usr/lib/systemd/system/` | Packages के साथ आने वाली unit files। यहाँ edit मत कीजिए! |
| `/etc/systemd/system/` | Administrator की अपनी unit files। इन्हें प्राथमिकता मिलती है। |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

पुराने Debian और Ubuntu versions में अक्सर इसकी जगह `/lib/systemd/system` लिखा
होता है। यह वही directory है – `/lib` बस `/usr/lib` का link है।

Service का नाम file का नाम होता है, जैसे `minserver.service`। Commands लिखते समय
आप `.service` छोड़ सकते हैं: `systemctl status minserver` भी उतना ही अच्छा काम
करता है।

## Service का हाल कैसा है? – `systemctl status`

जो command आप सबसे ज़्यादा इस्तेमाल करेंगे, वह है `systemctl status`:

```sh
systemctl status ssh
```

Ubuntu पर SSH सर्वर का नाम `ssh` है। आउटपुट कुछ ऐसा दिखता है:

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

Line दर line:

| Line | मतलब |
|---|---|
| `●` | हरा बिंदु = चल रही है। लाल `×` = fail हो गई है। सफ़ेद `○` = रुकी हुई है। |
| `Loaded` | Unit file कहाँ है, service boot पर start होती है या नहीं (`enabled`/`disabled`/`static`) और distribution का default (`preset`) |
| `Active` | सबसे ज़रूरी line: `active (running)`, `inactive (dead)` या `failed` – और कब से |
| `Docs` | और कहाँ पढ़ें (`man sshd`) |
| `Main PID` | Service का main process – वही PID जो `ps aux` में है |
| `Memory`, `CGroup` | यह कितनी memory इस्तेमाल करती है और कौन-से processes इसके हैं |
| आख़िरी lines | Journal में service के log की सबसे नई lines |

`static` का मतलब है कि service को अपने-आप में enable नहीं किया जा सकता – यह तब
start होती है जब किसी दूसरी unit को इसकी ज़रूरत होती है।

> **Tip:** असली terminal में लंबा output एक pager (`less`) में दिखाया जाता है।
> वापस आने के लिए `q` दबाइए। अगर आप इसे छोड़ना चाहें तो `--no-pager` जोड़िए।

## Start, stop और restart

```text
sudo systemctl start minserver      # अभी start करो
sudo systemctl stop minserver       # अभी रोको
sudo systemctl restart minserver    # रोककर फिर से start करो
sudo systemctl reload minserver     # इससे configuration दोबारा पढ़ने को कहो
```

जो कुछ भी कुछ **बदलता** है, उसके लिए root चाहिए, इसलिए `sudo` मत भूलिए। इसके बिना
systemctl जवाब देता है:

```text
Failed to start minserver.service: Interactive authentication required.
```

`reload` सिर्फ़ उन services के साथ काम करता है जो इसे support करती हैं। फ़ायदा यह
है कि इस दौरान service चलती रहती है – कोई connection नहीं टूटता। जब आपने किसी
service की configuration file बदली हो, तो `reload` या `restart` आख़िरी step है।

> **आज़माइए!** Processes वाले chapter में आपने practice server को `pkill` से रोका
> था। `systemctl status minserver` देखिए – systemd ने ध्यान दिया कि process ग़ायब
> हो गया। इसे `systemctl` से फिर से start कीजिए और PID की तुलना
> `pgrep -l minserver` से कीजिए।

## अभी या boot पर? `start` और `enable`

systemd के बारे में यह सबसे आम ग़लतफ़हमी है: **`start` और `enable` दो अलग चीज़ें
हैं।**

| Command | क्या करता है |
|---|---|
| `systemctl start X` | Service को **अभी** start करता है। Reboot के बाद यह फिर से बंद हो जाती है। |
| `systemctl enable X` | Service को **boot पर** अपने-आप start कराता है – लेकिन अभी नहीं। |
| `systemctl enable --now X` | दोनों एक साथ। |
| `systemctl disable X` | Boot पर start नहीं होगी (`--now` इसे रोक भी देता है)। |

`enable` एक directory में link बनाता है जिसका नाम unit file के `[Install]` section
वाले target पर होता है, आम तौर पर `multi-user.target.wants`:

```text
$ sudo systemctl enable --now minserver
Created symlink /etc/systemd/system/multi-user.target.wants/minserver.service → /etc/systemd/system/minserver.service.
```

जब computer boot होता है, तो systemd उस directory में से गुज़रता है और उसमें की
हर चीज़ start करता है। आप state के बारे में पूछ सकते हैं:

```sh
systemctl is-active minserver
systemctl is-enabled minserver
```

`is-active` और `is-enabled` scripts में बहुत काम के हैं – ये एक शब्द print करते हैं
और जवाब "हाँ" होने पर status 0 के साथ exit करते हैं। `-q` के साथ ये पूरी तरह चुप
रहते हैं:

```text
if systemctl is-active -q minserver; then echo "the server is running"; fi
```

सिम्युलेटर में अभी-अभी चालू हुए कंप्यूटर पर `minserver` चल रहा है, लेकिन किसी ने
उसे enable नहीं किया है। ये दो कमांड क्या छापते हैं?

```predict
$ systemctl is-active minserver
$ systemctl is-enabled minserver
active
disabled
---
minserver **अभी** चल रहा है, लेकिन किसी ने `enable` नहीं चलाया – रीबूट के बाद वह
शुरू नहीं होगा। `start` और `enable` सच में दो अलग चीज़ें हैं।
```

## Services की list बनाना

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` वे services दिखाता है जो चल रही हैं (या fail हो गई हैं)। `--all`
  के साथ रुकी हुई services भी शामिल होती हैं।
- `--failed` सिर्फ़ वे दिखाता है जो fail हो गई हैं। जब कुछ ठीक न लगे, तो यह एक
  अच्छा पहला command है!
- `list-unit-files` सारी installed unit files दिखाता है और बताता है कि वे
  `enabled`, `disabled` या `static` हैं।

## Journal – `journalctl`

Services, kernel और ख़ुद systemd जो कुछ भी print करते हैं, वह journal में पहुँचता
है। बिना options के आपको पूरा journal मिलता है, सबसे पुराना पहले:

```sh
journalctl
```

यह जल्दी ही बहुत ज़्यादा हो जाता है, इसलिए लगभग हमेशा filter किया जाता है:

| Command | क्या दिखाता है |
|---|---|
| `journalctl -u ssh` | सिर्फ़ एक service (`-u` यानी *unit*) |
| `journalctl -n 20` | सबसे नई 20 lines |
| `journalctl -f` | सबसे नई lines, फिर नई lines जैसे-जैसे आती हैं (Ctrl+C से बाहर) |
| `journalctl -b` | सिर्फ़ यह boot (`-b -1` = पिछला वाला) |
| `journalctl --since today` | आधी रात से। साथ ही `yesterday`, `"10:00"`, `"1 hour ago"` |
| `journalctl -p err` | सिर्फ़ errors और उनसे गंभीर |
| `journalctl -xe` | आख़िर पर jump करता है और explanations जोड़ता है |
| `journalctl -k` | सिर्फ़ kernel messages (`dmesg` की तरह) |

Options को जोड़ा जा सकता है। कुछ classic उदाहरण:

```sh
journalctl -u minserver -n 5
journalctl -p err -b
journalctl --since today -u minserver
```

### Priorities

Journal की हर line की एक **priority** होती है। `-p` वह priority दिखाता है जो आप
चुनते हैं *और उससे ज़्यादा गंभीर सब कुछ*:

| Number | नाम | मतलब |
|---|---|---|
| 0 | `emerg` | System इस्तेमाल के लायक नहीं है |
| 1 | `alert` | तुरंत ठीक करना ज़रूरी है |
| 2 | `crit` | Critical error |
| 3 | `err` | Error – लाल रंग में दिखता है |
| 4 | `warning` | Warning – पीले रंग में दिखती है |
| 5 | `notice` | सामान्य, लेकिन ध्यान देने लायक |
| 6 | `info` | जानकारी |
| 7 | `debug` | Debugging की जानकारी |

अगर `journalctl -p err` कुछ kernel errors दिखाए, जैसे `ACPI BIOS Error`, तो चिंता
मत कीजिए। ये लगभग हर computer पर होती हैं और आम तौर पर हानिरहित होती हैं – computer
के firmware के bugs, जिनसे kernel बचकर निकल जाता है।

आम तौर पर सब कुछ देखने के लिए आपका root होना, या किसी ऐसे समूह का सदस्य होना
ज़रूरी है जिसे journal पढ़ने की अनुमति हो (Ubuntu पर `adm` या `systemd-journal` –
दूसरे परिवार दूसरे समूह इस्तेमाल करते हैं)। सिम्युलेटर में आपका यूज़र पूरा journal
पढ़ सकता है।

```quiz
`journalctl -p warning` कौन-सी प्राथमिकताएँ (priorities) दिखाता है?
- [x] `err`
- [x] `warning`
- [x] `crit`
- [ ] `notice`
- [ ] `info`
---
`-p` आपकी चुनी हुई प्राथमिकता *और उससे ज़्यादा गंभीर सब कुछ* दिखाता है – यानी
उसी या उससे छोटी संख्या वाली हर चीज़ (`warning` 4 है)।
```

## Start न होने वाली service की troubleshooting

किसी ने इस computer पर service **rapportd** set up की है, लेकिन कुछ गड़बड़ है। इसे
सुलझाने का आम तरीक़ा यह है:

1. **क्या fail हुआ है?** Fail हुई services की list देखिए:

   ```sh
   systemctl --failed
   ```

2. **Status देखिए।** अक्सर आख़िरी lines ही काफ़ी होती हैं:

   ```sh
   systemctl status rapportd
   ```

3. Service का **पूरा log पढ़िए**। यह लगभग हमेशा बता देता है कि क्या ग़लत है – इसे
   ध्यान से, शब्द-दर-शब्द पढ़िए:

   ```sh
   journalctl -xeu rapportd
   ```

   Start fail होने पर `systemctl` ख़ुद ठीक यही command सुझाता है:
   `See "systemctl status rapportd.service" and "journalctl -xeu
   rapportd.service" for details.`

4. **Problem ठीक कीजिए**, जैसे कोई configuration file जो ग़ायब है या जिसमें typo
   है।

5. **Restart करके जाँचिए:**

   ```text
   sudo systemctl restart rapportd
   systemctl status rapportd
   ```

`Main process exited, code=exited, status=1/FAILURE` वाली line का मतलब है कि
program ख़ुद error के साथ बंद हो गया। अगर `status=203/EXEC` लिखा हो, तो systemd को
program मिला ही नहीं – `ExecStart=` में path जाँचिए।

```quiz
एक सर्विस शुरू नहीं हो रही, और journal में `status=203/EXEC` लिखा है। आप सबसे
पहले कहाँ देखेंगे?
- [ ] `/etc/fstab` में
- [x] यूनिट फ़ाइल में `ExecStart=` के पाथ पर
- [ ] `journalctl -p err` से प्राथमिकता पर
- [ ] कहीं नहीं – इसका मतलब है कि प्रोग्राम ख़ुद त्रुटि के साथ बंद हो गया
---
203/EXEC का मतलब है कि systemd को प्रोग्राम मिला ही नहीं। जो प्रोग्राम शुरू होकर
फिर त्रुटि के साथ बंद हो जाता है, वह इसके बजाय `status=1/FAILURE` देता है।
```

## Unit file – `systemctl cat`

Service ठीक-ठीक कैसे start होती है, यह देखने के लिए उसकी unit file पढ़िए:

```sh
systemctl cat minserver
```

```text
# /etc/systemd/system/minserver.service
[Unit]
Description=Minserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/minserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| Section | क्या है |
|---|---|
| `[Unit]` | Description और क्रम: `After=network.target` = network के बाद start करो |
| `[Service]` | Program कैसे चलता है: `ExecStart=` (command), `User=`, `Restart=on-failure` … |
| `[Install]` | `enable` को क्या करना चाहिए: `WantedBy=multi-user.target` |

अगर आप unit file बदलते हैं, तो बदलाव लागू होने से पहले systemd को उसे फिर से load
करना होता है – वरना `systemctl status` में आपको warning मिलती है:

```text
sudo systemctl daemon-reload
```

`/usr/lib/systemd/system` की files कभी edit मत कीजिए – अगली बार package update होने
पर वे overwrite हो जाती हैं। इसकी जगह अपना version `/etc/systemd/system` में रखिए।

```quiz
आप बदलना चाहते हैं कि किसी पैकेज के साथ आई सर्विस कैसे शुरू होती है। सही तरीक़ा
क्या है?
- [ ] `/usr/lib/systemd/system` में उसकी फ़ाइल edit कीजिए और सर्विस रीस्टार्ट कीजिए
- [x] अपना संस्करण `/etc/systemd/system` में रखिए, `sudo systemctl daemon-reload` चलाइए और सर्विस रीस्टार्ट कीजिए
- [ ] अपना संस्करण `/etc/systemd/system` में रखिए – systemd बदलाव को ख़ुद पहचान लेता है
- [ ] `/usr/lib/systemd/system` की फ़ाइल edit कीजिए और उस पर `sudo systemctl enable` चलाइए
---
`/etc/systemd/system` की फ़ाइलों को प्राथमिकता मिलती है, और पैकेज अपडेट होने पर
वे ओवरराइट नहीं होतीं। `daemon-reload` से systemd बदली हुई यूनिट फ़ाइल को फिर से
लोड करता है।
```

## सर्विसों के नाम क्या हैं?

systemd हर जगह एक जैसा काम करता है, लेकिन **सर्विसों के नाम हमेशा एक जैसे नहीं
होते** – यह इस पर निर्भर करता है कि पैकेजों के नाम क्या हैं और डिस्ट्रीब्यूशन ने
कौन-से प्रोग्राम चुने हैं। Ubuntu पर:

| सर्विस | Ubuntu पर नाम |
|---|---|
| SSH सर्वर | `ssh` (alias `sshd`) |
| तय समय पर चलने वाले काम (cron) | `cron` |
| नेटवर्क | `NetworkManager` |
| फ़ायरवॉल | `ufw` (अगर इंस्टॉल हो) |
| घड़ी | `systemd-timesyncd` |

SSH सर्विस का असली नाम `ssh.service` है। इसका alias `sshd.service` है, इसलिए
`systemctl status sshd` भी काम करता है – लेकिन आउटपुट में असली नाम दिखता है।
दूसरे परिवार उन्हीं सर्विसों को अलग नाम दे सकते हैं (Arch और Fedora पर SSH सर्विस
का नाम `sshd` है) – डिस्ट्रीब्यूशन और पैकेज वाला भाग ऐसे ही अंतरों के बारे में है।

पक्का नहीं पता कि किसी चीज़ का नाम क्या है? List में search कीजिए:

```sh
systemctl list-unit-files | grep ssh
```

```try
systemctl list-unit-files | grep ssh
---
`ssh.service` असली यूनिट फ़ाइल है, और `sshd.service` उसके `alias` के रूप में
दिखाई गई है।
```

## Computer को reboot करना

`enable` का असर तभी दिखता है जब computer reboot होता है। Simulator में आप इसे आज़मा
सकते हैं – वह पल भर में reboot हो जाता है:

```text
sudo systemctl reboot
```

Reboot के बाद सिर्फ़ enabled services चल रही होती हैं। `journalctl -b
-1` से आप पिछले boot का log देखते हैं (और यह भी कि सब कुछ कैसे बंद हुआ), और
`journalctl --list-boots` journal में सारे boots दिखाता है।

## systemd से और भी

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

`hostnamectl` computer का नाम, operating system और kernel दिखाता है (और
`sudo hostnamectl set-hostname NEWNAME` से नाम बदलता है)। `systemd-analyze` दिखाता
है कि boot में कितना समय लगा, और `blame` बताता है कि किन services ने सबसे ज़्यादा
समय लिया – जब computer धीरे boot हो, तब यह बिल्कुल सही है।
