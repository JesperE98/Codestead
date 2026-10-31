# Services et journaux avec systemd

Un ordinateur Linux fait sans cesse des choses que personne ne lance à la
main : il accepte les connexions SSH, garde l'horloge à l'heure, exécute des
tâches planifiées et écrit des journaux. Les programmes qui s'en chargent
s'appellent des **services**, et sur presque toutes les distributions
modernes, c'est **systemd** qui les tient en ordre. Dans ce chapitre, vous
apprendrez à démarrer et arrêter des services, à les faire démarrer au boot
et – le plus important de tout – à lire les journaux quand quelque chose ne
va pas.

## init et systemd

Une fois que le noyau Linux a démarré, il lance un seul programme : **init**,
le processus numéro 1. C'est ensuite init qui démarre tout le reste.
Aujourd'hui, init est presque toujours **systemd** – sur Debian, Ubuntu, Arch
comme Fedora. Jetez un œil :

```sh
ps -p 1
```

Le processus s'appelle `/sbin/init`, mais ce n'est qu'un lien vers le
programme `systemd`.

systemd ne se contente pas de démarrer des services. Il vérifie qu'ils sont
toujours en vie, les redémarre s'ils plantent (si vous le souhaitez),
rassemble tout ce qu'ils affichent dans un registre commun – le **journal** –
et fournit des outils pour la plupart des parties du système :

| Outil | Fait |
|---|---|
| `systemctl` | Pilote les services : état, démarrage, arrêt, boot |
| `journalctl` | Lit le journal |
| `hostnamectl` | Affiche et modifie le nom de l'ordinateur |
| `systemd-analyze` | Affiche la durée du démarrage |

## Units et services

