# Networking

Linux computer जो कुछ भी करता है, उसमें लगभग हमेशा दूसरे computers से बात करना
शामिल होता है: updates लाना, web pages दिखाना, servers पर login करना। जब कुछ
गड़बड़ होती है, तो वजह पता करने के सबसे अच्छे tools terminal में ही हैं। इस
chapter में आप सीखेंगे कि अपना address कैसे पता करें, connections कैसे test करें,
names कैसे look up करें, कौन-सी services चल रही हैं यह कैसे देखें, web से चीज़ें
कैसे लाएँ और SSH से किसी दूसरे computer पर login कैसे करें।

Simulated computer एक छोटे-से home network में है:

| Computer | Address | क्या |
|---|---|---|
| आपका कंप्यूटर (`ubuntu`) | `192.168.1.42` | जहाँ आप अभी हैं |
| Router (gateway) | `192.168.1.1` | Internet तक बाहर जाने का रास्ता |
| Server | `192.168.1.10` | एक और Linux computer जिस पर आप login कर सकते हैं |

Router के पीछे एक "internet" है, जिसमें दूसरों के अलावा `example.com`,
`linux.org` और `archlinux.org` हैं।

## IP addresses

Network पर हर computer का एक **IP address** होता है। IPv4 address 0 से 255 के
बीच के चार numbers होता है, जैसे `192.168.1.42`। जो addresses `192.168.`, `10.`
या `172.16.`–`172.31.` से शुरू होते हैं, वे **private** होते हैं – वे सिर्फ़
local networks के अंदर इस्तेमाल होते हैं और internet पर कभी दिखाई नहीं देते।

Computer के addresses दिखाने का command `ip` है (*iproute2* package से)।
`ip addr` को छोटा करके `ip a` लिखा जा सकता है:

```sh
ip a
```

आपको दो **interfaces** (network cards) दिखेंगे:

- `lo` – *loopback*, एक नकली card जिससे computer ख़ुद से बात करता है।
- `enp0s3` – असली network card। पहले cards के नाम `eth0` होते थे, और wireless
  cards के नाम अक्सर `wlan0` या `wlp2s0` जैसे होते हैं।

`inet 192.168.1.42/24` वाली line आपका IPv4 address है। `link/ether` card का
**MAC address** है, जो hardware में ही बना होता है, और `state UP` का मतलब है कि
card चल रहा है। छोटे overview के लिए `-br` (*brief*) है, और `hostname -I` सिर्फ़
addresses दिखाता है:

```sh
ip -br a
hostname -I
```

```try
ip -br a
---
हर इंटरफ़ेस के लिए एक पंक्ति: नाम, स्थिति (`UP`) और पते।
```

बहुत-सी guides में आपको अब भी पुराना command `ifconfig` (*net-tools* package से)
दिखेगा, लेकिन modern distributions में यह default रूप से installed नहीं होता।
`ip` वह सब करता है जो `ifconfig` करता था, और उससे ज़्यादा भी।

## localhost – ख़ुद computer

Address `127.0.0.1` का नाम **localhost** है और इसका मतलब हमेशा "यही computer"
होता है। एक ही computer पर चलने वाले programs अक्सर localhost के ज़रिए आपस में बात
करते हैं – जैसे कोई web server जिसे आप develop कर रहे हैं और वह browser जिससे आप
उसे test करते हैं। localhost पर जाने वाला traffic कभी computer से बाहर नहीं जाता।

## Netmask और gateway

Address के बाद वाला `/24` **netmask** है। यह बताता है कि पहले 24 bits (पहले तीन
numbers, `192.168.1`) network का address हैं। जिन computers का address
`192.168.1.` से शुरू होता है, वे सब एक ही local network पर हैं और उन तक सीधे
पहुँचा जा सकता है। बाक़ी सब कुछ **gateway** – यानी router – को भेजा जाता है, जो
उसे आगे internet तक पहुँचाता है। यह आप routing table में देख सकते हैं:

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

