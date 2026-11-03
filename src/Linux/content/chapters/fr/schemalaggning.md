# Tâches planifiées avec cron

Une sauvegarde chaque nuit, le ménage dans les vieux logs chaque semaine, la
récupération de données toutes les cinq minutes – l'ordinateur peut lancer des
commandes tout seul à heures fixes. L'outil classique pour cela est **cron**,
et systemd a ses propres **timers**.

## cron et crontab

Le service cron se réveille chaque minute et lance les tâches dont l'heure est
venue. Chaque utilisateur a sa propre liste de tâches, une **crontab** :

```sh
crontab -l
```

*no crontab for {{user}}* signifie que vous n'avez encore aucune tâche.

## Les cinq champs de temps

Chaque ligne d'une crontab a cinq champs de temps, puis la commande :

```text
┌───────────── minute (0–59)
│ ┌─────────── heure (0–23)
│ │ ┌───────── jour du mois (1–31)
│ │ │ ┌─────── mois (1–12)
│ │ │ │ ┌───── jour de la semaine (0–7, dimanche vaut 0 ou 7)
│ │ │ │ │
* * * * *  commande
```

| Vous écrivez | Signifie |
|---|---|
| `*` | Chaque |
| `5` | Exactement 5 |
| `1-5` | De 1 à 5 |
| `1,15` | 1 et 15 |
| `*/10` | Tous les dix : 0, 10, 20 … |

| Ligne | S'exécute |
|---|---|
| `* * * * * command` | Chaque minute |
| `*/5 * * * * command` | Toutes les cinq minutes |
| `30 2 * * * command` | À 02:30 chaque nuit |
| `0 7 * * 1-5 command` | À 07:00 du lundi au vendredi |
| `0 0 1 * * command` | À minuit le premier de chaque mois |
| `@reboot command` | Une fois, au démarrage de l'ordinateur |

`@hourly`, `@daily`, `@weekly` et `@monthly` sont aussi des raccourcis.

```quiz
Quand la tâche `15 8 * * 6 ~/backup.sh` s'exécute-t-elle ?
- [ ] À 15:08 tous les jours
- [x] À 08:15 tous les samedis
- [ ] Le 15 de chaque mois à 08:00
---
L'ordre est minute, heure, jour du mois, mois et jour de la semaine :
minute 15, heure 8, n'importe quelle date, n'importe quel mois, jour 6 – samedi.
```

```quiz
À quelle fréquence `0 */2 * * * command` s'exécute-t-elle ?
- [ ] Toutes les deux minutes
- [x] Toutes les deux heures, à l'heure pile
- [ ] Deux fois par jour
---
Minute 0 et une heure sur deux : 00:00, 02:00, 04:00 …
```

## Installer des tâches

`crontab -e` ouvre votre crontab dans un éditeur de texte et l'installe quand
vous enregistrez. Le simulateur n'a pas encore d'éditeur, alors ici vous
donnez les tâches à `crontab` sur son entrée – `-` signifie « lire depuis
l'entrée » :

```sh
echo '* * * * * date >> ~/cron.log' | crontab -
crontab -l
```

Attention : `crontab -` et `crontab FILE` **remplacent** toute la crontab. Pour
ajouter une tâche, combinez les anciennes tâches avec la nouvelle :

```sh
(crontab -l; echo '30 2 * * * ~/backup.sh') | crontab -
```

Pour supprimer une ligne, filtrez-la avec `grep -v` et installez le reste – ou
supprimez tout avec `crontab -r` :

```sh
crontab -l | grep -v backup.sh | crontab -
```

`crontab` vérifie les lignes avant d'installer quoi que ce soit :

```predict
$ echo '0 25 * * * date' | crontab -
"-":1: bad hour
errors in crontab file, can't install.
---
Il n'y a pas d'heure 25 – les heures vont de 0 à 23. Rien n'a été installé.
```

## La regarder tourner

Une fois installée la tâche qui s'exécute chaque minute, attendez une minute
et regardez :

```sh
cat ~/cron.log
journalctl -u cron
```

Chaque exécution est écrite dans le journal, par exemple
`CRON[4211]: ({{user}}) CMD (date >> ~/cron.log)`. Dans le simulateur, cron ne
tourne que tant que l'application est ouverte – comme un vrai ordinateur, il
ne rattrape pas les tâches manquées pendant qu'il était éteint.

## Le piège de cron : un autre environnement

Les tâches ne s'exécutent pas dans votre terminal, et cela surprend presque
tout le monde :

- Elles s'exécutent avec `/bin/sh`, sans vos alias ni votre `~/.bashrc`.
- `PATH` est court (`/usr/bin:/bin`), donc les programmes situés ailleurs
  doivent être appelés avec leur chemin complet.
- Elles démarrent dans votre répertoire personnel.
- La sortie qui n'est pas envoyée dans un fichier est perdue. Terminez
  toujours la ligne par, par exemple, `>> ~/job.log 2>&1`.

Lancez d'abord la commande à la main. Quand elle fonctionne, mettez-la dans la
crontab.

```quiz
La tâche `* * * * * echo hi` s'exécute chaque minute, mais vous ne voyez `hi`
nulle part. Pourquoi ?
- [ ] cron n'autorise pas `echo`
- [x] La sortie n'a nulle part où aller – envoyez-la dans un fichier avec `>>`
- [ ] Les tâches ne s'exécutent qu'en root
---
La sortie des tâches cron ne s'affiche dans aucun terminal. Le vrai cron essaie
de l'envoyer par e-mail, et la plupart des ordinateurs n'ont pas de messagerie
– elle est donc perdue.
```

## Les tâches du système

En plus des crontabs des utilisateurs, il existe `/etc/crontab` et des
répertoires comme `/etc/cron.daily` et `/etc/cron.weekly`. Les scripts qu'ils
contiennent sont lancés une fois par jour ou une fois par semaine :

```sh
cat /etc/crontab
ls /etc/cron.daily
```

Les lignes de `/etc/crontab` ont un champ de plus avant la commande :
l'utilisateur sous lequel la tâche s'exécute.

## Les timers systemd

Sur les distributions modernes, une grande partie de ce travail est faite
plutôt par des **timers** systemd : une unit `.timer` qui démarre une unit
`.service` à heures fixes. Ils écrivent dans le journal et peuvent rattraper
les exécutions manquées, mais chaque tâche a besoin de deux fichiers d'unit.
Pour vos propres petites tâches, cron est le moyen le plus rapide. Listez les
timers de l'ordinateur, avec la prochaine et la précédente exécution :

```try
systemctl list-timers
```

## Sur d'autres distributions

| | Ubuntu et Debian | Fedora | Arch |
|---|---|---|---|
| Paquet | `cron` | `cronie` | `cronie` |
| Service | `cron` | `crond` | `cronie` |
| Installé d'office | Oui | Oui | Non |

Sur Arch, vous commencez par `sudo pacman -S cronie` et
`sudo systemctl enable --now cronie`.
