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

:::debian
Les anciennes versions de Debian et d'Ubuntu indiquent souvent
`/lib/systemd/system` à la place. C'est le même répertoire – `/lib` est un
lien vers `/usr/lib`.
:::

Le nom d'un service est le nom du fichier, par exemple `minserver.service`.
Quand vous tapez des commandes, vous pouvez omettre `.service` : `systemctl
status minserver` fonctionne tout aussi bien.

## Comment va le service ? – `systemctl status`

La commande que vous utiliserez le plus est `systemctl status` :

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

La sortie ressemble à peu près à ceci :

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
sudo systemctl start minserver      # démarrer maintenant
sudo systemctl stop minserver       # arrêter maintenant
sudo systemctl restart minserver    # arrêter puis redémarrer
sudo systemctl reload minserver     # lui demander de relire sa configuration
```

Tout ce qui **modifie** quelque chose nécessite les droits root, alors
n'oubliez pas `sudo`. Sans lui, systemctl répond :

```text
Failed to start minserver.service: Interactive authentication required.
```

`reload` ne fonctionne qu'avec les services qui le prennent en charge.
L'avantage, c'est que le service continue de tourner pendant ce temps – aucune
connexion n'est coupée. Quand vous avez modifié le fichier de configuration
d'un service, `reload` ou `restart` est la dernière étape.

> **Essayez !** Dans le chapitre sur les processus, vous avez arrêté le
> serveur d'exercice avec `pkill`. Regardez `systemctl status minserver` –
> systemd a remarqué que le processus a disparu. Relancez-le avec
> `systemctl` et comparez le PID avec `pgrep -l minserver`.

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
$ sudo systemctl enable --now minserver
Created symlink /etc/systemd/system/multi-user.target.wants/minserver.service → /etc/systemd/system/minserver.service.
```

Quand l'ordinateur démarre, systemd parcourt ce répertoire et démarre tout ce
qui s'y trouve. Vous pouvez interroger l'état :

```sh
systemctl is-active minserver
systemctl is-enabled minserver
```

`is-active` et `is-enabled` sont parfaits dans les scripts – ils affichent un
seul mot et se terminent avec le code de retour 0 si la réponse est « oui ».
Avec `-q`, ils sont complètement silencieux :

```text
if systemctl is-active -q minserver; then echo "the server is running"; fi
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
journalctl -u minserver -n 5
journalctl -p err -b
journalctl --since today -u minserver
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
journal (`adm` ou `systemd-journal` sur Debian et Ubuntu, `wheel` sur Arch et
Fedora), pour tout voir. Votre utilisateur dans le simulateur a le droit de
lire tout le journal.

## Dépanner un service qui refuse de démarrer

Quelqu'un a mis en place le service **rapportd** sur cet ordinateur, mais
quelque chose ne va pas. Voici la démarche habituelle :

1. **Qu'est-ce qui a échoué ?** Listez les services en échec :

   ```sh
   systemctl --failed
   ```

2. **Regardez l'état.** Les dernières lignes suffisent souvent :

   ```sh
   systemctl status rapportd
   ```

3. **Lisez tout le journal** du service. Il vous dit presque toujours ce qui
   ne va pas – lisez-le attentivement, mot à mot :

   ```sh
   journalctl -xeu rapportd
   ```

   `systemctl` suggère d'ailleurs lui-même exactement cette commande quand un
   démarrage échoue : `See "systemctl status rapportd.service" and
   "journalctl -xeu rapportd.service" for details.`

4. **Corrigez le problème**, par exemple un fichier de configuration
   manquant ou contenant une faute de frappe.

5. **Redémarrez et vérifiez :**

   ```text
   sudo systemctl restart rapportd
   systemctl status rapportd
   ```

La ligne `Main process exited, code=exited, status=1/FAILURE` signifie que le
programme s'est terminé de lui-même avec une erreur. Si elle indique
`status=203/EXEC`, systemd n'a pas du tout trouvé le programme – vérifiez le
chemin dans `ExecStart=`.

## Le fichier d'unit – `systemctl cat`

Pour voir exactement comment un service est démarré, lisez son fichier
d'unit :

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

## Des noms différents selon les familles

systemd fonctionne de la même façon partout, mais **les services ne portent
pas toujours le même nom**. Cela dépend du nom des paquets et des programmes
que la distribution a choisis :

| Service | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Serveur SSH | `ssh` (alias `sshd`) | `sshd` | `sshd` |
| Tâches planifiées (cron) | `cron` | `cronie` (pas installé par défaut) | `crond` |
| Réseau | `NetworkManager` (Ubuntu), `networking` (Debian) | `systemd-networkd` | `NetworkManager` |
| Pare-feu | `ufw` (s'il est installé) | – | `firewalld` |
| Horloge | `systemd-timesyncd` | `systemd-timesyncd` | `chronyd` |

:::debian
Sur {{distro}}, le service SSH s'appelle `ssh.service`. Il a l'alias
`sshd.service`, donc `systemctl status sshd` fonctionne aussi – mais la sortie
affiche le vrai nom.
:::

:::arch
Arch n'installe presque aucun service par défaut – c'est vous qui choisissez.
Aucun service cron ne tourne, par exemple ; Arch utilise plutôt les **timers**
de systemd. Si vous voulez cron, installez le paquet `cronie` et lancez `sudo
systemctl enable --now cronie`. Gardez aussi en tête qu'Arch a `preset:
disabled` : les nouveaux services ne sont jamais activés automatiquement quand
vous les installez.
:::

:::redhat
Fedora fait tourner `firewalld` dès le départ, et la synchronisation de
l'heure est assurée par `chronyd`. Fedora utilise aussi `preset: disabled`
pour la plupart des services : quand vous installez un nouveau service (un
serveur web, par exemple), vous devez lancer vous-même `sudo systemctl enable
--now …`.
:::

Vous ne savez pas comment s'appelle quelque chose ? Cherchez dans la liste :

```sh
systemctl list-unit-files | grep ssh
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
