# Examen : Les bases

Répondez aux questions ci-dessous pour montrer ce que vous avez appris dans
cette partie.

```quiz
Lequel de ces chemins est **absolu** ?
- [ ] `var/log`
- [ ] `../etc`
- [x] `/usr/bin`
- [ ] `{{documents}}`
---
Un chemin absolu commence par `/`, à la racine. Les autres partent du
répertoire où vous êtes.
```

```predict
$ cd /var/log
$ cd ../..
$ pwd
/
---
Chaque `..` remonte d'un niveau : de `/var/log` à `/var`, puis à `/`.
```

```quiz
Que fait `cd -` ?
- [ ] Remonte d'un niveau
- [ ] Va dans votre répertoire personnel
- [x] Retourne dans le répertoire où vous étiez juste avant
```

```quiz
Vous voulez copier tout le répertoire `{{pictures}}`, avec tout son contenu, vers `{{pictures}}-copie`. Quelle commande fonctionne ?
- [ ] `cp {{pictures}} {{pictures}}-copie`
- [x] `cp -r {{pictures}} {{pictures}}-copie`
- [ ] `mv {{pictures}} {{pictures}}-copie`
---
Un répertoire se copie avec `-r` (*récursif*). `mv` le déplacerait au lieu de
le copier.
```

```predict
$ mkdir -p a/b/c
$ ls a/b
c
---
`-p` crée `a`, `a/b` et `a/b/c` d'un coup, donc `a/b` contient `c`.
```

```quiz
Vous tapez `touch mon fichier.txt` – sans guillemets. Que se passe-t-il ?
- [ ] Un fichier nommé `mon fichier.txt` est créé
- [x] Deux fichiers sont créés : `mon` et `fichier.txt`
- [ ] Rien, car le nom contient un espace
---
Le shell découpe la ligne aux espaces, donc `touch` reçoit deux arguments.
Écrivez `touch "mon fichier.txt"` pour obtenir un seul fichier.
```

```quiz
Quelles lignes `grep -i error {{documents}}/server.log` affiche-t-il ?
- [ ] Seulement les lignes avec `error` en minuscules
- [ ] Seulement les lignes avec `ERROR` en majuscules
- [x] Les lignes avec `error`, quel que soit le mélange de majuscules et de minuscules
```

```quiz
Vous voulez surveiller un fichier journal et voir les nouvelles lignes au fur et à mesure qu'elles sont écrites. Quelle commande convient ?
- [ ] `head -n 10 {{documents}}/server.log`
- [x] `tail -f {{documents}}/server.log`
- [ ] `wc -l {{documents}}/server.log`
---
`tail -f` *suit* le fichier. Arrêtez-le avec **Ctrl+C**.
```

```quiz
Qu'affiche `wc` quand vous lui donnez un fichier sans option ?
- [ ] Seulement le nombre de lignes
- [x] Le nombre de lignes, de mots et d'octets
- [ ] Les 10 premières lignes du fichier
```

```predict
$ echo a > x.txt
$ echo b >> x.txt
$ echo c > x.txt
$ cat x.txt
c
---
`>>` a ajouté `b`, mais le dernier `>` a écrasé tout le fichier.
```

```quiz
Quand `b` s'exécute-t-il dans `a || b` ?
- [ ] Toujours, après `a`
- [ ] Seulement si `a` a réussi
- [x] Seulement si `a` a échoué
```

```try
grep ERROR ~/{{documents}}/server.log | tee erreurs.txt | wc -l
---
`tee` a enregistré les lignes d'erreur dans `erreurs.txt` et les a transmises à
`wc -l`, qui les a comptées.
```

```predict
$ echo "a,b,c" | cut -d, -f2
b
---
`-d,` fait de la virgule le séparateur, et `-f2` garde le champ 2.
```

```predict
$ echo "x y z" | awk '{print NF}'
3
---
`NF` est le nombre de champs sur la ligne. Les champs sont séparés par des
espaces.
```

```quiz
Pourquoi un programme awk comme `'{print $3}'` doit-il être écrit entre guillemets **simples** ?
- [ ] awk ne sait pas lire les guillemets doubles
- [x] Sinon le shell croit que `$3` est une variable du shell et la remplace avant le démarrage d'awk
- [ ] Les guillemets simples rendent awk plus rapide
```
