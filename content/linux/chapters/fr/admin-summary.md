# Résumé : Administration système

Dans cette partie, vous vous êtes occupé de l'ordinateur en tant
qu'administrateur : les services qui tournent en arrière-plan, les disques
sur lesquels les fichiers atterrissent et les utilisateurs qui se partagent
l'ordinateur. Presque tout ce qui **modifie** quelque chose ici nécessite les
droits root – `sudo` est donc souvent revenu.

## Services et journaux avec systemd

**systemd** est le processus numéro 1 et démarre tout le reste. Tout ce qu'il
surveille est une **unit** (unité), décrite par un fichier d'unité – ceux qui
viennent avec les paquets sont dans `/usr/lib/systemd/system`, les vôtres dans
`/etc/systemd/system`, qui ont la priorité. `systemctl` pilote les services,
et **`start` (maintenant) et `enable` (au démarrage) sont deux choses
différentes**. Tout ce qu'affichent les services aboutit dans le **journal**,
que vous lisez et filtrez avec `journalctl`. Quand un service refuse de
démarrer : `systemctl --failed`, `systemctl status`, puis `journalctl -xeu` –
et lisez le journal mot à mot. Sur Ubuntu, le service SSH s'appelle `ssh` ;
d'autres familles nomment parfois les services autrement.

## Disques et systèmes de fichiers

Un **disque** est divisé en **partitions**, et chaque partition a besoin d'un
**système de fichiers** avant de pouvoir contenir des fichiers. Les disques
sont des fichiers dans `/dev` (`/dev/sda`, `/dev/sda1`, …). Linux n'a pas de
lettres de lecteur : chaque système de fichiers est **monté** quelque part
dans l'unique arborescence qui part de `/`. `lsblk` montre les disques, `df`
le taux de remplissage des systèmes de fichiers et `du` la place prise par
les fichiers. **Démontez** toujours une clé USB avant de la retirer, car des
modifications peuvent encore attendre en mémoire vive. Ce qui est monté au
démarrage est listé dans `/etc/fstab`, de préférence par **UUID**, qui ne
change jamais. `fdisk` et `mkfs` comptent parmi les commandes les plus
dangereuses qui soient – vérifiez deux fois.

## Utilisateurs et groupes

Chaque utilisateur a un **UID** – root a 0, les utilisateurs système ont de
petits numéros et les personnes commencent à 1000. Les utilisateurs sont
listés dans `/etc/passwd`, les groupes dans `/etc/group` et les empreintes
des mots de passe dans `/etc/shadow`, que seul root peut lire. Chaque
utilisateur a un **groupe principal** et autant de **groupes secondaires**
que l'on veut. `useradd -m -s /bin/bash` crée un utilisateur, `passwd` définit
le mot de passe et `usermod -aG` ajoute à un groupe – **n'oubliez pas le
`-a`**. Sur Ubuntu, les droits sudo viennent du groupe `sudo` (d'autres
familles utilisent `wheel`). `su -` change d'utilisateur avec le mot de passe
de cet utilisateur, `sudo -u` lance une seule commande en tant que quelqu'un
d'autre avec le vôtre.

## Commandes

| Commande | Fait |
|---|---|
| `systemctl status NAME` | Comment va le service ? |
| `sudo systemctl start` / `stop` / `restart` / `reload NAME` | Démarrer, arrêter, redémarrer, relire la configuration |
| `sudo systemctl enable --now NAME` | Démarrer au boot – et maintenant |
| `systemctl is-active` / `is-enabled NAME` | Un seul mot, code de retour 0 pour « oui » |
| `systemctl --failed` | Les services qui ont échoué |
| `systemctl cat NAME` | Afficher le fichier d'unité |
| `sudo systemctl daemon-reload` | Recharger les fichiers d'unité modifiés |
| `journalctl -u NAME` | Le journal d'un service |
| `journalctl -p err -b` | Les erreurs et pire depuis ce démarrage |
| `journalctl -n 20`, `-f`, `--since today` | Les dernières lignes, suivre, depuis minuit |
| `lsblk -f` | Disques, partitions et systèmes de fichiers |
| `blkid`, `findmnt -n -o UUID /` | Type, étiquette et UUID |
| `df -h`, `du -sh DIR` | Remplissage du disque, place prise par les fichiers |
| `sudo mount /dev/sdb1 /mnt/usb` | Monter un système de fichiers |
| `sudo umount /mnt/usb` | Démonter |
| `cat /etc/fstab`, `sudo mount -a` | Ce qui est monté au démarrage – et tester les modifications |
| `swapon --show`, `free -h` | Swap et mémoire |
| `id`, `groups` | UID, GID et groupes |
| `sudo useradd -m -s /bin/bash NAME` | Créer un utilisateur |
| `sudo passwd NAME` | Définir un mot de passe |
| `sudo groupadd GROUP` | Créer un groupe |
| `sudo usermod -aG GROUP NAME` | Ajouter à un groupe |
| `sudo usermod -L` / `-U NAME` | Verrouiller / déverrouiller un compte |
| `sudo userdel -r NAME` | Supprimer un utilisateur et son répertoire personnel |
| `su - NAME`, `sudo -u NAME COMMAND` | Changer d'utilisateur, lancer en tant qu'un autre utilisateur |
