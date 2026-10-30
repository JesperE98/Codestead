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

:::debian
पुराने Debian और Ubuntu versions में अक्सर इसकी जगह `/lib/systemd/system` लिखा
होता है। यह वही directory है – `/lib` बस `/usr/lib` का link है।
:::

Service का नाम file का नाम होता है, जैसे `minserver.service`। Commands लिखते समय
आप `.service` छोड़ सकते हैं: `systemctl status minserver` भी उतना ही अच्छा काम
करता है।

## Service का हाल कैसा है? – `systemctl status`

जो command आप सबसे ज़्यादा इस्तेमाल करेंगे, वह है `systemctl status`:

:::debian
```sh
systemctl status ssh
```
:::

:::arch
```sh
systemctl status sshd
```
:::

:::redhat
```sh
systemctl status sshd
```
:::

Output कुछ ऐसा दिखता है:

```text
● sshd.service - OpenSSH server daemon
     Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled; preset: disabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 CET; 2h 13min ago
       Docs: man:sshd(8)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/sshd.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 fedora systemd[1]: Starting sshd.service - OpenSSH server daemon...
Oct 30 07:54:07 fedora sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 fedora systemd[1]: Started sshd.service - OpenSSH server daemon.
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

आम तौर पर सब कुछ देखने के लिए आपका root होना, या किसी ऐसे group का member होना
ज़रूरी है जिसे journal पढ़ने की अनुमति हो (Debian और Ubuntu में `adm` या
`systemd-journal`, Arch और Fedora में `wheel`)। Simulator में आपका user पूरा
journal पढ़ सकता है।

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

## अलग-अलग families में अलग-अलग नाम

systemd हर जगह एक जैसा काम करता है, लेकिन **services के नाम हमेशा एक जैसे नहीं
होते**। यह इस पर निर्भर करता है कि packages के नाम क्या हैं और distribution ने
कौन-से programs चुने हैं:

| Service | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| SSH server | `ssh` (alias `sshd`) | `sshd` | `sshd` |
| Scheduled jobs (cron) | `cron` | `cronie` (default रूप से installed नहीं) | `crond` |
| Network | `NetworkManager` (Ubuntu), `networking` (Debian) | `systemd-networkd` | `NetworkManager` |
| Firewall | `ufw` (अगर installed हो) | – | `firewalld` |
| घड़ी | `systemd-timesyncd` | `systemd-timesyncd` | `chronyd` |

:::debian
{{distro}} में SSH service का नाम `ssh.service` है। इसका alias `sshd.service` है,
इसलिए `systemctl status sshd` भी काम करता है – लेकिन output में असली नाम दिखता है।
:::

:::arch
Arch default रूप से लगभग कोई service install नहीं करता – आप ख़ुद चुनते हैं। उदाहरण
के लिए, कोई cron service नहीं चल रही; Arch इसकी जगह systemd **timers** इस्तेमाल
करता है। अगर आपको cron चाहिए, तो package `cronie` install कीजिए और `sudo systemctl
enable --now cronie` चलाइए। यह भी ध्यान रखिए कि Arch में `preset: disabled` है:
नई services install करने पर कभी अपने-आप enable नहीं होतीं।
:::

:::redhat
Fedora में शुरू से `firewalld` चल रहा होता है, और time sync `chronyd` संभालता है।
Fedora ज़्यादातर services के लिए `preset: disabled` भी इस्तेमाल करता है: जब आप कोई
नई service (जैसे web server) install करते हैं, तो आपको ख़ुद `sudo
systemctl enable --now …` चलाना पड़ता है।
:::

पक्का नहीं पता कि किसी चीज़ का नाम क्या है? List में search कीजिए:

```sh
systemctl list-unit-files | grep ssh
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
