# Fichiers et répertoires

Maintenant que vous savez vous repérer, il est temps de créer, copier,
déplacer et supprimer des choses.

## Créer des répertoires – `mkdir`

```sh
mkdir images2
```

Pour créer plusieurs niveaux d'un coup, il faut `-p` (*parents*). Sans cette
option, `mkdir` proteste si le répertoire parent n'existe pas :

```sh
mkdir -p voyage/2026/juin
```

## Créer des fichiers vides – `touch`

`touch` crée un fichier vide s'il n'existe pas (et sinon, met simplement à
jour son horodatage) :

```sh
touch liste-courses.txt
```

```quiz
Que fait `touch {{notes}}` si le fichier existe déjà ?
- [ ] Il vide le fichier
- [ ] Il se plaint que le fichier existe
- [x] Il met seulement à jour l'horodatage du fichier – le contenu reste le même
```

## Copier – `cp`

```sh
cp {{notes}} notes-copie.txt
```

Si la cible est un répertoire, la copie atterrit à l'intérieur, sous le même
nom. Pour copier un répertoire entier, il faut `-r` (*recursive*) :

```sh
cp -r {{documents}} {{documents}}-backup
```

```predict
$ mkdir copies
$ cp {{notes}} copies
$ ls copies
{{notes}}
---
`copies` est un répertoire, donc la copie atterrit à l'intérieur, sous le même
nom.
```

## Déplacer et renommer – `mv`

Sous Linux, *déplacer* et *renommer*, c'est la même chose. `mv` fait les
deux :

```sh
mv liste-courses.txt {{documents}}/
mv {{documents}}/liste-courses.txt {{documents}}/courses.txt
```

```quiz
Il n'existe aucun fichier nommé `b.txt`. Que fait `mv a.txt b.txt` ?
- [ ] Il copie `a.txt` vers `b.txt`
- [x] Il renomme `a.txt` en `b.txt`
- [ ] Il échoue, parce que `b.txt` n'existe pas
---
Déplacer et renommer, c'est la même chose. Ensuite, il n'y a plus que `b.txt`.
```

## Supprimer – `rm` et `rmdir`

```sh
rm notes-copie.txt
```

`rmdir` supprime les répertoires *vides*. Pour supprimer un répertoire avec
tout son contenu, utilisez `rm -r` :

```sh
rm -r {{documents}}-backup
```

> **Attention !** Il n'y a pas de corbeille dans le terminal. Ce que vous
> supprimez avec `rm` disparaît pour de bon. La commande `rm -rf` (*recursive,
> force*) ne pose aucune question et ne se plaint jamais – vérifiez toujours le
> chemin avant d'appuyer sur Entrée.

```quiz
Quelle commande supprime le répertoire `{{old}}` *uniquement* s'il est vide ?
- [ ] `rm {{old}}`
- [x] `rmdir {{old}}`
- [ ] `rm -r {{old}}`
---
`rmdir` refuse de supprimer un répertoire qui contient encore quelque chose.
`rm -r` supprime le répertoire et tout ce qu'il contient.
```

## Les caractères génériques (wildcards)

Le shell peut développer des motifs en plusieurs noms de fichiers avant que la
commande ne s'exécute :

| Motif | Correspond à |
|---|---|
| `*` | N'importe quoi (zéro caractère ou plus) |
| `?` | Exactement un caractère |
| `[abc]` | L'un des caractères a, b ou c |

Le répertoire `{{documents}}` de votre dossier personnel contient trois fichiers :
`{{fruits}}`, `{{grades}}` et `server.log`. Ceci liste uniquement ceux qui se
terminent par `.txt` :

```sh
ls {{documents}}/*.txt
```

```text
{{documents}}/{{fruits}}
```

Ici, `ls` ne voit jamais l'astérisque – le shell a déjà remplacé
`{{documents}}/*.txt` par tous les noms de fichiers correspondants.

```predict
$ ls {{documents}}/??????.*
{{documents}}/{{fruits}}  {{documents}}/server.log
---
Chaque `?` correspond à exactement un caractère, donc le nom avant le point
doit faire six caractères. C'est le cas de `fruits` et de `server` –
`resultats` est plus long.
```

## Les espaces dans les noms de fichiers

Le shell découpe la ligne de commande aux espaces. Si un fichier contient un
espace dans son nom, vous devez utiliser des guillemets (ou un `\` devant
l'espace) :

```sh
touch "mon fichier.txt"
ls -l "mon fichier.txt"
```

C'est pourquoi beaucoup de gens préfèrent les tirets ou les tirets bas
(underscores) dans les noms de fichiers.
