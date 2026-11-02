# Bienvenue dans le shell Linux

Ce guide vous apprend à utiliser Linux en ligne de commande – de vos toutes
premières commandes jusqu'à la gestion des paquets sur différentes
distributions. Chaque chapitre explique un sujet. En chemin, le texte contient
de courtes **questions** ; répondez-y, et le terminal à droite ainsi que les
**tâches** du chapitre se débloquent. Une tâche est cochée automatiquement dès
que vous l'avez réussie. La meilleure façon d'apprendre,
c'est de *pratiquer* : lisez, essayez, trompez-vous, et recommencez.

## Qu'est-ce que Linux ?

À proprement parler, **Linux** n'est que le *noyau* (*kernel*) : le programme
qui dialogue avec le matériel et permet aux autres programmes de se partager
le processeur, la mémoire et les disques. Le noyau a été créé par Linus
Torvalds en 1991 et c'est un logiciel libre.

Pour obtenir un système utilisable, il faut bien plus que cela : un shell, des
outils pour gérer les fichiers, un gestionnaire de paquets, peut-être un
environnement de bureau. Une **distribution** (*distro*) rassemble tout cela
en un ensemble prêt à l'emploi. Debian, Ubuntu, Arch Linux et Fedora en sont
quelques exemples connus.

La plupart de ce que vous apprendrez dans ce guide fonctionne de la même
manière sur toutes les distributions, c'est donc par là que commence le cours.
Le terminal ici fait tourner **Ubuntu 24.04 LTS**. Les distributions diffèrent
surtout par la façon d'installer les logiciels – nous y viendrons dans le
chapitre sur les distributions.

## Qu'est-ce qu'un shell ?

Un **shell** est le programme qui lit les commandes que vous tapez et les
exécute. Le shell le plus répandu est **bash**, celui par défaut sur presque
toutes les distributions. D'autres shells populaires sont **zsh** (celui par
défaut sur macOS) et **fish**. Les bases sont les mêmes dans tous.

Notez la différence entre un *terminal* et un *shell* : le terminal est la
fenêtre qui affiche le texte, et le shell est le programme qui tourne à
l'intérieur.

```quiz
Vous tapez `ls` et appuyez sur Entrée. Quel programme lit la commande et l'exécute ?
- [ ] Le terminal
- [x] Le shell
- [ ] Le noyau
---
Le terminal ne fait qu'afficher le texte. Le shell (ici bash) lit ce que vous
tapez et l'exécute.
```

## L'invite de commande

Quand le shell attend une commande, il affiche une **invite** (*prompt*). Dans
le terminal ici, elle ressemble à ceci :

```text
{{user}}@ubuntu:~$
```

Elle vous indique qui vous êtes (`{{user}}`), sur quel ordinateur vous vous
trouvez (`ubuntu`) et où vous êtes dans le système de fichiers (`~`
désigne votre répertoire personnel). Le signe `$` montre que vous êtes un
utilisateur ordinaire. Si vous êtes l'administrateur (*root*), vous verrez un
`#` à la place.

```quiz
L'invite se termine par `#` au lieu de `$`. Qu'est-ce que cela vous indique ?
- [ ] Vous êtes dans votre répertoire personnel
- [ ] La commande précédente a échoué
- [x] Vous êtes l'administrateur, root
```

## Votre première commande

Cliquez dans le terminal, tapez la commande ci-dessous et appuyez sur
**Entrée** :

```sh
echo {{helloWorld}}
```

`echo` affiche simplement ce que vous lui donnez. La plupart des commandes
suivent le même schéma :

```text
commande  -options  arguments
ls        -l        /etc
```

La *commande* est le programme à exécuter, les *options* (ou *flags*)
modifient son comportement, et les *arguments* sont ce sur quoi la commande
doit travailler.

```quiz
Dans la commande `ls -l /etc`, quelle partie est l'**option** ?
- [ ] `ls`
- [x] `-l`
- [ ] `/etc`
---
`ls` est la commande, `-l` modifie son comportement, et `/etc` est l'argument
– ce sur quoi `ls` doit travailler.
```

Essayez `echo` avec un texte de votre choix :

```try
echo Linux is fun
---
`echo` a affiché exactement les mots que vous lui avez donnés.
```

## Qui suis-je et où suis-je ?

Deux petites commandes vous renseignent sur le système où vous êtes. `whoami`
affiche le nom de l'utilisateur sous lequel vous êtes connecté. Le fichier
`/etc/os-release` décrit la distribution, et `cat` affiche un fichier (nous
reparlerons de `cat` dans un chapitre ultérieur) :

```sh
whoami
cat /etc/os-release
```

## Comment fonctionne le simulateur

Le terminal ici est un **simulateur** qui tourne entièrement dans cette
application. Il se comporte comme un vrai ordinateur Linux, mais rien de ce
que vous faites ne peut endommager votre propre machine – et si vous faites
une bêtise, vous pouvez toujours repartir de zéro avec *Réinitialiser le
terminal* dans les paramètres.

- **Cliquez sur un exemple de code** pour placer la commande dans le terminal.
- **Tab** complète les noms de commandes et de fichiers.
- **Flèches haut/bas** pour parcourir les commandes précédentes.
- **Ctrl+L** efface l'écran et **Ctrl+C** annule la ligne en cours de saisie.
- `help` liste toutes les commandes, et `man commande` affiche une page de
  manuel.

```quiz
Vous avez tapé `ech` et appuyez sur **Tab**. Que se passe-t-il ?
- [ ] La ligne est annulée
- [x] Le shell essaie de compléter le reste du nom
- [ ] L'écran est effacé
---
Tab complète les noms de commandes et de fichiers. **Ctrl+C** annule la ligne
et **Ctrl+L** efface l'écran.
```