पहली line, **default**, default route है: "जो कुछ कहीं और list नहीं है, वह
192.168.1.1 को जाता है"। दूसरी line कहती है कि पूरे `192.168.1.0/24` network तक
सीधे `enp0s3` से पहुँचा जाता है। `proto dhcp` का मतलब है कि computer को उसकी
settings router से **DHCP** के ज़रिए अपने-आप मिली हैं।

```quiz
आपके कंप्यूटर का पता `192.168.1.42/24` है। वह किन पतों तक गेटवे से होकर जाए
बिना सीधे पहुँच सकता है?
- [x] `192.168.1.10`
- [x] `192.168.1.1`
- [ ] `192.168.2.10`
- [ ] `1.1.1.1`
---
`/24` के साथ पहली तीन संख्याएँ नेटवर्क का पता हैं। `192.168.1.` से शुरू होने वाली
हर चीज़ उसी लोकल नेटवर्क पर है – बाक़ी सब डिफ़ॉल्ट रूट से गेटवे को जाता है।
```

```predict
$ ip route | grep default | awk '{print $3}'
192.168.1.1
---
`default` वाली पंक्ति का तीसरा शब्द गेटवे का पता है।
```

## ping – क्या वहाँ तक पहुँचा जा सकता है?

`ping` छोटे test packets भेजता है और नापता है कि जवाब आने में कितना समय लगता है।
`-c` (*count*) से आप चुनते हैं कि कितने packets भेजने हैं – वरना ping तब तक चलता
रहता है जब तक आप **Ctrl+C** न दबाएँ:

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` जवाब का समय है। Home network के अंदर एक millisecond से कम, internet पर
  अक्सर 10–50 ms।
- `0% packet loss` – कोई packet ग़ायब नहीं हुआ। Packets खोने का मतलब आम तौर पर
  ख़राब network (या ख़राब wifi connection) होता है।
- `Destination Host Unreachable` का मतलब है कि local network पर उस address वाला
  कोई computer नहीं है।

ख़ुद computer को और internet पर किसी computer को भी ping करके देखिए:

```sh
ping -c 2 localhost
ping -c 3 example.com
```

ध्यान दें! बहुत-से servers और firewalls जान-बूझकर ping का जवाब नहीं देते। इसलिए
जवाब न आने का मतलब हमेशा यह नहीं होता कि computer बंद है।

## Names और DNS

इंसानों को names याद रहते हैं, computers addresses इस्तेमाल करते हैं। **DNS**
(*Domain Name System*) internet की phone book है जो `example.com` को IP address
में बदलती है। Computer किस DNS server से पूछता है, यह `/etc/resolv.conf` में लिखा
होता है:

```sh
cat /etc/resolv.conf
```

Ubuntu पर वहाँ `127.0.0.53` लिखा होता है – यह **systemd-resolved** है, आपके अपने
कंप्यूटर पर एक लोकल बिचौलिया जो आगे राउटर से पूछता है। कुछ दूसरे डिस्ट्रीब्यूशन
राउटर, `192.168.1.1`, को सीधे लिखते हैं।

ख़ुद DNS से पूछने के लिए `dig`, `host` या `nslookup` इस्तेमाल होते हैं। ये शुरू से
इंस्टॉल नहीं होते। Ubuntu पर ये पैकेज `dnsutils` में आते हैं (दूसरे परिवार इस
पैकेज को कुछ और नाम देते हैं):

```sh
sudo apt update
sudo apt install dnsutils
```

`dig` DNS server का पूरा जवाब दिखाता है। ज़रूरी हिस्सा `ANSWER SECTION` के नीचे
होता है। `+short` से आपको सिर्फ़ address मिलता है:

```sh
dig example.com
dig +short example.com
```

`host` और `nslookup` यही काम छोटे output के साथ करते हैं। `nslookup` Windows और
macOS पर भी मौजूद है। `host` **reverse lookup** भी कर सकता है – address से name:

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

`@` से आप किसी ख़ास DNS server से पूछ सकते हैं, जैसे Cloudflare का `1.1.1.1` या
Google का `8.8.8.8`:

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts – computer की अपनी names की list

DNS से पूछने से पहले computer file `/etc/hosts` में देखता है। दूसरी चीज़ों के
अलावा उसमें लिखा है कि `localhost` का मतलब `127.0.0.1` है:

```sh
cat /etc/hosts
```

Home network के server का address `192.168.1.10` है, लेकिन name `server.lan`
किसी DNS में नहीं है:

```sh
ping -c 1 server.lan
```

हल यह है कि `/etc/hosts` में एक line जोड़ दी जाए। File का owner root है, इसलिए
आपको `sudo` चाहिए। लेकिन सावधान – यह तरीक़ा काम **नहीं** करता:

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

`sudo` सिर्फ़ `echo` पर लागू होता है। `>>` के लिए file आपका अपना shell खोलता है
(जो आपके रूप में चलता है, root के रूप में नहीं)। तरकीब है `tee -a`, जो pipe से
मिली चीज़ को file के आख़िर में जोड़ देता है – और `tee` को sudo के साथ चलाया जा
सकता है:

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

अब यह name computer के हर program के लिए काम करता है। लेकिन `dig` सीधे DNS से
पूछता है और `/etc/hosts` को नज़रअंदाज़ करता है, इसलिए उसे अब भी कुछ नहीं मिलता।
*System* क्या resolve करता है, यह देखने के लिए `getent` इस्तेमाल कीजिए:

```sh
dig +short server.lan
getent hosts server.lan
```

क्रम (पहले file, फिर DNS) `/etc/nsswitch.conf` की `hosts:` line से तय होता है।

```quiz
`sudo echo '192.168.1.10 server.lan' >> /etc/hosts` से *Permission denied* क्यों
मिलता है?
- [ ] `echo` को sudo के साथ नहीं चलाया जा सकता
- [x] `>>` के लिए फ़ाइल root नहीं, आपका अपना शेल खोलता है – sudo सिर्फ़ `echo` पर लागू होता है
- [ ] `/etc/hosts` को बदला नहीं जा सकता, root भी नहीं बदल सकता
- [ ] `>>` सिर्फ़ आपकी होम डायरेक्टरी की फ़ाइलों पर काम करता है
---
इसीलिए आप `echo ... | sudo tee -a /etc/hosts` इस्तेमाल करते हैं: तब फ़ाइल
`tee` खोलता है, जो root के रूप में चलता है।
```

## Ports और services

IP address किसी computer की ओर इशारा करता है। **Port** (1 से 65535 के बीच का एक
number) उस computer पर किसी program की ओर इशारा करता है – जैसे गली का पता और
flat number। जो program connections का इंतज़ार कर रहा होता है, उसके बारे में कहा
जाता है कि वह port पर **listen** कर रहा है। कुछ जाने-माने ports:

| Port | Service |
|---|---|
| 22 | SSH – दूसरे computers पर login |
| 53 | DNS |
| 80 | HTTP – web |
| 443 | HTTPS – encrypted web |
| 8080 | Development के दौरान अक्सर web servers |

1024 से नीचे के ports सिर्फ़ root खोल सकता है। `ss` (*socket statistics*)
दिखाता है कि कौन-से ports listen कर रहे हैं:

```sh
ss -tulpn
```

Flags आम तौर पर एक मंत्र की तरह याद रखे जाते हैं: **t**cp, **u**dp,
**l**istening, **p**rocess, **n**umeric। `0.0.0.0:22` का मतलब है कि `sshd`
computer के सभी addresses पर port 22 पर listen कर रहा है, और `[::]:22` IPv6 के
लिए यही है। दूसरे users के processes के लिए *Process* column ख़ाली रहता है –
`sudo` के साथ आपको सब दिखते हैं:

```sh
sudo ss -tulpn
```

अगर processes वाले chapter का practice server `myserver` चल रहा है, तो वह आपको
यहाँ port 8080 पर दिखेगा। पुराना command `netstat -tulpn` (*net-tools* से) भी यही
काम करता है।

## Web से लाना: curl और wget

`curl` किसी address (एक **URL**) पर जो कुछ है उसे लाकर terminal में print करता
है। इसे अपने ही computer पर myserver के साथ आज़माइए:

Ubuntu पर `curl` पहले से इंस्टॉल नहीं होता (लेकिन `wget` होता है):

```sh
sudo apt install curl
```

```sh
curl http://localhost:8080
```

क्या आपको `Couldn't connect to server` मिला? तो उस port पर कुछ भी listen नहीं कर
रहा – शायद आपने processes वाले chapter में myserver रोक दिया था। उसे फिर से
start कीजिए:

