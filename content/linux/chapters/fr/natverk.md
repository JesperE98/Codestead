# Réseau

Presque tout ce que fait un ordinateur Linux passe par la communication avec
d'autres ordinateurs : récupérer des mises à jour, afficher des pages web, se
connecter à des serveurs. Quand quelque chose ne va pas, c'est le terminal qui
offre les meilleurs outils pour comprendre pourquoi. Dans ce chapitre, vous
apprendrez à trouver votre propre adresse, à tester des connexions, à résoudre
des noms, à voir quels services tournent, à récupérer des choses sur le web et
à vous connecter à un autre ordinateur avec SSH.

L'ordinateur simulé se trouve dans un petit réseau domestique :

| Ordinateur | Adresse | Quoi |
|---|---|---|
| Votre ordinateur (`ubuntu`) | `192.168.1.42` | Là où vous êtes en ce moment |
| Le routeur (passerelle) | `192.168.1.1` | La connexion vers Internet |
| Le serveur | `192.168.1.10` | Un autre ordinateur Linux sur lequel vous pouvez vous connecter |

Derrière le routeur se trouve un « Internet » avec, entre autres,
`example.com`, `linux.org` et `archlinux.org`.

## Les adresses IP

Chaque ordinateur d'un réseau a une **adresse IP**. Une adresse IPv4 se
compose de quatre nombres entre 0 et 255, par exemple `192.168.1.42`. Les
adresses qui commencent par `192.168.`, `10.` ou `172.16.`–`172.31.` sont
**privées** – elles ne servent qu'à l'intérieur des réseaux locaux et on ne
les voit jamais sur Internet.

La commande pour afficher les adresses de l'ordinateur est `ip` (du paquet
*iproute2*). `ip addr` peut s'abréger en `ip a` :

```sh
ip a
```

Vous voyez deux **interfaces** (cartes réseau) :

- `lo` – *loopback*, une carte fictive que l'ordinateur utilise pour se
  parler à lui-même.
- `enp0s3` – la vraie carte réseau. Autrefois, les cartes s'appelaient
  `eth0`, et les cartes sans fil portent souvent un nom comme `wlan0` ou
  `wlp2s0`.

La ligne `inet 192.168.1.42/24` est votre adresse IPv4. `link/ether` est
l'**adresse MAC** de la carte, gravée dans le matériel, et `state UP` signifie
que la carte est active. Pour un aperçu plus court, il y a `-br` (*brief*), et
`hostname -I` n'affiche que les adresses :

```sh
ip -br a
hostname -I
```

```try
ip -br a
---
Une ligne par interface : le nom, l'état (`UP`) et les adresses.
```

Vous croiserez encore l'ancienne commande `ifconfig` (du paquet *net-tools*)
dans de nombreux tutoriels, mais elle n'est plus installée par défaut sur les
distributions modernes. `ip` fait tout ce qu'elle faisait, et plus encore.

## localhost – l'ordinateur lui-même

L'adresse `127.0.0.1` porte le nom **localhost** et signifie toujours « cet
ordinateur-ci ». Les programmes d'un même ordinateur communiquent souvent
entre eux via localhost – par exemple un serveur web que vous développez et le
navigateur avec lequel vous le testez. Le trafic vers localhost ne quitte
jamais l'ordinateur.

## Masque de réseau et passerelle

Le `/24` après l'adresse est le **masque de réseau**. Il indique que les 24
premiers bits (les trois premiers nombres, `192.168.1`) forment l'adresse du
réseau. Tous les ordinateurs dont l'adresse commence par `192.168.1.` sont sur
le même réseau local et peuvent être joints directement. Tout le reste est
envoyé à la **passerelle** (*gateway*) – le routeur – qui le transmet vers
Internet. On le voit dans la table de routage :

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

La première ligne, **default**, est la route par défaut : « tout ce qui n'est
pas listé ailleurs part vers 192.168.1.1 ». La deuxième ligne dit que tout le
réseau `192.168.1.0/24` est joignable directement via `enp0s3`. `proto dhcp`
signifie que l'ordinateur a reçu sa configuration automatiquement du routeur
par **DHCP**.

```quiz
Votre ordinateur a l'adresse `192.168.1.42/24`. Quelles adresses peut-il
joindre directement, sans passer par la passerelle ?
- [x] `192.168.1.10`
- [x] `192.168.1.1`
- [ ] `192.168.2.10`
- [ ] `1.1.1.1`
---
Avec `/24`, les trois premiers nombres sont l'adresse du réseau. Tout ce qui
commence par `192.168.1.` est sur le même réseau local – tout le reste passe
par la route par défaut vers la passerelle.
```

