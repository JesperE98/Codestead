# D'autres shells : zsh et fish

Jusqu'ici, vous avez tapé toutes vos commandes dans **bash**. Mais bash n'est
qu'un shell parmi d'autres – et beaucoup de gens en préfèrent un autre. Dans
ce chapitre, vous installez deux alternatives populaires, **zsh** et **fish**,
vous les essayez et vous voyez en quoi elles diffèrent de bash. Vous
comprendrez aussi pourquoi les scripts sont malgré tout presque toujours
écrits pour bash.

## Au fait, qu'est-ce qu'un shell ?

Le **shell** est le programme qui lit ce que vous tapez, l'interprète et lance
d'autres programmes. C'est le shell qui comprend `|`, `>`, les `$VARIABLES`,
les jokers comme `*.txt` et les boucles. Le terminal n'est que la fenêtre dans
laquelle le shell tourne.

Les programmes comme `ls`, `grep` et `cat` sont des programmes distincts dans
`/usr/bin` – ils fonctionnent de la même façon quel que soit le shell. Ce qui
diffère d'un shell à l'autre, c'est **le langage qui les entoure** : comment
on définit les variables, comment on écrit les boucles et les conditions, à
quoi ressemble l'invite et quelles commodités sont disponibles.

## L'arbre généalogique : sh, bash, zsh et fish

| Shell | Depuis | Caractéristiques |
|---|---|---|
| `sh` | 1979 | Le Bourne shell. Le `sh` d'aujourd'hui suit la norme **POSIX** et constitue le plus petit dénominateur commun. |
| `bash` | 1989 | *Bourne Again SHell*. Le shell par défaut de presque toutes les distributions Linux. |
| `zsh` | 1990 | Largement compatible avec bash, mais avec plus de fonctionnalités. Le shell par défaut de macOS. |
| `fish` | 2005 | *Friendly interactive shell*. Facile à utiliser, mais avec **sa propre syntaxe**. |

**POSIX** est une norme qui décrit comment un shell `sh` doit se comporter.
Un script qui n'utilise que des fonctionnalités POSIX fonctionne dans tous
les shells compatibles `sh` : bash, zsh, `dash` (qui est `/bin/sh` sur Debian
et Ubuntu) et `ash` (sur les petits systèmes comme Alpine). fish n'est
volontairement **pas** compatible POSIX – c'est ce qui le rend plus simple,
mais aussi différent.

## Quels shells sont installés ?

Le fichier `/etc/shells` liste les shells qui peuvent servir de shell de
connexion :

```sh
cat /etc/shells
```

Le shell que vous obtenez à la connexion est le dernier champ de votre ligne
dans `/etc/passwd`, et il se trouve aussi dans la variable `$SHELL` :

```sh
grep elev /etc/passwd
echo $SHELL
```

## zsh – bash avec des bonus

### Installer zsh

zsh porte le même nom de paquet dans toutes les familles :

:::debian
```sh
sudo apt update
sudo apt install zsh
```
:::

:::arch
```sh
sudo pacman -S zsh
```
:::

:::redhat
```sh
sudo dnf install zsh
```
:::

Regardez de nouveau `/etc/shells` – le paquet a ajouté `/usr/bin/zsh` (et
`/bin/zsh`) :

```sh
cat /etc/shells
```

### Lancer zsh

Un shell est un programme comme un autre ; on lance donc zsh en tapant son
nom :

```sh
zsh
```

La première fois, vous êtes accueilli par **zsh-newuser-install**, car vous
n'avez pas encore de fichier de configuration pour zsh. C'est un menu qui vous
aide à démarrer :

| Touche | Fait |
|---|---|
| `q` | Quitter sans rien faire (la question reviendra la prochaine fois) |
| `0` | Créer un `~/.zshrc` presque vide |
| `1` | Le menu principal avec tous les réglages (non disponible dans le simulateur) |
| `2` | Créer `~/.zshrc` avec les réglages recommandés |

Répondez `2`. L'invite devient `elev@{{hostname}} ~ %` – dans zsh, `%` est le
signe habituel pour un utilisateur ordinaire (root obtient `#`, comme dans
bash).

Quel shell faites-vous tourner maintenant ? La variable `$0` contient le nom
du shell :

