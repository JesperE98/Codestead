# Utilisateurs et groupes

Linux a été conçu dès le départ pour que de nombreuses personnes partagent le
même ordinateur en même temps. Chaque fichier a un propriétaire et chaque
programme tourne sous un utilisateur précis – c'est pourquoi créer, modifier
et supprimer des comptes est l'une des tâches les plus importantes d'un
administrateur. Dans ce chapitre, vous créez l'utilisateur `kim`, donnez au
compte un mot de passe et les droits sudo, et apprenez où tout cela est
stocké.

## Utilisateurs et UID

Vous savez déjà comment découvrir qui vous êtes :

```sh
whoami
id
```

`id` montre que vous n'avez pas seulement un nom, mais aussi un numéro :
`uid=1000`. C'est l'**UID** (*user ID*), et c'est ce numéro – pas le nom – que
le noyau prend en compte. Le nom n'est là que pour que nous, les humains,
n'ayons pas à retenir des numéros. Quelques numéros importants :

| UID | Qui |
|---|---|
| `0` | **root**, l'administrateur. Celui qui a l'UID 0 a le droit de tout faire. |
| `1`–`999` | Les **utilisateurs système**, pour les services et les programmes |
| `1000` et plus | Les **utilisateurs ordinaires** – des personnes. Le premier reçoit 1000. |

## La liste des utilisateurs – `/etc/passwd`

Tous les utilisateurs sont listés dans le fichier texte `/etc/passwd`, une
ligne par utilisateur :

```sh
cat /etc/passwd
```

Chaque ligne comporte sept champs séparés par des deux-points. Regardez votre
propre ligne :

```sh
grep {{user}} /etc/passwd
```

```text
{{user}}:x:1000:1000:{{userFull}},,,:/home/{{user}}:/bin/bash
  1   2  3    4      5          6          7
```

| Champ | Signification |
|---|---|
| 1 | Le nom d'utilisateur |
| 2 | `x` – le mot de passe se trouve dans `/etc/shadow` (voir plus bas) |
| 3 | L'UID |
| 4 | Le GID – le numéro du **groupe principal** de l'utilisateur |
| 5 | Un commentaire, en général le nom complet |
| 6 | Le répertoire personnel |
| 7 | Le shell lancé quand l'utilisateur se connecte |

La commande `getent` fait la même recherche. La différence, c'est qu'elle
trouve aussi les utilisateurs qui ne sont pas dans le fichier, par exemple
dans une école ou une entreprise où les comptes se trouvent sur un serveur
central :

```sh
getent passwd {{user}}
```

### Les utilisateurs système

La plupart des lignes de `/etc/passwd` ne sont pas des personnes. Des
services comme le serveur web ou le système de journalisation tournent sous
leur propre utilisateur avec le moins de droits possible – s'ils se font
pirater, l'attaquant ne peut pas atteindre vos fichiers. Ils ont le shell
`nologin`, si bien que personne ne peut se connecter sous leur nom. Sur
Ubuntu, l'utilisateur du serveur web s'appelle `www-data` (les noms des
utilisateurs système diffèrent d'une distribution à l'autre) :

```sh
grep www-data /etc/passwd
```

Avec `awk`, vu dans le chapitre sur le traitement de texte, vous pouvez
lister tous ceux qui ont un UID de 1000 ou plus – les utilisateurs
ordinaires :

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

`nobody` (UID 65534) apparaît aussi. C'est un utilisateur spécial qui ne
possède « rien » et qu'on utilise quand un programme doit avoir le moins de
droits possible.

```predict
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
---
Le champ 3 est l'UID, et seul root a l'UID 0. C'est le numéro, et non le nom,
qui donne à root ses pouvoirs.
```

## Groupes et GID

Un **groupe** permet de donner les mêmes droits à plusieurs utilisateurs, par
exemple sur un répertoire de projet partagé. Les groupes sont listés dans
`/etc/group` :

```sh
cat /etc/group
```