```sh
myserver
```

`-I` के साथ curl सिर्फ़ response के **headers** दिखाता है, जिनकी पहली line एक
**status code** होती है:

```sh
curl -I https://example.com
```

| Code | मतलब |
|---|---|
| 200 | OK |
| 301, 302 | Page कहीं और चला गया है – `Location:` देखिए |
| 403 | मना है (Forbidden) |
| 404 | नहीं मिला (Not found) |
| 500 | Server error |

बहुत-सी websites `http://` से `https://` पर redirect करती हैं। तब आपको सिर्फ़ एक
छोटा-सा "301 Moved Permanently" मिलता है। `-L` के साथ curl उसके पीछे-पीछे जाता है:

```sh
curl -I http://linux.org
curl -L http://linux.org
```

क्योंकि curl terminal में लिखता है, यह pipe में बढ़िया काम करता है। `-s`
(*silent*) progress meter बंद कर देता है:

```sh
curl -s https://example.com | grep title
```

File में save करने के लिए `-o FILE` इस्तेमाल कीजिए (या `-O`, जो file का नाम
address से ले लेता है):

```sh
cd ~
curl -o {{exampleHtml}} https://example.com
```

`wget` files download करने के लिए बना है। यह हमेशा file में save करता है, progress
दिखाता है और redirects के पीछे अपने-आप जाता है:

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