```sh
echo $0
ps
```

`ps` montre que zsh tourne **à l'intérieur** de bash : bash a lancé zsh comme
un nouveau processus. Remarquez aussi que `$SHELL` vaut toujours `/bin/bash` –
cette variable indique votre *shell de connexion*, et non le shell que vous
êtes en train d'utiliser.

```sh
echo $SHELL
```

### La plupart des choses fonctionnent comme dans bash

zsh comprend presque toute la syntaxe de bash. Les pipes, les redirections,
les variables, `if`, `for` et les fonctions marchent comme vous en avez
l'habitude :

```sh
for f in ~/dokument/*.txt; do wc -l $f; done
```

### Fonctionnalité 1 : `**` cherche dans tous les sous-répertoires

Dans zsh, `**/` signifie « tous les répertoires, à tous les niveaux ». Ceci
liste tous les fichiers `.txt` de votre répertoire personnel et de tout ce
qu'il contient :

```sh
ls ~/**/*.txt
```

Dans bash, `**` se comporte comme un simple `*` – à moins de l'activer d'abord
avec `shopt -s globstar`.

### Fonctionnalité 2 : autocd

Avec l'option `autocd` (qui fait partie des réglages recommandés), il suffit
de taper le nom d'un répertoire pour y aller – sans `cd` :

```sh
dokument
..
```

Les options s'activent et se désactivent avec `setopt` et `unsetopt` :

```sh
setopt
unsetopt autocd
setopt autocd
```

### Une différence à surveiller : les variables ne sont pas découpées

Dans bash, une variable sans guillemets est découpée aux espaces. Dans zsh,
non :

```sh
filer="a.txt b.txt"
for f in $filer; do echo "[$f]"; done
```

bash affiche `[a.txt]` et `[b.txt]` – zsh affiche `[a.txt b.txt]`. Le
comportement de zsh est généralement ce que l'on veut, mais cela signifie
qu'un script bash ne fait pas toujours la même chose dans zsh. (Avec
`setopt shwordsplit`, zsh se comporte comme bash.)

### ~/.zshrc et l'invite

bash lit `~/.bashrc` au démarrage – zsh lit `~/.zshrc`. Regardez le fichier
que zsh-newuser-install a créé :

```sh
cat ~/.zshrc
```

L'invite est définie par la variable `PROMPT` et utilise des codes `%` :

| Code | Signifie |
|---|---|
| `%n` | Le nom d'utilisateur |
| `%m` | Le nom de l'ordinateur |
| `%~` | Le répertoire complet (avec `~` pour votre répertoire personnel) |
| `%1~` | Seulement la dernière partie du répertoire |
| `%#` | `%` pour les utilisateurs ordinaires, `#` pour root |
| `%F{green}` … `%f` | Couleur (red, green, blue, yellow …) |

Essayez :

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

La modification ne dure que jusqu'à ce que vous quittiez zsh. Si vous la
voulez à chaque fois, mettez la ligne dans `~/.zshrc`.

### Oh My Zsh

Beaucoup d'utilisateurs de zsh installent **Oh My Zsh**, une collection de
thèmes et de plugins – par exemple des informations Git dans l'invite, une
meilleure complétion avec Tab et des suggestions pendant la frappe. On
l'installe avec un script depuis le site du projet et on le configure dans
`~/.zshrc`. Il n'est pas disponible dans le simulateur, mais vous savez
maintenant de quoi les gens parlent quand ils l'évoquent.

### Retour à bash

zsh est un processus qui tourne à l'intérieur de bash. Quittez-le avec `exit`
et vous voilà de retour dans bash – où les variables, les alias et les
changements de répertoire faits dans zsh ont disparu :

```sh
exit
echo $0
```

## fish – le shell interactif convivial

fish veut être facile à utiliser tout de suite, sans configuration : des
couleurs, la complétion avec Tab et des **autosuggestions** – fish propose la
suite de la commande en gris, d'après votre historique, et vous acceptez la
suggestion avec la flèche droite. (Le simulateur n'affiche pas de
suggestions, mais la syntaxe fonctionne.)

### Installer et lancer fish

:::debian
```sh
sudo apt update
sudo apt install fish
```
:::

:::arch
```sh
sudo pacman -S fish
```
:::

