# Variables, PATH et alias

Le shell a sa propre mémoire, sous forme de **variables**. Dans ce chapitre,
vous apprendrez à les lire et à les définir, à comprendre comment le shell
trouve les programmes, et à créer vos propres raccourcis.

## Les variables d'environnement

On lit une variable en mettant un `$` devant son nom :

```sh
echo $HOME
echo "Je suis $USER"
```

`env` liste toutes les *variables d'environnement* – des variables que les
programmes que vous lancez peuvent lire eux aussi :

```sh
env
```

On crée une variable avec `NOM=valeur` (sans espace autour du `=` !). Avec
`export`, elle devient une variable d'environnement :

```sh
export EDITOR=nano
```

## Guillemets simples et doubles

Il y a une différence importante :

```sh
echo "Dossier perso : $HOME"
echo 'Dossier perso : $HOME'
```

Entre guillemets **doubles**, les variables sont remplacées par leur valeur.
Entre guillemets **simples** (apostrophes), tout est affiché exactement tel
quel.

## PATH – où trouve-t-on les commandes ?

Quand vous tapez `ls`, le shell cherche un fichier nommé `ls` dans les
répertoires listés dans la variable `PATH`, l'un après l'autre :

```sh
echo $PATH
```

`which` indique où un programme a été trouvé. Certaines commandes, comme
`cd`, ne sont pas du tout des fichiers mais sont *intégrées* au shell
(*builtins*) – `type` vous dit ce qu'est un nom :

```sh
which ls
type cd
```

Si vous voulez lancer un programme qui n'est pas dans `PATH`, vous devez
indiquer son chemin, par exemple `./monprogramme` pour un fichier situé dans
le répertoire où vous êtes.

## Les codes de retour – `$?`

Chaque commande laisse un **code de retour** (*exit code*) quand elle se
termine : `0` signifie que tout s'est bien passé, toute autre valeur indique
une erreur. Le dernier code de retour est stocké dans `$?` :

```sh
ls /finnsinte
echo $?
```

C'est ce code de retour que regardent `&&` et `||`.

## Les alias

Un **alias** est un raccourci personnel :

```sh
alias ll='ls -la'
ll
```

`alias` sans argument liste tous les alias, et `unalias ll` en supprime un.

## Conserver ses réglages – `~/.bashrc`

Les variables et alias que vous créez disparaissent quand vous fermez le
terminal. Pour les garder, placez-les dans le fichier `~/.bashrc`, que bash
lit à chaque ouverture d'un nouveau terminal. Après avoir modifié le fichier,
vous pouvez le charger tout de suite avec :

```sh
source ~/.bashrc
```