```text
sudo:x:27:{{user}}
 1   2  3   4
```

Les champs sont le nom du groupe, `x`, le numéro du groupe (le **GID**) et une
liste de membres séparés par des virgules.

Chaque utilisateur a **un groupe principal** (le champ GID de `/etc/passwd`)
et peut en plus être membre d'un nombre quelconque de **groupes
secondaires**. Les nouveaux fichiers que vous créez reçoivent votre groupe
principal. Sur la plupart des distributions, chaque utilisateur reçoit un
groupe principal privé du même nom – `{{user}}` est dans le groupe `{{user}}`.

```sh
groups
id
```

```quiz
Vous (`{{user}}`) êtes dans les groupes `{{user}}` et `sudo`, et votre groupe
principal est `{{user}}`. Quel groupe reçoit un nouveau fichier que vous créez ?
- [x] `{{user}}`
- [ ] `sudo`
- [ ] Les deux
- [ ] `root`
---
Les nouveaux fichiers reçoivent votre groupe **principal** – le champ GID de
`/etc/passwd`. Les groupes secondaires comme `sudo` vous donnent des droits
supplémentaires, mais ne se retrouvent pas sur vos fichiers.
```

## Les mots de passe – `/etc/shadow`

Remarquez le `x` dans le champ 2 de `/etc/passwd`. Autrefois, le mot de passe
(chiffré) se trouvait justement là. Le problème, c'est que `/etc/passwd`
**doit** être lisible par tout le monde – c'est là que `ls -l` va chercher le
nom des propriétaires. N'importe qui pouvait donc copier les mots de passe
chiffrés et tenter de les casser tranquillement. C'est pourquoi ils ont été
déplacés dans `/etc/shadow`, que seul root peut lire :

```sh
ls -l /etc/passwd /etc/shadow
sudo cat /etc/shadow
```

```text
kim:$y$j9T$Tm9...$Kx2...:20756:0:99999:7:::
```

Le champ 2 n'est pas le mot de passe lui-même, mais un **hash** – une
« empreinte » qu'on ne peut pas inverser. Quand vous vous connectez, le hash
de ce que vous avez tapé est calculé et comparé à celui qui est enregistré.
`$y$` signifie que la méthode *yescrypt* est utilisée. Un `!` ou un `*` à la
place signifie qu'il n'y a pas de mot de passe, ou que le compte est
**verrouillé**. Les champs restants indiquent quand le mot de passe a été
changé pour la dernière fois et quand il expire. `chage` les affiche en
clair :

```sh
chage -l {{user}}
```

```try
chage -l {{user}}
---
`Password expires: never` – le mot de passe de {{user}} n'a jamais besoin d'être
changé.
```

## Créer un utilisateur – `useradd`

Créer des utilisateurs nécessite les droits root. La commande la plus
courante existe sur toutes les distributions :

```sh
sudo useradd -m -s /bin/bash kim
```

| Option | Signification |
|---|---|
| `-m` | Crée le répertoire personnel `/home/kim` |
| `-s /bin/bash` | Le shell de l'utilisateur |
| `-c "Kim Dupont"` | Le commentaire (nom complet) |
| `-G group1,group2` | Des groupes secondaires dès le départ |

`useradd` trouve le prochain UID libre à partir de 1000 – `kim` reçoit 1001.
Les limites se trouvent dans `/etc/login.defs`. Un groupe `kim` est créé lui
aussi, et les fichiers de `/etc/skel` (*skeleton*, squelette) sont copiés dans
le nouveau répertoire personnel. Mettez-y quelque chose et chaque nouvel
utilisateur le recevra :

```sh
ls -a /etc/skel
```

Sur Ubuntu, `useradd` est avare : sans `-m`, **aucun** répertoire personnel
n'est créé, et sans `-s`, le shell devient `/bin/sh`. D'autres distributions
ont d'autres valeurs par défaut, alors prenez l'habitude de taper `-m` et `-s`
– ainsi, la même commande fonctionne partout.