:::redhat
```sh
sudo dnf install fish
```
:::

```sh
fish
```

fish vous souhaite la bienvenue et l'invite devient `elev@{{hostname}} ~>`.
Descendez de quelques répertoires et voyez comment fish raccourcit le chemin
dans l'invite :

```sh
mkdir -p ~/dokument/projekt
cd ~/dokument/projekt
cd ~
```

Dans le répertoire `~/dokument/projekt`, l'invite affiche `~/d/projekt>` –
chaque répertoire sauf le dernier est réduit à une lettre.

### fish a sa propre syntaxe

C'est ici que fish diffère le plus de bash et de zsh :

| Action | bash et zsh | fish |
|---|---|---|
| Définir une variable | `frukt=äpple` | `set frukt äpple` |
| Variable d'environnement | `export EDITOR=nano` | `set -x EDITOR nano` |
| Supprimer une variable | `unset frukt` | `set -e frukt` |
| Substitution de commande | `$(pwd)` | `(pwd)` |
| Dernier code de retour | `$?` | `$status` |
| Arguments du script | `$@`, `$1` | `$argv`, `$argv[1]` |
| Condition | `if …; then …; fi` | `if …; …; end` |
| Boucle | `for …; do …; done` | `for …; …; end` |
| Fonction | `hej() { …; }` | `function hej; …; end` |
| Arithmétique | `$((17 * 23))` | `math 17 x 23` |

### Les variables avec set

Essayez de définir une variable à la manière de bash (`frukt` signifie
« fruit » en suédois, `äpple` « pomme ») :

```sh
frukt=äpple
```

fish refuse et vous explique comment l'écrire :

```text
fish: Unsupported use of '='. In fish, please use 'set frukt äpple'.
```

Voici comment on fait dans fish :

```sh
set frukt äpple
echo $frukt
set -x EDITOR nano
set -e frukt
```

`-x` (*export*) fait de la variable une variable d'environnement que les
programmes que vous lancez peuvent voir, et `-e` (*erase*) la supprime.

Dans fish, chaque variable est une **liste**. Les éléments sont numérotés à
partir de 1 :

```sh
set frukter äpple päron banan
echo $frukter[2]
count $frukter
```

### Substitution de commande et $status

Dans fish, la substitution de commande s'écrit avec de simples parenthèses :

```sh
echo "Je suis dans" (pwd)
```

À l'intérieur des guillemets, les parenthèses sont du texte ordinaire – c'est
pourquoi `(pwd)` est en dehors. Le code de retour de la dernière commande
s'appelle `$status` :

```sh
false
echo $status
```

### and, or et not

fish a ses propres commandes pour enchaîner des conditions :

```sh
test -f ~/.bashrc; and echo exists
test -f ~/missing.txt; or echo missing
```

Les versions récentes de fish (3.0 et suivantes) comprennent aussi `&&` et
`||`, et depuis la 3.4, `$(...)` fonctionne également. Mais `X=1`, `$?` et
`$((...))` ne fonctionnent toujours pas – ils provoquent des erreurs qui vous
indiquent la manière de faire de fish.

### Les blocs se terminent par end

