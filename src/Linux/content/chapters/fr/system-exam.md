# Examen : Le système

Répondez aux questions sur les variables, les permissions, les processus et les archives – il faut 80 % pour réussir.

```predict
$ echo "$HOME" '$USER'
/home/{{user}} $USER
---
Les guillemets doubles remplacent la variable par sa valeur ; les guillemets
simples l'affichent exactement telle quelle.
```

```quiz
Que fait `export` avec une variable ?
- [ ] L'enregistre dans `~/.bashrc`
- [x] En fait une variable d'environnement que les programmes que vous lancez peuvent lire aussi
- [ ] La supprime
```

```predict
$ ls ~ > /dev/null
$ echo $?
0
---
`ls` s'est bien passé, donc le code de retour est `0`. La sortie elle-même a
disparu dans `/dev/null`.
```

```quiz
Quel nombre donne les permissions `rwxr-x---` ?
- [ ] `755`
- [x] `750`
- [ ] `640`
---
Propriétaire : 4 + 2 + 1 = 7. Groupe : 4 + 1 = 5. Autres : 0.
```

```predict
$ touch outil.sh
$ chmod 755 outil.sh
$ chmod go-x outil.sh
$ ls -l outil.sh | awk '{print $1}'
-rwxr--r--
```

```quiz
Sur Ubuntu, les membres de quel groupe ont le droit d'utiliser `sudo` ?
- [x] `sudo`
- [ ] `root`
- [ ] `{{user}}`
```

```quiz
Que fait `sudo -i` ?
- [ ] Affiche des informations sur sudo
- [x] Ouvre un shell root, où l'invite devient `#`, jusqu'à ce que vous tapiez `exit`
- [ ] Relance la commande précédente en root
```

```quiz
Dans `ps aux`, un processus a `R` dans la colonne `STAT`. Qu'est-ce que cela signifie ?
- [x] Il est en cours d'exécution
- [ ] Il dort
- [ ] Il appartient à root
```

```quiz
Quelle variable contient le PID du dernier job lancé en arrière-plan ?
- [ ] `$?`
- [x] `$!`
- [ ] `$#`
```

```quiz
Vous essayez `kill 812` sur un processus qui appartient à root et obtenez
`Operation not permitted`. Que faites-vous ?
- [ ] Vous utilisez `kill -9 812` à la place
- [x] Vous la lancez avec `sudo` : `sudo kill 812`
- [ ] Rien – les processus de root ne peuvent jamais être arrêtés
```

```quiz
Quelle est la différence entre `pkill` et `killall` ?
- [x] `pkill` cherche un motif, `killall` a besoin du nom exact
- [ ] `pkill` envoie `SIGKILL`, `killall` envoie `SIGTERM`
- [ ] Il n'y en a aucune – c'est le même programme
```

```quiz
Qu'est-ce qui ne va pas dans `tar -cvf {{documents}} {{documents}}.tar` ?
- [ ] `-v` ne peut pas être combiné avec `-c`
- [x] L'ordre : le nom de l'archive doit venir juste après `f`, avant les fichiers
- [ ] Une archive tar doit se terminer par `.tgz`
```

```predict
$ cp {{documents}}/{{fruits}} .
$ gzip {{fruits}}
$ gunzip {{fruits}}.gz
$ ls {{fruits}}*
{{fruits}}
```

```quiz
Que fait `zcat server.log.gz` ?
- [x] Affiche le contenu décompressé, et `server.log.gz` reste tel quel
- [ ] Décompresse le fichier en `server.log`
- [ ] Compresse le fichier une fois de plus
---
`zcat` revient à `gzip -dc` : décompresser vers la sortie standard.
```

```try
du -sh {{documents}}
---
`-s` donne un seul total pour tout le répertoire et `-h` rend la taille facile à lire.
```

```quiz
Vous créez `ln -s {{notes}} link`, puis vous supprimez `{{notes}}`. Que se passe-t-il quand vous lancez `cat link` ?
- [ ] Il affiche l'ancien contenu
- [x] `No such file or directory` – le lien est cassé
- [ ] Le lien est supprimé lui aussi
---
Un lien symbolique ne contient qu'un chemin. Quand il n'y a plus rien à cet
endroit, le lien est cassé. Un lien physique aurait gardé le contenu en vie.
```
