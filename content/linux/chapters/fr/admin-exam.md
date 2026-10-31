# Examen : Administration système

Montrez ce que vous avez appris sur les services, les disques et les
utilisateurs. Les questions couvrent toute la partie, et il faut 80 % de
bonnes réponses pour réussir.

```quiz
`myserver` doit démarrer automatiquement à chaque démarrage de l'ordinateur,
mais il ne doit **pas** être lancé tout de suite. Quelle commande fait
exactement cela ?
- [ ] `sudo systemctl start myserver`
- [x] `sudo systemctl enable myserver`
- [ ] `sudo systemctl enable --now myserver`
- [ ] `sudo systemctl restart myserver`
---
`enable` s'applique au démarrage, `start` s'applique maintenant, et `--now`
fait les deux.
```

Le service `reportd` de cet ordinateur n'a pas réussi à démarrer.
Qu'affiche cette commande ?

```predict
$ systemctl is-active reportd
failed
---
`is-active` n'affiche qu'un seul mot – ici le même état que celui listé par
`systemctl --failed`. Le code de retour ne vaut 0 que si la réponse est
`active`.
```

```quiz
Vous voulez surveiller le journal de `myserver` pendant que vous le testez,
avec les nouvelles lignes qui apparaissent au fur et à mesure. Quelle
commande utilisez-vous ?
- [ ] `journalctl -n 20`
- [x] `journalctl -u myserver -f`
- [ ] `journalctl -p err -b`
- [ ] `systemctl status myserver --all`
---
`-u` choisit une unité et `-f` continue d'afficher les nouvelles lignes
jusqu'à ce que vous appuyiez sur Ctrl+C.
```

```try
systemctl cat myserver
---
`ExecStart=` est la commande qui démarre le service, et `WantedBy=` est ce
qu'utilise `enable`.
```

```quiz
Vous lancez `systemctl stop myserver` sans `sudo` et obtenez
*Interactive authentication required*. Pourquoi ?
- [ ] myserver ne tourne pas
- [x] Tout ce qui modifie un service nécessite les droits root
- [ ] Vous devez d'abord lancer `daemon-reload`
- [ ] `stop` ne fonctionne que pour les services activés
```

```quiz
Pourquoi `/etc/fstab` indique-t-il généralement `UUID=…` plutôt que `/dev/sda2` ?
- [ ] Les UUID sont plus courts à taper
- [x] Les noms de périphériques peuvent changer quand on ajoute des disques, mais un UUID ne change jamais
- [ ] `mount` ne comprend pas les noms de périphériques
- [ ] L'UUID indique le taux de remplissage du système de fichiers
---
L'UUID est créé en même temps que le système de fichiers. Vous le trouvez
avec `lsblk -f`, `blkid` ou `findmnt`.
```

```quiz
`df -h` montre que `/` est plein à 98 %. Quelle commande vous aide à trouver
**quels répertoires** prennent la place ?
- [ ] `df -hT`
- [ ] `lsblk -f`
- [x] `du -h -d 1`
- [ ] `swapon --show`
---
`df` demande au système de fichiers à quel point il est plein ; `du` parcourt
les fichiers et additionne leur taille.
```

Sur cet ordinateur, votre répertoire personnel n'est pas sur un système de
fichiers à part. Qu'est-ce que ceci affiche ?

```predict
$ df -h ~ | awk 'NR > 1 {print $6}'
/
---
Avec un chemin, `df` ne montre que le système de fichiers où il se trouve. La
sixième colonne est `Mounted on` – le système de fichiers racine.
```

```quiz
Vous avez ajouté une ligne à `/etc/fstab`. Que devez-vous faire **avant** de
redémarrer ?
- [ ] Rien – le fichier n'est lu qu'au démarrage
- [x] La tester avec `sudo mount -a`
- [ ] Lancer `sudo systemctl daemon-reload`
- [ ] Formater la partition avec `mkfs`
---
Une erreur dans `/etc/fstab` peut empêcher l'ordinateur de démarrer
correctement. `mount -a` monte tout ce qui est dans le fichier et n'est pas
encore monté, vous voyez donc les erreurs dès maintenant.
```

```quiz
Vous êtes sur le point de formater une partition avec `mkfs` sur un vrai
ordinateur. Que devez-vous vérifier d'abord ? (Choisissez toutes les bonnes
réponses.)
- [x] Avec `lsblk -f`, que la taille, la colonne `RM` et l'étiquette correspondent
- [x] Que la partition n'est pas montée
- [x] Que vous avez une sauvegarde de tout ce qui est important
- [ ] Que la partition figure dans `/etc/fstab`
```

```quiz
Pourquoi les empreintes des mots de passe sont-elles dans `/etc/shadow` et non dans `/etc/passwd` ?
- [ ] `/etc/passwd` est trop petit
- [x] `/etc/passwd` doit être lisible par tout le monde, mais `/etc/shadow` seulement par root
- [ ] Les empreintes sont réversibles, il faut donc les cacher
- [ ] `/etc/passwd` n'est lu qu'au démarrage
---
Sinon, n'importe qui pourrait copier les empreintes et essayer de les casser
tranquillement. `ls -l` a besoin de `/etc/passwd` pour afficher le nom des
propriétaires.
```

Les champs de `/etc/group` sont le nom du groupe, `x`, le GID et les membres.
Qui fait partie du groupe `sudo` ?

```predict
$ grep ^sudo /etc/group | cut -d: -f4
elev
```

```quiz
Que se passe-t-il avec `sudo userdel kim` – sans `-r` ?
- [x] L'utilisateur est supprimé, mais le répertoire personnel `/home/kim` reste
- [ ] Rien – `userdel` a toujours besoin de `-r`
- [ ] L'utilisateur et le répertoire personnel sont supprimés
- [ ] Le compte est seulement verrouillé
```

```quiz
Un utilisateur a l'UID 33 et le shell `/usr/sbin/nologin`. Qu'est-ce que c'est très probablement ?
- [ ] root
- [ ] Un utilisateur ordinaire – une personne
- [x] Un utilisateur système sous lequel tourne un service
- [ ] Un utilisateur supprimé
---
Les UID 1 à 999 sont réservés aux utilisateurs système, et `nologin` signifie
que personne ne peut se connecter sous leur nom.
```

```try
getent group sudo
---
`getent` recherche le groupe de la même façon que le système.
```