Dans fish, chaque bloc – `if`, `for`, `while`, `switch` et `function` – se
termine par `end`. Il n'y a ni `then`, ni `do`, ni `done`, ni `fi` :

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo exists; else; echo missing; end
```

Vous pouvez aussi écrire le bloc sur plusieurs lignes. Le shell attend `end`
avant d'exécuter la boucle :

```sh
for f in ~/dokument/*.txt
echo (basename $f)
end
```

Les fonctions reçoivent leurs arguments dans la liste `$argv` :

```sh
function hello; echo "Hello $argv!"; end
hello Kim
```

### L'arithmétique avec math

fish n'a pas de `$((...))`. À la place, il y a la commande `math`, qui gère
aussi les décimales :

```sh
math 17 x 23
math 10 / 4
```

Écrivez `x` (ou `"17 * 23"` entre guillemets) pour la multiplication – un `*`
seul est un joker dans fish, comme dans bash.

### Les réglages de fish

fish lit `~/.config/fish/config.fish` au démarrage. Si vous voulez vous
débarrasser du message de bienvenue, videz la variable `fish_greeting`. Avec
`-U`, la variable devient **universelle** : elle est enregistrée dans
`~/.config/fish/fish_variables` et s'applique dans tous les shells fish, même
après un redémarrage.

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

Quittez fish avec `exit` :

```sh
exit
```

## Pourquoi les scripts sont toujours écrits pour bash

Le shell que vous utilisez dans le terminal est une affaire de goût. Mais les
**scripts** sont presque toujours écrits pour bash (ou pour le `sh` POSIX) :

- bash est installé sur pratiquement tous les systèmes Linux – zsh et fish,
  non.
- La syntaxe de fish ne fonctionne pas dans bash, et inversement.
- La ligne `#!` en haut du script décide quel shell l'exécute –
  **indépendamment** du shell dans lequel vous vous trouvez.

Essayez d'écrire un script bash et de le lancer depuis fish :

```sh
cat > ~/hej.sh << 'SLUT'
#!/bin/bash
name=Kim
echo "Bonjour $name, je suis exécuté par bash"
SLUT
chmod +x ~/hej.sh
fish
~/hej.sh
exit
```

Le script fonctionne dans fish, même si `name=Kim` y est interdit – car c'est
bash qui l'exécute. C'est pourquoi `#!/bin/bash` (ou `#!/usr/bin/env bash`)
est si important. Un script qui doit fonctionner partout, même là où bash est
absent, s'écrit avec `#!/bin/sh` et uniquement la syntaxe POSIX.

## Changer de shell par défaut avec chsh

Taper `zsh` à chaque ouverture d'un terminal, on s'en lasse vite. Avec `chsh`
(*change shell*), vous changez votre **shell de connexion** – celui de
`/etc/passwd` :

```sh
chsh -s /usr/bin/zsh
grep elev /etc/passwd
```

- Le shell doit être indiqué avec son chemin complet et figurer dans
  `/etc/shells`.
- `chsh` demande votre mot de passe (le simulateur saute cette étape).
- La modification prend effet à la **prochaine connexion**. Le terminal
  ouvert garde son ancien shell, et `$SHELL` ne change qu'une fois que vous
  vous êtes reconnecté.
- root peut changer le shell des autres : `sudo chsh -s /usr/bin/fish kim`.

:::arch
Sous Arch, `chsh -l` liste tous les shells valides.
:::

:::redhat
Sur Fedora, `chsh -l` liste tous les shells valides.
:::

Pour revenir à bash, faites de même :

```sh
chsh -s /bin/bash
```

Un conseil courant pour fish est de garder bash comme shell de connexion et
de laisser plutôt le programme de terminal lancer fish – ainsi, tout ce qui
attend un shell POSIX à la connexion continue de fonctionner.

## Quel shell choisir ?

- **bash** – le standard partout. Ce que vous apprenez ici fonctionne sur
  tous les serveurs auxquels vous vous connecterez un jour. Écrivez vos
  scripts pour bash.
- **zsh** – pour ceux qui veulent plus de confort tout en gardant la syntaxe
  de bash. Oh My Zsh vous apporte thèmes et plugins.
- **fish** – la meilleure expérience dès l'installation, mais avec une
  syntaxe différente. Les commandes copiées sur le web ne fonctionnent pas
  toujours.
- **sh/dash** – pour les scripts qui doivent fonctionner partout, et sur les
  petits systèmes.

## Résumé

| Commande | Fait |
|---|---|
| `cat /etc/shells` | Liste les shells autorisés |
| `echo $0` / `ps` | Montre quel shell vous utilisez en ce moment |
| `echo $SHELL` | Montre votre shell de connexion |
| `zsh` / `fish` / `exit` | Lance un autre shell / revient en arrière |
| `ls ~/**/*.txt` | Cherche dans tous les sous-répertoires (zsh, fish) |
| `setopt autocd` | Active une option de zsh |
| `set frukt äpple` | Définit une variable dans fish |
| `set -x NOM valeur` | Définit une variable d'environnement dans fish |
| `chsh -s /usr/bin/zsh` | Change votre shell de connexion |

Les fichiers de configuration : `~/.bashrc` (bash), `~/.zshrc` (zsh) et
`~/.config/fish/config.fish` (fish).