C'est pourquoi Ubuntu a aussi le script plus convivial `adduser`, propre à la
famille Debian. Il crée le répertoire personnel, choisit bash et demande un
mot de passe et un nom :

```sh
sudo adduser lisa
```

Répondez aux questions – vous pouvez appuyer sur Entrée pour la plupart.
`adduser` sait aussi ajouter un utilisateur existant à un groupe :
`sudo adduser lisa sudo`.

`useradd`, `passwd` et les autres commandes de ce chapitre sont toujours
installées. Sur Ubuntu, elles viennent du paquet `passwd` ; les autres
familles donnent un autre nom au paquet.

## Définir un mot de passe – `passwd`

Un nouveau compte n'a pas de mot de passe (`!` dans `/etc/shadow`), personne
ne peut donc s'y connecter. Définissez-en un avec `passwd` :

```sh
sudo passwd kim
```

Vous tapez le mot de passe deux fois. **Ce que vous tapez ne s'affiche
pas** – pas d'étoiles, rien. C'est voulu : quelqu'un qui regarde par-dessus
votre épaule ne doit même pas voir la longueur du mot de passe. Tapez-le et
appuyez sur Entrée.

`passwd` sans nom change votre propre mot de passe. Seul root peut changer le
mot de passe des autres utilisateurs – essayez sans sudo :

```sh
passwd root
```

## Les groupes – `groupadd`, `usermod -aG` et `gpasswd`

Créez un groupe et ajoutez-y un membre :

```sh
sudo groupadd {{devGroup}}
sudo usermod -aG {{devGroup}} kim
groups kim
```

`-aG` signifie *append to Groups* (ajouter aux groupes). **N'oubliez pas le
`-a` !** Avec seulement `-G`, la liste des groupes secondaires devient
exactement ce que vous tapez – et l'utilisateur est retiré de tous les autres
groupes, comme le groupe sudo. Une façon classique de s'enfermer dehors.

```quiz
`kim` est dans les groupes secondaires `sudo` et `{{devGroup}}`. Un
administrateur lance `sudo usermod -G backup kim`. Dans quels groupes
secondaires kim se trouve-t-il ensuite ?
- [ ] `sudo`, `{{devGroup}}` et `backup`
- [x] Seulement `backup`
- [ ] `sudo` et `{{devGroup}}` – la commande échoue sans `-a`
- [ ] Aucun
---
Sans `-a`, la liste devient exactement ce que vous tapez. Avec
`sudo usermod -aG backup kim`, kim aurait gardé les autres groupes.
```

`gpasswd` fait la même chose et sait aussi retirer des membres :

```sh
sudo gpasswd -a kim {{devGroup}}
sudo gpasswd -d kim {{devGroup}}
```

Sur un vrai ordinateur, une nouvelle appartenance à un groupe ne prend effet
qu'à la prochaine connexion de l'utilisateur. Le simulateur est plus gentil –
ici, elle s'applique immédiatement.

Les groupes servent pour les répertoires partagés. Faites du groupe le
propriétaire et donnez-lui le droit d'écriture avec `chgrp` et `chmod` :

```sh
sudo mkdir /srv/projet
sudo chgrp {{devGroup}} /srv/projet
sudo chmod 775 /srv/projet
ls -ld /srv/projet
```

## Donner les droits sudo – le groupe `sudo`

Qui a le droit d'utiliser `sudo` est défini dans `/etc/sudoers` :

```sh
sudo cat /etc/sudoers
```

La ligne `%sudo ALL=(ALL:ALL) ALL` signifie que tous les membres du groupe
**sudo** peuvent exécuter n'importe quelle commande en tant que root. Donner
les droits sudo à quelqu'un revient donc simplement à l'ajouter au bon
groupe – sur Ubuntu, le groupe `sudo` :

```sh
sudo usermod -aG sudo kim
```

Ce groupe porte des noms différents selon les familles : sous Arch et Fedora,
il s'appelle `wheel` – un vieux nom Unix pour « ceux qui commandent »
(*big wheel*, un « gros bonnet »).