```predict
$ ip route | grep default | awk '{print $3}'
192.168.1.1
---
Le troisième mot de la ligne `default` est l'adresse de la passerelle.
```

## ping – est-ce joignable ?

`ping` envoie de petits paquets de test et mesure le temps que mettent les
réponses. Avec `-c` (*count*), vous choisissez le nombre de paquets – sinon
ping continue jusqu'à ce que vous appuyiez sur **Ctrl+C** :

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` est le temps de réponse. Moins d'une milliseconde à l'intérieur du
  réseau domestique, souvent 10–50 ms vers Internet.
- `0% packet loss` – aucun paquet n'a disparu. Des paquets perdus indiquent
  un réseau de mauvaise qualité (ou une mauvaise connexion wifi).
- `Destination Host Unreachable` signifie qu'aucun ordinateur du réseau
  local n'a cette adresse.

Essayez aussi de pinguer l'ordinateur lui-même et un ordinateur sur Internet :

```sh
ping -c 2 localhost
ping -c 3 example.com
```

Attention ! Beaucoup de serveurs et de pare-feu ne répondent volontairement
pas au ping. L'absence de réponse ne veut donc pas toujours dire que
l'ordinateur est éteint.

## Les noms et le DNS

Les humains retiennent des noms, les ordinateurs utilisent des adresses. Le
**DNS** (*Domain Name System*) est l'annuaire d'Internet qui traduit
`example.com` en adresse IP. Le serveur DNS que l'ordinateur interroge est
indiqué dans `/etc/resolv.conf` :

```sh
cat /etc/resolv.conf
```

Sur Ubuntu, on y lit `127.0.0.53` – c'est **systemd-resolved**, un
intermédiaire local sur votre propre ordinateur qui interroge à son tour le
routeur. Certaines autres distributions indiquent directement le routeur,
`192.168.1.1`.

Pour interroger le DNS vous-même, on utilise `dig`, `host` ou `nslookup`. Ils
ne sont pas installés d'office. Sur Ubuntu, ils se trouvent dans le paquet
`dnsutils` (les autres familles donnent un autre nom au paquet) :

```sh
sudo apt update
sudo apt install dnsutils
```

`dig` affiche toute la réponse du serveur DNS. La partie importante se trouve
sous `ANSWER SECTION`. Avec `+short`, vous n'obtenez que l'adresse :

```sh
dig example.com
dig +short example.com
```

`host` et `nslookup` font la même chose avec une sortie plus courte.
`nslookup` existe aussi sous Windows et macOS. `host` sait également faire une
**résolution inverse** – de l'adresse vers le nom :

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

Vous pouvez interroger un serveur DNS précis avec `@`, par exemple `1.1.1.1`
de Cloudflare ou `8.8.8.8` de Google :

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts – la liste de noms de l'ordinateur

Avant d'interroger le DNS, l'ordinateur regarde dans le fichier `/etc/hosts`.
On y trouve entre autres que `localhost` est `127.0.0.1` :

```sh
cat /etc/hosts
```

Le serveur du réseau domestique a l'adresse `192.168.1.10`, mais le nom
`server.lan` ne figure dans aucun DNS :

```sh
ping -c 1 server.lan
```

La solution consiste à ajouter une ligne dans `/etc/hosts`. Le fichier
appartient à root, il faut donc `sudo`. Mais attention – ceci ne fonctionne
**pas** :

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

`sudo` ne s'applique qu'à `echo`. C'est votre propre shell (qui tourne sous
votre nom, pas en root) qui ouvre le fichier pour `>>`. L'astuce, c'est
`tee -a`, qui ajoute ce qu'il reçoit du pipe à la fin d'un fichier – et `tee`,
lui, peut être lancé avec sudo :

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

Désormais, le nom fonctionne pour tous les programmes de l'ordinateur. Mais
`dig` interroge directement le DNS et ignore `/etc/hosts`, il ne trouve donc
toujours rien. Pour voir ce que *le système* résout, utilisez `getent` :

```sh
dig +short server.lan
getent hosts server.lan
```

L'ordre (d'abord le fichier, puis le DNS) est défini par la ligne `hosts:` de
`/etc/nsswitch.conf`.

```quiz
Pourquoi `sudo echo '192.168.1.10 server.lan' >> /etc/hosts` donne-t-il
*Permission denied* ?
- [ ] `echo` ne peut pas être lancé avec sudo
- [x] C'est votre propre shell, et non root, qui ouvre le fichier pour `>>` – sudo ne s'applique qu'à `echo`
- [ ] `/etc/hosts` ne peut pas être modifié, pas même par root
- [ ] `>>` ne fonctionne que sur les fichiers de votre répertoire personnel
---
C'est pourquoi on utilise `echo ... | sudo tee -a /etc/hosts` : c'est alors
`tee`, qui tourne en tant que root, qui ouvre le fichier.
```

## Ports et services

Une adresse IP désigne un ordinateur. Un **port** (un nombre entre 1 et
65535) désigne un programme sur cet ordinateur – comme une adresse postale et
un numéro d'appartement. On dit d'un programme qui attend des connexions qu'il
**écoute** sur un port. Quelques ports bien connus :

| Port | Service |
|---|---|
| 22 | SSH – se connecter à d'autres ordinateurs |
| 53 | DNS |
| 80 | HTTP – le web |
| 443 | HTTPS – le web chiffré |
| 8080 | Souvent des serveurs web pendant le développement |

Seul root peut ouvrir les ports inférieurs à 1024. `ss` (*socket statistics*)
affiche les ports en écoute :

```sh
ss -tulpn
```

Les options se retiennent souvent comme une comptine : **t**cp, **u**dp,
**l**istening, **p**rocess, **n**umeric. `0.0.0.0:22` signifie que `sshd`
écoute sur le port 22 sur toutes les adresses de l'ordinateur, et `[::]:22`
est la même chose pour IPv6. La colonne *Process* est vide pour les processus
appartenant à d'autres utilisateurs – avec `sudo`, vous les voyez tous :

```sh
sudo ss -tulpn
```

Si le serveur d'exercice `myserver` du chapitre sur les processus tourne,
vous le voyez ici sur le port 8080. L'ancienne commande `netstat -tulpn` (de
*net-tools*) fait la même chose.

## Récupérer sur le web : curl et wget

`curl` récupère ce qui se trouve à une adresse (une **URL**) et l'affiche dans
le terminal. Essayez-le avec myserver sur votre propre ordinateur :

Sur Ubuntu, `curl` n'est pas préinstallé (mais `wget` l'est) :

```sh
sudo apt install curl
```

```sh
curl http://localhost:8080
```

Vous obtenez `Couldn't connect to server` ? Alors rien n'écoute sur ce port –
vous avez peut-être arrêté myserver dans le chapitre sur les processus.
Relancez-le :