Tout ce que systemd surveille s'appelle une **unit** (unité). Il en existe
plusieurs sortes, et la sorte se voit au suffixe : `.service` (un service),
`.timer` (une tâche planifiée), `.socket`, `.mount`, `.target` (un groupe
d'units, un peu comme un « niveau » du démarrage) et d'autres encore. Ce
chapitre parle des services.

Chaque unit est décrite par un **fichier d'unit** (*unit file*), un petit
fichier texte. Ils se trouvent à deux endroits :

| Répertoire | Contenu |
|---|---|
| `/usr/lib/systemd/system/` | Les fichiers d'unit fournis par les paquets. Ne les modifiez pas ici ! |
| `/etc/systemd/system/` | Les fichiers d'unit de l'administrateur. Ils ont la priorité. |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

Les anciennes versions de Debian et d'Ubuntu indiquent souvent
`/lib/systemd/system` à la place. C'est le même répertoire – `/lib` est un
lien vers `/usr/lib`.

Le nom d'un service est le nom du fichier, par exemple `myserver.service`.
Quand vous tapez des commandes, vous pouvez omettre `.service` : `systemctl
status myserver` fonctionne tout aussi bien.

## Comment va le service ? – `systemctl status`

La commande que vous utiliserez le plus est `systemctl status` :

```sh
systemctl status ssh
```

Sur Ubuntu, le serveur SSH s'appelle `ssh`. La sortie ressemble à peu près à
ceci :

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

Ligne par ligne :

| Ligne | Signifie |
|---|---|
| `●` | Point vert = en marche. `×` rouge = a échoué. `○` blanc = arrêté. |
| `Loaded` | Où se trouve le fichier d'unit, si le service démarre au boot (`enabled`/`disabled`/`static`) et le réglage par défaut de la distribution (`preset`) |
| `Active` | La ligne la plus importante : `active (running)`, `inactive (dead)` ou `failed` – et depuis quand |
| `Docs` | Où en lire davantage (`man sshd`) |
| `Main PID` | Le processus principal du service – le même PID que dans `ps aux` |
| `Memory`, `CGroup` | La mémoire qu'il utilise et les processus qui lui appartiennent |
| Dernières lignes | Les lignes les plus récentes du journal du service |

`static` signifie que le service ne peut pas être activé tout seul – il est
démarré quand une autre unit en a besoin.

> **Astuce :** dans un vrai terminal, les sorties longues s'affichent dans un
> pager (`less`). Appuyez sur `q` pour revenir. Ajoutez `--no-pager` si vous
> préférez vous en passer.

## Démarrer, arrêter et redémarrer

```text
sudo systemctl start myserver      # démarrer maintenant
sudo systemctl stop myserver       # arrêter maintenant
sudo systemctl restart myserver    # arrêter puis redémarrer
sudo systemctl reload myserver     # lui demander de relire sa configuration
```

Tout ce qui **modifie** quelque chose nécessite les droits root, alors
n'oubliez pas `sudo`. Sans lui, systemctl répond :

```text
Failed to start myserver.service: Interactive authentication required.
```

`reload` ne fonctionne qu'avec les services qui le prennent en charge.
L'avantage, c'est que le service continue de tourner pendant ce temps – aucune
connexion n'est coupée. Quand vous avez modifié le fichier de configuration
d'un service, `reload` ou `restart` est la dernière étape.

> **Essayez !** Dans le chapitre sur les processus, vous avez arrêté le
> serveur d'exercice avec `pkill`. Regardez `systemctl status myserver` –
> systemd a remarqué que le processus a disparu. Relancez-le avec
> `systemctl` et comparez le PID avec `pgrep -l myserver`.

## Maintenant ou au démarrage ? `start` et `enable`

C'est le malentendu le plus courant à propos de systemd : **`start` et
`enable` sont deux choses différentes.**

| Commande | Fait |
|---|---|
| `systemctl start X` | Démarre le service **maintenant**. Après un redémarrage, il a de nouveau disparu. |
| `systemctl enable X` | Démarre le service automatiquement **au boot** – mais pas maintenant. |
| `systemctl enable --now X` | Les deux à la fois. |
| `systemctl disable X` | Ne pas démarrer au boot (`--now` l'arrête aussi). |

`enable` crée un lien dans un répertoire nommé d'après la target indiquée
dans la section `[Install]` du fichier d'unit, en général
`multi-user.target.wants` :

```text
$ sudo systemctl enable --now myserver
Created symlink /etc/systemd/system/multi-user.target.wants/myserver.service → /etc/systemd/system/myserver.service.
```

Quand l'ordinateur démarre, systemd parcourt ce répertoire et démarre tout ce
qui s'y trouve. Vous pouvez interroger l'état :

```sh
systemctl is-active myserver
systemctl is-enabled myserver
```

`is-active` et `is-enabled` sont parfaits dans les scripts – ils affichent un
seul mot et se terminent avec le code de retour 0 si la réponse est « oui ».
Avec `-q`, ils sont complètement silencieux :

```text
if systemctl is-active -q myserver; then echo "the server is running"; fi
```

Sur un ordinateur fraîchement démarré dans le simulateur, `myserver` tourne,
mais personne ne l'a activé. Qu'affichent ces deux commandes ?

```predict
$ systemctl is-active myserver
$ systemctl is-enabled myserver
active
disabled
---
myserver tourne **maintenant**, mais personne n'a lancé `enable` – après un
redémarrage, il ne serait pas démarré. `start` et `enable` sont vraiment deux
choses différentes.
```

## Lister les services

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` affiche les services en cours d'exécution (ou qui ont échoué).
  Avec `--all`, les services arrêtés sont inclus aussi.
- `--failed` n'affiche que ceux qui ont échoué. Une bonne première commande
  quand quelque chose semble clocher !
- `list-unit-files` affiche tous les fichiers d'unit installés et indique
  s'ils sont `enabled`, `disabled` ou `static`.

## Le journal – `journalctl`

Tout ce qu'affichent les services, le noyau et systemd lui-même atterrit dans
le journal. Sans option, vous obtenez le journal entier, le plus ancien en
premier :

```sh
journalctl
```

Cela fait vite beaucoup, alors on filtre presque toujours :

| Commande | Affiche |
|---|---|
| `journalctl -u ssh` | Un seul service (`-u` comme *unit*) |
| `journalctl -n 20` | Les 20 lignes les plus récentes |
| `journalctl -f` | Les dernières lignes, puis les nouvelles au fur et à mesure (quittez avec Ctrl+C) |
| `journalctl -b` | Uniquement ce démarrage (`-b -1` = le précédent) |
| `journalctl --since today` | Depuis minuit. Aussi `yesterday`, `"10:00"`, `"1 hour ago"` |
| `journalctl -p err` | Uniquement les erreurs et pire |
| `journalctl -xe` | Saute à la fin et ajoute des explications |
| `journalctl -k` | Uniquement les messages du noyau (comme `dmesg`) |

Les options peuvent se combiner. Quelques classiques :

```sh
journalctl -u myserver -n 5
journalctl -p err -b
journalctl --since today -u myserver
```

### Les priorités

Chaque ligne du journal a une **priorité**. `-p` affiche celle que vous
choisissez *et toutes les plus graves* :

| Numéro | Nom | Signifie |
|---|---|---|
| 0 | `emerg` | Le système est inutilisable |
| 1 | `alert` | Doit être corrigé immédiatement |
| 2 | `crit` | Erreur critique |
| 3 | `err` | Erreur – affichée en rouge |
| 4 | `warning` | Avertissement – affiché en jaune |
| 5 | `notice` | Normal, mais digne d'intérêt |
| 6 | `info` | Information |
| 7 | `debug` | Information de débogage |

Ne vous inquiétez pas si `journalctl -p err` affiche quelques erreurs du noyau
comme `ACPI BIOS Error`. On en trouve sur presque tous les ordinateurs et
elles sont généralement sans gravité – des bugs dans le firmware de
l'ordinateur que le noyau contourne.

Normalement, il faut être root, ou membre d'un groupe autorisé à lire le
journal (`adm` ou `systemd-journal` sur Ubuntu – les autres familles
utilisent d'autres groupes), pour tout voir. Votre utilisateur dans le
simulateur a le droit de lire tout le journal.

```quiz
Quelles priorités `journalctl -p warning` affiche-t-il ?
- [x] `err`
- [x] `warning`
- [x] `crit`
- [ ] `notice`
- [ ] `info`
---
`-p` affiche la priorité que vous choisissez *et tout ce qui est plus grave*
– c'est-à-dire tout ce qui a un numéro égal ou inférieur (`warning` vaut 4).
```

## Dépanner un service qui refuse de démarrer

Quelqu'un a mis en place le service **reportd** sur cet ordinateur, mais
quelque chose ne va pas. Voici la démarche habituelle :

1. **Qu'est-ce qui a échoué ?** Listez les services en échec :

   ```sh
   systemctl --failed
   ```

2. **Regardez l'état.** Les dernières lignes suffisent souvent :

   ```sh
   systemctl status reportd
   ```

3. **Lisez tout le journal** du service. Il vous dit presque toujours ce qui
   ne va pas – lisez-le attentivement, mot à mot :

   ```sh
   journalctl -xeu reportd
   ```

   `systemctl` suggère d'ailleurs lui-même exactement cette commande quand un
   démarrage échoue : `See "systemctl status reportd.service" and
   "journalctl -xeu reportd.service" for details.`

4. **Corrigez le problème**, par exemple un fichier de configuration
   manquant ou contenant une faute de frappe.

5. **Redémarrez et vérifiez :**

   ```text
   sudo systemctl restart reportd
   systemctl status reportd
   ```

La ligne `Main process exited, code=exited, status=1/FAILURE` signifie que le
programme s'est terminé de lui-même avec une erreur. Si elle indique
`status=203/EXEC`, systemd n'a pas du tout trouvé le programme – vérifiez le
chemin dans `ExecStart=`.

```quiz
Un service refuse de démarrer, et le journal indique `status=203/EXEC`. Où
regardez-vous en premier ?
- [ ] Dans `/etc/fstab`
- [x] Le chemin dans `ExecStart=` du fichier d'unit
- [ ] La priorité, avec `journalctl -p err`
- [ ] Nulle part – cela signifie que le programme s'est terminé de lui-même avec une erreur
---
203/EXEC signifie que systemd n'a pas du tout trouvé le programme. Un
programme qui démarre puis se termine avec une erreur donne plutôt
`status=1/FAILURE`.
```

## Le fichier d'unit – `systemctl cat`

Pour voir exactement comment un service est démarré, lisez son fichier
d'unit :

```sh
systemctl cat myserver
```

```text
# /etc/systemd/system/myserver.service
[Unit]
Description=Myserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/myserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| Section | Contenu |
|---|---|
| `[Unit]` | Description et ordre : `After=network.target` = démarrer après le réseau |
| `[Service]` | Comment le programme tourne : `ExecStart=` (la commande), `User=`, `Restart=on-failure` … |
| `[Install]` | Ce que `enable` doit faire : `WantedBy=multi-user.target` |

Si vous modifiez un fichier d'unit, systemd doit le recharger pour que la
modification prenne effet – sinon vous obtenez un avertissement dans
`systemctl status` :

```text
sudo systemctl daemon-reload
```

Ne modifiez jamais les fichiers de `/usr/lib/systemd/system` – ils sont
écrasés à la prochaine mise à jour du paquet. Placez plutôt votre propre
version dans `/etc/systemd/system`.

```quiz
Vous voulez changer la façon dont démarre un service fourni par un paquet.
Quelle est la bonne méthode ?
- [ ] Modifier son fichier dans `/usr/lib/systemd/system` et redémarrer le service
- [x] Placer votre propre version dans `/etc/systemd/system`, lancer `sudo systemctl daemon-reload` et redémarrer le service
- [ ] Placer votre propre version dans `/etc/systemd/system` – systemd remarque le changement tout seul
- [ ] Modifier le fichier dans `/usr/lib/systemd/system` et lancer `sudo systemctl enable` dessus
---
Les fichiers de `/etc/systemd/system` ont la priorité, et ils ne sont pas
écrasés lors de la mise à jour du paquet. `daemon-reload` fait relire à
systemd le fichier d'unit modifié.
```

## Comment s'appellent les services ?

systemd fonctionne de la même façon partout, mais **les services ne portent
pas toujours le même nom** – cela dépend du nom des paquets et des programmes
que la distribution a choisis. Sur Ubuntu :

| Service | Nom sur Ubuntu |
|---|---|
| Serveur SSH | `ssh` (alias `sshd`) |
| Tâches planifiées (cron) | `cron` |
| Réseau | `NetworkManager` |
| Pare-feu | `ufw` (s'il est installé) |
| Horloge | `systemd-timesyncd` |

Le service SSH s'appelle en réalité `ssh.service`. Il a l'alias
`sshd.service`, donc `systemctl status sshd` fonctionne aussi – mais la sortie
affiche le vrai nom. Les autres familles peuvent nommer les mêmes services
autrement (sous Arch et Fedora, le service SSH s'appelle `sshd`) – la partie
consacrée aux distributions et aux paquets traite de ce genre de différences.

Vous ne savez pas comment s'appelle quelque chose ? Cherchez dans la liste :

```sh
systemctl list-unit-files | grep ssh
```

```try
systemctl list-unit-files | grep ssh
---
`ssh.service` est le vrai fichier d'unit, et `sshd.service` est listé comme
`alias` de celui-ci.
```

## Redémarrer l'ordinateur

`enable` ne montre son effet qu'au redémarrage de l'ordinateur. Vous pouvez
l'essayer dans le simulateur – il redémarre en un instant :

```text
sudo systemctl reboot
```

Après le redémarrage, seuls les services activés tournent. Avec `journalctl -b
-1`, vous voyez le journal du démarrage précédent (et comment tout a été
arrêté), et `journalctl --list-boots` affiche tous les démarrages présents
dans le journal.

## Encore plus de systemd

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

`hostnamectl` affiche le nom de l'ordinateur, le système d'exploitation et le
noyau (et le renomme avec `sudo hostnamectl set-hostname NOUVEAUNOM`).
`systemd-analyze` affiche la durée du démarrage, et `blame` les services qui
ont pris le plus de temps – parfait quand l'ordinateur démarre lentement.