Ne modifiez jamais `/etc/sudoers` directement avec un éditeur ordinaire – une
faute de frappe peut faire que plus personne ne puisse utiliser sudo.
Utilisez `visudo`, qui vérifie le fichier avant de l'enregistrer. En général,
les groupes suffisent amplement.

## Changer d'utilisateur – `su` et `sudo -u`

Il y a deux façons de devenir quelqu'un d'autre :

| Commande | Le mot de passe de qui ? | Ce qui se passe |
|---|---|---|
| `su - kim` | **celui de kim** | Vous êtes connecté en tant que kim jusqu'à ce que vous tapiez `exit` |
| `sudo -u kim command` | **le vôtre** (il vous faut les droits sudo) | Une seule commande s'exécute en tant que kim |
| `sudo -iu kim` | le vôtre | Un shell de connexion en tant que kim |

```sh
sudo -u kim whoami
```

Avec `su`, vous changez vraiment d'utilisateur. Le tiret (`-`) en fait une
connexion complète : vous arrivez dans le répertoire personnel de kim, avec
les réglages de kim. L'invite montre qui vous êtes, et `exit` vous ramène :

```sh
su - kim
```

`su` sans nom signifie root. Sur Ubuntu, root n'a pas de mot de passe, donc
`su -` n'y fonctionne pas – utilisez `sudo -i`.

```quiz
Vous voulez exécuter une seule commande en tant que `kim`, mais vous ne
connaissez pas le mot de passe de kim. Vous avez les droits sudo. Qu'est-ce
qui fonctionne ?
- [ ] `su - kim`
- [x] `sudo -u kim command`
- [ ] `su kim command`
- [ ] Rien – il vous faut le mot de passe de kim
---
`su` demande le mot de passe de l'utilisateur que vous devenez. `sudo`
demande **votre propre** mot de passe et vérifie dans `/etc/sudoers` que vous
en avez le droit.
```

## Verrouiller et supprimer des comptes

Un compte qui ne doit pas servir pendant un moment peut être **verrouillé**.
`usermod -L` place un `!` devant le hash dans `/etc/shadow`, si bien qu'aucun
mot de passe ne correspond plus. `-U` le déverrouille :

```sh
sudo usermod -L kim
sudo passwd -S kim
sudo usermod -U kim
```

`passwd -S` affiche l'état : `P` (a un mot de passe), `L` (verrouillé) ou `NP`
(pas de mot de passe). Avec `chage -E`, un compte peut expirer à une date
donnée – pratique pour les saisonniers et les remplaçants.

Avant de supprimer quelqu'un, il peut être utile de voir qui est connecté et
quand quelqu'un l'a été pour la dernière fois :

```sh
who
last
```

Ensuite, `userdel` supprime l'utilisateur. Avec `-r`, le répertoire personnel
disparaît aussi – sans `-r`, les fichiers restent :

```sh
sudo useradd -m {{tempUser}}
sudo userdel -r {{tempUser}}
```

Ubuntu a aussi `deluser`, le pendant d'`adduser` :
`sudo deluser --remove-home {{tempUser}}`. `sudo deluser kim sudo` retire kim du
groupe sudo.

`userdel` refuse de supprimer un utilisateur connecté – essayez
`sudo userdel {{user}}`.

## Résumé

| Commande | Fait |
|---|---|
| `id`, `groups` | Affiche l'UID, le GID et les groupes |
| `useradd -m -s /bin/bash nom` | Crée un utilisateur |
| `passwd nom` | Définit un mot de passe |
| `usermod -aG groupe nom` | Ajoute à un groupe |
| `groupadd groupe` | Crée un groupe |
| `usermod -L` / `-U` | Verrouille / déverrouille |
| `userdel -r nom` | Supprime l'utilisateur et son répertoire personnel |
| `su - nom`, `sudo -u nom` | Change d'utilisateur |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` | Là où tout est stocké |
