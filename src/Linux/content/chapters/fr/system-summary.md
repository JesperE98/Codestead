# Résumé : Le système

Dans cette partie, vous avez regardé ce qui se passe autour de vos
commandes : la mémoire du shell, qui a le droit de faire quoi, quels
programmes tournent et comment des fichiers sont regroupés.

## Variables, PATH et alias

On lit une variable avec `$NOM` et on en crée une avec `NOM=valeur` – sans
espaces autour du `=`. `export` en fait une variable d'environnement, que les
programmes que vous lancez peuvent lire aussi. Entre guillemets doubles, les
variables sont remplacées par leur valeur ; entre guillemets simples, tout
est affiché exactement tel quel. Le shell cherche les commandes dans les
répertoires de `PATH`, et `$?` contient le code de retour de la dernière
commande : `0` signifie que tout s'est bien passé. Les alias et les
variables disparaissent quand vous fermez le terminal, sauf si vous les
mettez dans `~/.bashrc`.

## Utilisateurs, permissions et sudo

Chaque fichier a un propriétaire, un groupe et trois jeux de permissions –
pour le propriétaire, le groupe et les autres. `r` = 4, `w` = 2 et `x` = 1,
donc `755` donne `rwxr-xr-x` et `600` donne `rw-------`. Un script a besoin
de la permission `x` et se lance avec `./`, car le répertoire où vous êtes ne
fait pas partie de `PATH`. `sudo` lance une seule commande en root et demande
votre propre mot de passe. Sur Ubuntu, les utilisateurs du groupe `sudo` ont
le droit de l'utiliser.

## Liens et informations sur les fichiers

Le contenu et les permissions d'un fichier se trouvent dans un **inode**, et
les noms d'un répertoire pointent vers des inodes. `ln -s` crée un **lien
symbolique**, un petit fichier contenant un chemin, qui se casse si la cible
disparaît ; un chemin relatif dans ce lien part du répertoire du lien
lui-même. `ln` sans `-s` crée un **lien physique**, un nom de plus pour le même
inode. `stat` montre tout sur un fichier, `file` dit ce qu'il contient, quel
que soit son nom, et le **umask** décide des permissions des nouveaux
fichiers : avec `022`, ils reçoivent `644`, avec `077` seulement `600`.

## Processus et jobs

Chaque programme en cours d'exécution est un processus avec un PID et un
parent (PPID). `ps aux` les montre tous, et `top` les montre en direct, triés
par utilisation du processeur. `kill` envoie un signal : `SIGTERM` (15) par
défaut, et `SIGKILL` (9) en dernier recours. Avec `&`, une commande tourne en
arrière-plan, et `jobs`, `fg` et `bg` vous permettent de gérer les jobs de
votre terminal. `nohup` garde une commande en vie après votre déconnexion, et
`watch` relance une commande encore et encore.

## Archives et compression

`tar` rassemble des fichiers dans une archive et `gzip` rend un fichier
unique plus petit – ensemble, ils donnent un `.tar.gz`. Exactement une des
lettres `c`, `x` et `t` indique à tar quoi faire, et `f` est suivi du nom de
l'archive. `zcat` lit un fichier `.gz` sans le décompresser, et `zip -r` /
`unzip` gèrent les fichiers zip, faciles à partager avec Windows et macOS.

## Commandes et options

| Commande | Fait |
|---|---|
| `echo $NAME` | Afficher la valeur d'une variable |
| `export NAME=value` | Créer une variable d'environnement |
| `env` | Lister toutes les variables d'environnement |
| `which ls` · `type cd` | Montrer où se trouve un programme · ce qu'est un nom |
| `echo $?` | Afficher le code de retour de la commande précédente |
| `alias ll='ls -la'` · `unalias ll` | Créer · supprimer un alias |
| `source ~/.bashrc` | Charger `~/.bashrc` tout de suite |
| `id` · `groups` | Afficher votre utilisateur et vos groupes |
| `ls -l` | Afficher les permissions, le propriétaire et le groupe |
| `chmod 644 file` · `chmod u+x file` | Changer les permissions avec des chiffres · des symboles |
| `sudo command` · `sudo -i` | Lancer une commande en root · ouvrir un shell root |
| `sudo tee -a file` | En bout de pipe : ajouter du texte à un fichier que seul root peut modifier |
| `ln -s target name` · `ln file name` | Créer un lien symbolique · physique |
| `readlink link` · `realpath path` | Vers où pointe un lien · le chemin complet sans liens |
| `ls -li` | Afficher les numéros d'inode et les compteurs de liens |
| `stat file` · `stat -c '%a %U' file` | Tout sur un fichier · seulement ce que vous demandez |
| `file file` | Ce que contient un fichier |
| `umask` · `umask 077` | Afficher · définir les permissions que perdent les nouveaux fichiers |
| `ps` · `ps aux` · `ps -ef` | Vos processus · tous les processus · avec le PID du parent |
| `ps aux --sort=-%cpu` | Tous les processus, les plus gourmands d'abord |
| `pgrep -l name` | Trouver le PID d'un processus par son nom |
| `top` | Une vue en direct des processus |
| `kill PID` · `kill -9 PID` | Demander à un processus de se terminer · le forcer |
| `pkill pattern` · `killall name` | Arrêter des processus par leur nom |
| `command &` | Lancer une commande en arrière-plan |
| `jobs` · `fg %1` · `bg %1` · `kill %1` | Lister · premier plan · arrière-plan · terminer un job |
| `nohup command &` | Continuer à tourner après la déconnexion |
| `watch -n 5 command` | Lancer une commande toutes les cinq secondes |
| `uptime` · `free -h` | Charge · mémoire |
| `tar -czvf archive.tar.gz dir` | Empaqueter et compresser un répertoire |
| `tar -tzvf archive.tar.gz` | Lister le contenu d'une archive |
| `tar -xzvf archive.tar.gz -C dir` | Décompresser une archive dans un répertoire |
| `gzip file` · `gzip -k file` · `gunzip file.gz` | Compresser · garder l'original · décompresser |
| `zcat file.gz` | Lire directement un fichier compressé |
| `zip -r archive.zip dir` · `unzip archive.zip -d dir` | Créer · décompresser un fichier zip |
| `du -sh dir` | Montrer la place qu'occupe quelque chose |
