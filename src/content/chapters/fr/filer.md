# Fichiers et répertoires

Maintenant que vous savez vous repérer, il est temps de créer, copier,
déplacer et supprimer des choses.

## Créer des répertoires – `mkdir`

```sh
mkdir bilder2
```

Pour créer plusieurs niveaux d'un coup, il faut `-p` (*parents*). Sans cette
option, `mkdir` proteste si le répertoire parent n'existe pas :

```sh
mkdir -p resa/2026/juni
```

## Créer des fichiers vides – `touch`

`touch` crée un fichier vide s'il n'existe pas (et sinon, met simplement à
jour son horodatage) :

```sh
touch inkopslista.txt
```

## Copier – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

Si la cible est un répertoire, la copie atterrit à l'intérieur, sous le même
nom. Pour copier un répertoire entier, il faut `-r` (*recursive*) :

```sh
cp -r dokument dokument-backup
```

## Déplacer et renommer – `mv`

Sous Linux, *déplacer* et *renommer*, c'est la même chose. `mv` fait les
deux :

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
```

## Supprimer – `rm` et `rmdir`

```sh
rm anteckningar-kopia.txt
```

`rmdir` supprime les répertoires *vides*. Pour supprimer un répertoire avec
tout son contenu, utilisez `rm -r` :

```sh
rm -r dokument-backup
```

> **Attention !** Il n'y a pas de corbeille dans le terminal. Ce que vous
> supprimez avec `rm` disparaît pour de bon. La commande `rm -rf` (*recursive,
> force*) ne pose aucune question et ne se plaint jamais – vérifiez toujours le
> chemin avant d'appuyer sur Entrée.

## Les caractères génériques (wildcards)

Le shell peut développer des motifs en plusieurs noms de fichiers avant que la
commande ne s'exécute :

| Motif | Correspond à |
|---|---|
| `*` | N'importe quoi (zéro caractère ou plus) |
| `?` | Exactement un caractère |
| `[abc]` | L'un des caractères a, b ou c |

```sh
ls dokument/*.txt
```

Ici, `ls` ne voit jamais l'astérisque – le shell a déjà remplacé
`dokument/*.txt` par tous les noms de fichiers correspondants.

## Les espaces dans les noms de fichiers

Le shell découpe la ligne de commande aux espaces. Si un fichier contient un
espace dans son nom, vous devez utiliser des guillemets (ou un `\` devant
l'espace) :

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

C'est pourquoi beaucoup de gens préfèrent les tirets ou les tirets bas
(underscores) dans les noms de fichiers.