File का नाम ख़ुद चुनने के लिए capital `-O` इस्तेमाल कीजिए: `wget -O file.html URL`।

## SSH – दूसरे computer पर login करना

**SSH** (*Secure Shell*) किसी Linux computer को दूर से control करने का आम तरीक़ा
है, और जो कुछ भी भेजा जाता है वह encrypted होता है। Server पर port 22 पर service
`sshd` चलती है, और आप client `ssh` से connect करते हैं:

```sh
ssh {{user}}@server.lan hostname
```

`{{user}}@server.lan` का मतलब है "computer server.lan पर user {{user}}"। Host के बाद वाला
command (`hostname`) server पर चलता है और उसका जवाब यहाँ दिखता है – उसमें
`server` लिखा आता है, `ubuntu` नहीं।

जब आप पहली बार किसी computer से connect करते हैं, तो ssh पूछता है कि क्या आप उस
पर भरोसा करते हैं:

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

`yes` टाइप कीजिए (पूरा शब्द)। तब server की **host key** `~/.ssh/known_hosts` में
save हो जाती है। अगर बाद में key बदल जाए, तो ssh ज़ोर से चेतावनी देता है – इसका
मतलब हो सकता है कि कोई server होने का दिखावा कर रहा है।

Command quotes के अंदर कई commands भी हो सकता है:

```sh
ssh {{user}}@server.lan 'whoami; uptime; ls'
ssh {{user}}@server.lan cat {{welcomeFile}}
```

बिना command के ssh login कर देता है और आपको दूसरे computer पर एक shell मिल जाता
है, जिससे आप `exit` से बाहर आते हैं। Simulator में यह supported नहीं है – वहाँ आप
हमेशा host के ठीक बाद command लिखते हैं।

### Passwords की जगह keys

Password की जगह आप एक **key pair** से login कर सकते हैं। Private key आपके पास
रहती है, और public key server पर रखी जाती है:

```sh
ssh-keygen
ssh-copy-id {{user}}@server.lan
```

`ssh-keygen` के सवालों पर Enter दबाइए, ताकि बिना passphrase के default file
`~/.ssh/id_ed25519` इस्तेमाल हो। `ssh-copy-id` public key (`id_ed25519.pub`) को
server पर `~/.ssh/authorized_keys` में जोड़ देता है। उसके बाद ssh password नहीं
माँगता। Private key कभी किसी को मत दिखाइए!

