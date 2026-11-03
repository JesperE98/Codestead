# Examen : Scripts et automatisation

Répondez aux questions sur les scripts shell – il faut 80 % pour réussir.

```quiz
Que fait la première ligne `#!/bin/bash` d'un script ?
- [ ] C'est un commentaire que le shell ignore
- [x] Elle indique au système quel programme doit exécuter le fichier
- [ ] Elle rend le fichier exécutable
---
On l'appelle le *shebang*. Il vous faut quand même `chmod +x` pour rendre le
fichier exécutable.
```

```quiz
`{{nameVar}} = Kim` donne l'erreur `command not found`. Pourquoi ?
- [x] Les espaces autour de `=` font que le shell traite `{{nameVar}}` comme une commande
- [ ] Les noms de variables doivent être écrits en majuscules
- [ ] Il faut écrire `${{nameVar}} = Kim`
```

`~/{{documents}}` contient les trois fichiers d'exercice `{{fruits}}`,
`{{grades}}` et `server.log`.

```predict
$ nombre=$(ls ~/{{documents}} | wc -l)
$ echo "$nombre fichiers"
3 fichiers
```

```predict
$ a=5
$ (( a += 10 ))
$ echo $a
15
```

```quiz
Que contient `"$@"` dans un script ?
- [ ] Le nombre d'arguments
- [ ] Le nom du script
- [x] Tous les arguments, chacun séparément
```

```quiz
Quel test est vrai quand le nombre contenu dans `n` est supérieur à 10 ?
- [ ] `[ $n > 10 ]`
- [x] `[ $n -gt 10 ]`
- [ ] `[ $n = 10 ]`
---
Les nombres se comparent avec `-eq`, `-lt`, `-gt` et ainsi de suite ; `=` et
`<` comparent du texte.
```

```predict
$ [ -d ~/{{missing}} ] && echo yes || echo no
no
```

```predict
$ fichier=rapport.txt
$ case $fichier in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
A text file
```

```predict
$ plus() { echo $(( $1 + $2 )); }
$ plus 4 5
9
```

```predict
$ for i in 1 2 3 4 5; do if [ $i -eq 3 ]; then continue; fi; echo $i; done
1
2
4
5
---
`continue` saute directement au tour suivant, donc `3` n'est jamais affiché.
```

```quiz
Que fait `local` dans une fonction ?
- [x] Crée une variable qui n'existe qu'à l'intérieur de la fonction
- [ ] Rend la fonction plus rapide
- [ ] Termine la fonction avec un code de retour
```

```quiz
Pourquoi un script se termine-t-il par `exit 1` quand quelque chose se passe mal ?
- [ ] Pour relancer le script
- [x] Pour que celui qui a appelé le script voie, grâce au code de retour, qu'il a échoué
- [ ] Pour afficher le nombre 1
```

```quiz
Vous commencez un here document avec `cat > {{helloScript}} << '{{heredocEnd}}'`. Quand se termine-t-il ?
- [ ] Quand vous appuyez sur Entrée sur une ligne vide
- [x] À la ligne `{{heredocEnd}}`
- [ ] Après dix lignes
```

```try
for i in $(seq 1 3); do echo "Round $i"; done
```

```quiz
Quelle ligne de crontab lance `~/backup.sh` à 23:45 tous les dimanches ?
- [ ] `23 45 * * 0 ~/backup.sh`
- [x] `45 23 * * 0 ~/backup.sh`
- [ ] `45 23 0 * * ~/backup.sh`
---
D'abord la minute, puis l'heure : 45 23. Le dimanche est le jour 0 (ou 7) de la
semaine, dans le cinquième champ.
```
