# Bienvenue dans le shell Linux

Ce guide vous apprend à utiliser Linux en ligne de commande – de vos toutes
premières commandes jusqu'à la gestion des paquets sur différentes
distributions. Chaque chapitre explique un sujet et se termine par une série
d'**exercices** à résoudre dans le terminal à droite. Un exercice est coché
automatiquement dès que vous l'avez réussi. La meilleure façon d'apprendre,
c'est de *pratiquer* : lisez, essayez, trompez-vous, et recommencez.

## Qu'est-ce que Linux ?

À proprement parler, **Linux** n'est que le *noyau* (*kernel*) : le programme
qui dialogue avec le matériel et permet aux autres programmes de se partager
le processeur, la mémoire et les disques. Le noyau a été créé par Linus
Torvalds en 1991 et c'est un logiciel libre.

Pour obtenir un système utilisable, il faut bien plus que cela : un shell, des
outils pour gérer les fichiers, un gestionnaire de paquets, peut-être un
environnement de bureau. Une **distribution** (*distro*) rassemble tout cela
en un ensemble prêt à l'emploi. En ce moment, vous utilisez **{{distro}}**.

Les distributions sont regroupées en *familles* qui s'appuient les unes sur
les autres et partagent le même gestionnaire de paquets :

| Famille | Gestionnaire de paquets | Exemples |
|---|---|---|
| Debian | `apt` | Debian, Ubuntu, Linux Mint, Pop!_OS |
| Arch | `pacman` | Arch Linux, Manjaro, EndeavourOS |
| Red Hat | `dnf` | Fedora, RHEL, Rocky Linux, AlmaLinux |

La plupart de ce que vous apprendrez dans ce guide fonctionne de la même
manière partout. Ce qui diffère – principalement la gestion des paquets – a
droit à ses propres chapitres. Vous pouvez changer de distribution à tout
moment depuis le menu en haut de la page.

## Qu'est-ce qu'un shell ?

Un **shell** est le programme qui lit les commandes que vous tapez et les
exécute. Le shell le plus répandu est **bash**, celui par défaut sur presque
toutes les distributions. D'autres shells populaires sont **zsh** (celui par
défaut sur macOS) et **fish**. Les bases sont les mêmes dans tous.

Notez la différence entre un *terminal* et un *shell* : le terminal est la
fenêtre qui affiche le texte, et le shell est le programme qui tourne à
l'intérieur.

## L'invite de commande

Quand le shell attend une commande, il affiche une **invite** (*prompt*). Sur
{{distro}}, elle ressemble à peu près à ceci :

:::debian
```text
elev@{{hostname}}:~$
```
:::

:::arch
```text
[elev@{{hostname}} ~]$
```
:::

:::redhat
```text
[elev@{{hostname}} ~]$
```
:::

Elle vous indique qui vous êtes (`elev`), sur quel ordinateur vous vous
trouvez (`{{hostname}}`) et où vous êtes dans le système de fichiers (`~`
désigne votre répertoire personnel). Le signe `$` montre que vous êtes un
utilisateur ordinaire. Si vous êtes l'administrateur (*root*), vous verrez un
`#` à la place.

## Votre première commande

Cliquez dans le terminal, tapez la commande ci-dessous et appuyez sur
**Entrée** :

```sh
echo Hej världen
```

`echo` affiche simplement ce que vous lui donnez – ici *Hej världen*, qui
signifie « Bonjour le monde » en suédois. La plupart des commandes suivent le
même schéma :

```text
commande  -options  arguments
ls        -l        /etc
```

La *commande* est le programme à exécuter, les *options* (ou *flags*)
modifient son comportement, et les *arguments* sont ce sur quoi la commande
doit travailler.

## Comment fonctionne le simulateur

Le terminal ici est un **simulateur** qui tourne entièrement dans votre
navigateur. Il se comporte comme un vrai ordinateur Linux, mais rien de ce que
vous faites ne peut endommager votre propre machine – et si vous faites une
bêtise, vous pouvez toujours repartir de zéro avec le bouton *Reset*.

- **Cliquez sur un exemple de code** pour placer la commande dans le terminal.
- **Tab** complète les noms de commandes et de fichiers.
- **Flèches haut/bas** pour parcourir les commandes précédentes.
- **Ctrl+L** efface l'écran et **Ctrl+C** annule la ligne en cours de saisie.
- `help` liste toutes les commandes, et `man commande` affiche une page de
  manuel.

### Quelques mots de suédois

Ce guide a été écrit à l'origine en suédois, c'est pourquoi l'utilisateur et
les fichiers d'exercice du simulateur ont des noms suédois. Pas besoin de
parler suédois – les commandes sont exactement les mêmes – mais ce petit
glossaire peut vous aider :

| Nom | Signification |
|---|---|
| `elev` | élève (votre nom d'utilisateur) |
| `dokument` | documents |
| `anteckningar.txt` | notes |
| `frukter.txt` | fruits |
| `betyg.csv` | notes scolaires |
| `bilder` | images |
| `gammalt` | vieilleries |
