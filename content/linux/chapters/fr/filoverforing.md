# Copier des fichiers via SSH

Dans le chapitre sur le réseau, vous avez lancé des commandes sur le serveur
`192.168.1.10` avec `ssh`. Ici, vous donnez un nom court au serveur, vous
copiez des fichiers vers lui et depuis lui avec `scp`, et vous gardez des
répertoires entiers synchronisés avec `rsync`.

## Des noms courts – `~/.ssh/config`

Taper `ssh {{user}}@192.168.1.10` à chaque fois devient vite lassant. Dans le
fichier `~/.ssh/config`, vous pouvez donner un nom court à un serveur :

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` est le nom court, `HostName` la vraie adresse (ou le vrai nom) et `User`
le nom d'utilisateur sur le serveur. Si le serveur écoute sur un autre port que
22, ajoutez une ligne comme `Port 2222`. Après cela, ceci suffit :

```sh
ssh srv hostname
```

Le simulateur n'a pas encore d'éditeur de texte, alors écrivez le fichier avec
`echo`. L'indentation n'est là que pour faciliter la lecture :

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

ssh est strict avec ce fichier. Si d'autres peuvent y écrire, ssh refuse avec
*Bad owner or permissions*, et un mot mal orthographié l'arrête aussitôt :

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
ssh lit tout le fichier avant de se connecter : un seul mot erroné bloque donc
toutes les connexions – et le message d'erreur indique à quelle ligne il se
trouve.
```

Les noms fonctionnent aussi avec `scp` et `rsync`.

```quiz
Dans `~/.ssh/config`, quelle ligne indique où ssh doit vraiment se connecter ?
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` est le nom court que vous tapez vous-même, `HostName` la vraie adresse
et `User` l'utilisateur sous lequel vous vous connectez.
```

## Copier – `scp`

`scp` (*secure copy*) fonctionne comme `cp`, mais l'un des côtés peut se
trouver sur un autre ordinateur. On l'écrit `HOST:PATH` :

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- La source vient en premier et la destination en dernier, exactement comme
  avec `cp`.
- Un chemin après les deux-points part de votre répertoire personnel sur le
  serveur, et `srv:` seul désigne le répertoire personnel.
- Les répertoires ont besoin de `-r`.
- Le port s'indique avec un `-P` majuscule (avec `ssh`, c'est un `-p`
  minuscule).

Pour chaque fichier, `scp` affiche une ligne avec le nom, `100%`, la taille et
la vitesse.

```quiz
Vous tapez `scp report.txt srv` – sans deux-points. Que se passe-t-il ?
- [ ] Le fichier est copié dans votre répertoire personnel sur le serveur
- [x] Vous obtenez une copie locale appelée `srv`
- [ ] scp demande de quel ordinateur vous parlez
---
Sans les deux-points, `srv` n'est qu'un nom de fichier, et `scp` copie en local
comme `cp`. Les deux-points s'oublient facilement !
```

## Rester synchronisé – `rsync`

Pour beaucoup de fichiers, ou pour quelque chose que vous copiez encore et
encore (les sauvegardes !), `rsync` est meilleur. Il ne copie que ce qui manque
ou a changé :

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{fruits}}
{{grades}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

`-a` (*archive*) copie les répertoires récursivement et conserve les
permissions et les dates, et `-v` liste ce qui est copié. Relancez la même
commande et la liste est vide – rien n'a changé. rsync compare la taille et la
date de modification de chaque fichier ; sans `-a`, les copies reçoivent de
nouvelles dates, et tout est envoyé à chaque fois.

### La barre oblique à la fin

Une barre oblique à la fin de la source est importante :

| Commande | Donne |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...` – le répertoire lui-même |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...` – seulement ce qu'il contient |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
Sans la barre oblique, c'est le répertoire lui-même qui a été copié dans
`/tmp/x`.
```

### Via SSH et `--delete`

Avec un serveur comme destination, rsync passe par ssh :

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

`--delete` supprime aussi dans la destination les fichiers qui n'existent plus
dans la source, pour que la destination devienne une copie exacte. Un chemin
erroné peut alors supprimer beaucoup de choses, alors essayez d'abord avec `-n`
(*dry run*). Rien ne se passe, rsync montre seulement ce qu'il ferait, et la
dernière ligne se termine par `(DRY RUN)` :

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
Que fait `-n` dans `rsync -avn --delete a/ b/` ?
- [ ] Il ne copie que les nouveaux fichiers
- [x] Il montre ce qui se passerait sans rien faire
- [ ] Il ignore les fichiers qui seraient supprimés
---
`-n` est un essai à blanc. Vérifiez d'abord la liste – puis lancez la même
commande sans `-n`.
```

## scp ou rsync ?

| | `scp` | `rsync` |
|---|---|---|
| Bon pour | Quelques fichiers, une fois | Les sauvegardes et les copies répétées |
| Envoie | Tout, à chaque fois | Seulement ce qui a changé |
| En local aussi | Possible, mais `cp` est plus simple | Oui |
| Miroir avec `--delete` | Non | Oui |

`scp` est fourni avec le client ssh. `rsync` doit être installé sur les deux
ordinateurs : il est présent d'office sur Ubuntu, Debian et Fedora, tandis que
sur Arch, vous installez le paquet `rsync`.

Dans le simulateur, le serveur oublie ses fichiers quand vous fermez
l'application.
