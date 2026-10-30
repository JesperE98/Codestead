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
`namn = Kim` donne l'erreur `command not found`. Pourquoi ?
- [x] Les espaces autour de `=` font que le shell traite `namn` comme une commande
- [ ] Les noms de variables doivent être écrits en majuscules
- [ ] Il faut écrire `$namn = Kim`
```

```predict
$ antal=$(ls ~/dokument | wc -l)
$ echo "$antal files"
3 files
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
$ [ -d ~/finnsinte ] && echo yes || echo no
no
```

```predict
$ fil=rapport.txt
$ case $fil in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
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
Vous commencez un here document avec `cat > hej.sh << 'SLUT'`. Quand se termine-t-il ?
- [ ] Quand vous appuyez sur Entrée sur une ligne vide
- [x] À la ligne `SLUT`
- [ ] Après dix lignes
```

```try
for i in $(seq 1 3); do echo "Round $i"; done
```