`scp` और `rsync` से आप SSH के ऊपर files copy कर सकते हैं, और file
`~/.ssh/config` में servers को छोटे नाम दे सकते हैं – लेकिन यह किसी अगले chapter
के लिए रहेगा।

## जब network काम न करे

"Internet नहीं चल रहा" की कई वजहें हो सकती हैं। Steps को क्रम से, अंदर से बाहर की
ओर देखिए – जो पहला step fail होता है, वही बताता है कि problem कहाँ है:

| Step | Command | अगर fail हो |
|---|---|---|
| 1. क्या मेरे पास address है? | `ip a` | Card बंद है (`state DOWN`) या उसे address नहीं मिला |
| 2. क्या बाहर जाने का रास्ता है? | `ip route` | `default` line नहीं है – कोई gateway नहीं |
| 3. क्या मैं router तक पहुँच सकता हूँ? | `ping -c 3 192.168.1.1` | Local network में problem (cable, wifi) |
| 4. क्या मैं internet तक पहुँच सकता हूँ? | `ping -c 3 1.1.1.1` | Router या provider में problem |
| 5. क्या DNS काम करता है? | `ping -c 3 example.com` | Name lookups fail होते हैं – `/etc/resolv.conf` जाँचिए |

Step 4 किसी name के बिना सीधे एक address को ping करता है। अगर step 4 काम करता है
लेकिन step 5 नहीं, तो लगभग हमेशा DNS ख़राब होता है – यह सबसे आम problems में से
एक है।

```quiz
`ping -c 3 1.1.1.1` काम करता है, लेकिन `ping -c 3 example.com` जवाब देता है
*Name or service not known*। समस्या सबसे ज़्यादा संभावना से कहाँ है?
- [ ] नेटवर्क कार्ड बंद है
- [ ] कोई डिफ़ॉल्ट रूट नहीं है
- [x] DNS – नाम खोजना (name lookup) काम नहीं कर रहा
- [ ] example.com ping का जवाब नहीं देता
---
अगर आप इंटरनेट पर किसी पते तक पहुँच सकते हैं, तो कार्ड, रूट और राउटर काम कर रहे
हैं। बचता है नाम का अनुवाद – `/etc/resolv.conf` जाँचिए।
```

ख़ुद आज़माइए! Network card बंद कीजिए, steps एक-एक करके देखिए और फिर उसे वापस चालू
कीजिए:

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## Packages

नेटवर्क टूल अलग-अलग पैकेजों में होते हैं। Ubuntu पर उनके नाम ये हैं:

| टूल | Ubuntu पर पैकेज |
|---|---|
| `ip`, `ss` | `iproute2` |
| `ping` | `iputils-ping` |
| `dig`, `host`, `nslookup` | `dnsutils` |
| `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` |

हमेशा की तरह, दूसरे परिवार कुछ पैकेजों को दूसरे नाम देते हैं – डिस्ट्रीब्यूशन और
पैकेज वाला भाग ऐसे ही अंतरों के बारे में है।

`traceroute` रास्ते में packets जिस-जिस router से गुज़रते हैं, वे सब दिखाता है।
इसे install करके `traceroute example.com` आज़माइए!

## सारांश

| Command | क्या करता है |
|---|---|
| `ip a` | IP addresses दिखाता है |
| `ip route` | Routing table और gateway दिखाता है |
| `ping -c 3 HOST` | Test करता है कि किसी computer तक पहुँचा जा सकता है या नहीं |
| `dig +short NAME` | DNS में किसी name को look up करता है |
| `getent hosts NAME` | System की तरह look up करता है (`/etc/hosts` के साथ) |
| `ss -tulpn` | Listen कर रहे ports दिखाता है |
| `curl URL` | लाता है और दिखाता है |
| `curl -o FILE URL`, `wget URL` | File में download करता है |
| `ssh USER@HOST COMMAND` | दूसरे computer पर command चलाता है |