```sh
myserver
```

Avec `-I`, curl n'affiche que les **en-têtes** de la réponse, dont la première
ligne contient un **code de statut** :

```sh
curl -I https://example.com
```

| Code | Signifie |
|---|---|
| 200 | OK |
| 301, 302 | La page a déménagé – voir `Location:` |
| 403 | Interdit |
| 404 | Introuvable |
| 500 | Erreur du serveur |

Beaucoup de sites redirigent de `http://` vers `https://`. Vous n'obtenez
alors qu'un bref « 301 Moved Permanently ». Avec `-L`, curl suit la
redirection :

```sh
curl -I http://linux.org
curl -L http://linux.org
```

Comme curl écrit dans le terminal, il fonctionne à merveille dans un pipe.
`-s` (*silent*) désactive l'indicateur de progression :

```sh
curl -s https://example.com | grep title
```

Pour enregistrer dans un fichier, utilisez `-o FICHIER` (ou `-O`, qui prend le
nom du fichier dans l'adresse) :

```sh
cd ~
curl -o {{exampleHtml}} https://example.com
```

`wget` est fait pour télécharger des fichiers. Il enregistre toujours dans un
fichier, affiche la progression et suit les redirections tout seul :

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

Pour choisir vous-même le nom du fichier, utilisez `-O` majuscule :
`wget -O file.html URL`.

## SSH – se connecter à un autre ordinateur

**SSH** (*Secure Shell*) est la manière habituelle de piloter un ordinateur
Linux à distance, et tout ce qui transite est chiffré. Le serveur fait tourner
le service `sshd` sur le port 22, et vous vous connectez avec le client
`ssh` :

```sh
ssh {{user}}@server.lan hostname
```

`{{user}}@server.lan` signifie « l'utilisateur {{user}} sur l'ordinateur
server.lan ». La commande après l'hôte (`hostname`) s'exécute sur le serveur
et la réponse s'affiche ici – elle dit `server`, et non `ubuntu`.

La première fois que vous vous connectez à un ordinateur, ssh vous demande si
vous lui faites confiance :

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Tapez `yes` (le mot en entier). La **clé d'hôte** du serveur est alors
enregistrée dans `~/.ssh/known_hosts`. Si la clé change plus tard, ssh vous
avertit bruyamment – cela pourrait signifier que quelqu'un se fait passer pour
le serveur.

La commande peut regrouper plusieurs commandes entre guillemets :

```sh
ssh {{user}}@server.lan 'whoami; uptime; ls'
ssh {{user}}@server.lan cat {{welcomeFile}}
```

Sans commande, ssh vous connecte et vous obtenez un shell sur l'autre
ordinateur, que vous quittez avec `exit`. Ce n'est pas pris en charge dans le
simulateur – là, vous écrivez toujours la commande juste après l'hôte.

### Des clés plutôt que des mots de passe

Au lieu d'un mot de passe, vous pouvez vous connecter avec une **paire de
clés**. La clé privée reste chez vous, et la clé publique est placée sur le
serveur :

```sh
ssh-keygen
ssh-copy-id {{user}}@server.lan
```

Appuyez sur Entrée aux questions de `ssh-keygen` pour utiliser le fichier par
défaut `~/.ssh/id_ed25519` sans phrase de passe. `ssh-copy-id` ajoute la clé
publique (`id_ed25519.pub`) à `~/.ssh/authorized_keys` sur le serveur. Ensuite,
ssh ne vous demande plus de mot de passe. Ne montrez jamais la clé privée à
personne !

Avec `scp` et `rsync`, vous pouvez copier des fichiers via SSH, et dans le
fichier `~/.ssh/config`, vous pouvez donner des noms courts aux serveurs –
mais cela attendra un prochain chapitre.

## Quand le réseau ne fonctionne pas

« Internet ne marche pas » peut avoir bien des causes. Suivez les étapes dans
l'ordre, de l'intérieur vers l'extérieur – la première étape qui échoue montre
où se trouve le problème :

| Étape | Commande | Si elle échoue |
|---|---|---|
| 1. Ai-je une adresse ? | `ip a` | La carte est désactivée (`state DOWN`) ou n'a pas reçu d'adresse |
| 2. Y a-t-il une sortie ? | `ip route` | Pas de ligne `default` – pas de passerelle |
| 3. Puis-je joindre le routeur ? | `ping -c 3 192.168.1.1` | Problème sur le réseau local (câble, wifi) |
| 4. Puis-je joindre Internet ? | `ping -c 3 1.1.1.1` | Problème au niveau du routeur ou du fournisseur d'accès |
| 5. Le DNS fonctionne-t-il ? | `ping -c 3 example.com` | La résolution de noms échoue – vérifiez `/etc/resolv.conf` |

L'étape 4 pingue directement une adresse, sans aucun nom. Si l'étape 4
fonctionne mais pas l'étape 5, c'est presque toujours le DNS qui est en panne
– l'un des problèmes les plus courants.

```quiz
`ping -c 3 1.1.1.1` fonctionne, mais `ping -c 3 example.com` répond
*Name or service not known*. Où se trouve probablement le problème ?
- [ ] La carte réseau est désactivée
- [ ] Il n'y a pas de route par défaut
- [x] Le DNS – la résolution de noms ne fonctionne pas
- [ ] example.com ne répond pas au ping
---
Si vous pouvez joindre une adresse sur Internet, la carte, la route et le
routeur fonctionnent. Il reste la traduction du nom – vérifiez
`/etc/resolv.conf`.
```

Essayez par vous-même ! Désactivez la carte réseau, suivez les étapes, puis
réactivez-la :

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## Les paquets

Les outils réseau se trouvent dans différents paquets. Sur Ubuntu, ils
s'appellent :

| Outil | Paquet sur Ubuntu |
|---|---|
| `ip`, `ss` | `iproute2` |
| `ping` | `iputils-ping` |
| `dig`, `host`, `nslookup` | `dnsutils` |
| `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` |

Comme d'habitude, les autres familles donnent un autre nom à certains de ces
paquets – la partie consacrée aux distributions et aux paquets traite de ce
genre de différences.

`traceroute` affiche chaque routeur par lequel passent les paquets en chemin.
Installez-le et essayez `traceroute example.com` !

## Résumé

| Commande | Fait |
|---|---|
| `ip a` | Affiche les adresses IP |
| `ip route` | Affiche la table de routage et la passerelle |
| `ping -c 3 HÔTE` | Teste si un ordinateur est joignable |
| `dig +short NOM` | Résout un nom dans le DNS |
| `getent hosts NOM` | Résout comme le fait le système (avec `/etc/hosts`) |
| `ss -tulpn` | Affiche les ports en écoute |
| `curl URL` | Récupère et affiche |
| `curl -o FICHIER URL`, `wget URL` | Télécharge dans un fichier |
| `ssh UTILISATEUR@HÔTE COMMANDE` | Exécute une commande sur un autre ordinateur |
