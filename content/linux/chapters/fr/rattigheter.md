# Utilisateurs, permissions et sudo

Linux est conçu pour que plusieurs utilisateurs puissent partager le même
ordinateur. C'est pourquoi chaque fichier a un propriétaire et des règles qui
définissent qui a le droit de faire quoi.

## Utilisateurs et groupes

Vous êtes connecté en tant qu'utilisateur `elev`. Chaque utilisateur
appartient à un ou plusieurs **groupes** :

```sh
id
```

L'utilisateur le plus important est **root** – l'administrateur, qui a le
droit de tout faire. On se connecte rarement en tant que root. On utilise
plutôt `sudo` (voir plus bas).

## Lire les permissions

Lancez `ls -l` et regardez la première colonne :

```text
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
```

Le premier caractère indique le type : `-` pour un fichier, `d` pour un
répertoire. Viennent ensuite trois groupes de trois caractères chacun :

```text
-     rw-            r--     r--
type  propriétaire   groupe  autres
```

| Caractère | Pour un fichier | Pour un répertoire |
|---|---|---|
| `r` (read) | Lire le contenu | Lister le contenu |
| `w` (write) | Modifier le contenu | Créer et supprimer des fichiers dedans |
| `x` (execute) | Exécuter le fichier comme un programme | Entrer dans le répertoire avec `cd` |

Après cela viennent le propriétaire (`elev`) et le groupe (`elev`).

```quiz
Un répertoire a les permissions `drwxr-x---`. Que peuvent faire les membres de son groupe ?
- [ ] Rien du tout
- [x] Lister le contenu et y entrer avec `cd`, mais pas y créer ni y supprimer de fichiers
- [ ] Tout ce que peut faire le propriétaire
---
Le groupe a `r-x` : `r` permet de lister le contenu et `x` d'entrer dans le
répertoire. Sans `w`, vous ne pouvez pas y créer ni y supprimer de fichiers.
```

## Modifier les permissions – `chmod`

Les permissions peuvent s'exprimer en **chiffres**. Chaque groupe reçoit un
chiffre qui est la somme de r = 4, w = 2 et x = 1 :

| Nombre | Permissions | Typique pour |
|---|---|---|
| `755` | `rwxr-xr-x` | Programmes et répertoires |
| `644` | `rw-r--r--` | Fichiers ordinaires |
| `600` | `rw-------` | Fichiers secrets |

```sh
chmod 644 anteckningar.txt
```

Ou avec des **symboles** : `u` (le propriétaire, *user*), `g` (le groupe),
`o` (les autres, *others*), `a` (tous, *all*), suivis de `+`, `-` ou `=` et des
permissions :

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

```predict
$ touch plan.txt
$ chmod 600 plan.txt
$ chmod g+r plan.txt
$ ls -l plan.txt | awk '{print $1}'
-rw-r-----
```

## Les scripts

Un **script** est un fichier texte qui contient des commandes. La première
ligne, `#!/bin/bash`, s'appelle le *shebang* et indique au système quel
programme doit exécuter le fichier :

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Date du jour :"; date' >> datum.sh
cat datum.sh
```

Pour lancer le script comme un programme, il doit être exécutable :

```sh
chmod +x datum.sh
./datum.sh
```

Le `./` est nécessaire parce que le répertoire où vous êtes ne fait pas
partie de `PATH`.

```quiz
Vous avez écrit le script `test.sh` et lancé `./test.sh`, mais vous obtenez
`Permission denied`. Que manque-t-il ?
- [ ] Un `sudo` devant
- [x] La permission d'exécution – lancez d'abord `chmod +x test.sh`
- [ ] Le `./` est en trop – il faudrait écrire `test.sh`
---
Pour exécuter un fichier comme un programme, il lui faut la permission `x`.
Le `./` est correct : sans lui, le shell ne cherche que dans les répertoires
de `PATH`.
```

## root et sudo

Certains fichiers, comme `/etc/shadow` où sont stockés les mots de passe, ne
peuvent être lus que par root. Avec `sudo` (*superuser do*), vous exécutez une
seule commande en tant que root :

```sh
sudo whoami
```

La première fois, `sudo` demande **votre propre** mot de passe. Seuls les
utilisateurs du groupe des administrateurs peuvent utiliser sudo. Sur
Ubuntu, ce groupe s'appelle **sudo** – vous le voyez parmi vos groupes quand
vous lancez `id`. D'autres distributions appellent plutôt ce groupe `wheel` ;
vous en lirez plus sur les différences entre distributions dans la partie
consacrée aux distributions.

Si vous devez lancer beaucoup de commandes en tant que root, vous pouvez
ouvrir un shell root avec `sudo -i`. L'invite se transforme alors en `#`.
Revenez avec `exit`.

> **À retenir !** Avec sudo, il n'y a pas de filet de sécurité. Ne lancez que
> des commandes que vous comprenez.

```quiz
`sudo` demande un mot de passe. Lequel devez-vous taper ?
- [ ] Le mot de passe de root
- [x] Votre propre mot de passe
- [ ] Aucun mot de passe – appuyez simplement sur Entrée
---
`sudo` demande **votre propre** mot de passe, et ne vous laisse passer que si
vous êtes dans le groupe des administrateurs.
```

### Un piège classique

```text
sudo echo "texte" > /etc/fichier     # ne fonctionne PAS
```

C'est *votre* shell – et non sudo – qui ouvre le fichier pour `>`. Utilisez
plutôt `tee`, qui s'exécute avec sudo :

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```

```quiz
Pourquoi `sudo echo "text" > /etc/file` ne fonctionne-t-il pas ?
- [ ] `echo` ne peut pas être lancé avec sudo
- [x] C'est votre propre shell qui ouvre le fichier pour `>`, et il ne tourne pas en tant que root
- [ ] Les fichiers de `/etc` ne peuvent jamais être modifiés
---
sudo ne s'applique qu'à la commande (`echo`). La redirection est gérée par
votre shell, qui tourne sous votre nom. C'est `tee` qui écrit le fichier,
donc c'est `tee` qui a besoin de sudo.
```
