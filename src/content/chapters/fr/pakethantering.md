# La gestion des paquets

Sous Windows et macOS, on télécharge souvent les programmes depuis un site
web. Sous Linux, on installe plutôt presque tout avec un **gestionnaire de
paquets**. C'est la plus grande différence entre les familles de
distributions – et ce chapitre change selon la distribution que vous avez
choisie. En ce moment, c'est **{{pm}}** sur {{distro}}.

## Paquets, dépôts et dépendances

- Un **paquet** est un programme (ou une bibliothèque) emballé dans un
  fichier, avec des informations sur sa version et ce dont il a besoin.
- Un **dépôt** (*repository*) est un serveur sur lequel la distribution publie
  tous ses paquets. Ils sont testés et signés, vous savez donc qu'ils n'ont
  pas été trafiqués.
- Une **dépendance** est un autre paquet nécessaire. Le gestionnaire de
  paquets installe les dépendances automatiquement.

Le gestionnaire de paquets garde aussi la trace de ce qui est installé, et
peut mettre à jour *tout* l'ordinateur en une seule commande.

## La même chose – trois dialectes

| Quoi | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Rafraîchir la liste des paquets | `apt update` | `pacman -Sy` | `dnf check-update` |
| Tout mettre à jour | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Installer | `apt install X` | `pacman -S X` | `dnf install X` |
| Supprimer | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Rechercher | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Infos sur un paquet | `apt show X` | `pacman -Si X` | `dnf info X` |
| Lister les paquets installés | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

Les commandes qui modifient le système nécessitent les droits root, on les
lance donc avec `sudo`.

:::debian
## apt sur {{distro}}

### update et upgrade sont deux choses différentes

Presque tout le monde s'y perd au début :

- `apt update` télécharge la **liste** des paquets et des versions
  disponibles. Elle n'installe rien.
- `apt upgrade` **installe** les nouvelles versions de ce que vous avez déjà.

Lancez donc toujours `update` en premier. La façon la plus courante de mettre
à jour le système est :

```sh
sudo apt update && sudo apt upgrade
```

Tant que vous n'avez pas lancé `apt update` (sur un serveur fraîchement
installé, par exemple), la liste des paquets est vide et apt ne trouve aucun
paquet.

### Installer et supprimer

```sh
sudo apt install htop
```

`apt remove` supprime un programme mais laisse ses fichiers de configuration.
`apt purge` les supprime aussi. Quand apt demande
`Do you want to continue? [Y/n]`, le `Y` majuscule signifie qu'il suffit
d'appuyer sur Entrée pour répondre oui. Avec l'option `-y`, apt répond oui
automatiquement.

### apt ou apt-get ?

`apt` est la variante moderne et conviviale, avec barre de progression et
couleurs. `apt-get` et `apt-cache` sont plus anciens mais ont une sortie plus
stable, c'est pourquoi on les utilise encore dans les scripts.

### Sous le capot : dpkg et .deb

Les paquets sont des fichiers `.deb`, et c'est en fait le programme `dpkg` qui
les décompresse. apt s'occupe de tout le reste : téléchargement, dépendances
et mises à jour.
:::

:::arch
## pacman sur {{distro}}

pacman utilise des options courtes où la **majuscule** est l'opération et les
minuscules sont des modificateurs :

| Option | Signifie |
|---|---|
| `-S` | Sync – installer depuis les dépôts |
| `-R` | Remove – supprimer |
| `-Q` | Query – interroger les paquets installés |
| `y` | Rafraîchir la base de données des paquets |
| `u` | Mettre à jour tous les paquets |
| `s` | Rechercher (avec -S et -Q), ou supprimer les dépendances (avec -R) |
| `i` | Infos |

### Mettre à jour le système

```sh
sudo pacman -Syu
```

`-Syu` signifie : synchroniser (`S`), rafraîchir la base de données (`y`) et
tout mettre à jour (`u`). Arch est une *rolling release*, vous lancerez donc
cette commande souvent.

> **Important !** Ne lancez jamais simplement `pacman -Sy` suivi de
> `pacman -S paquet`. Le nouveau paquet pourrait alors avoir besoin de
> bibliothèques plus récentes que celles que vous avez – une *mise à jour
> partielle* (*partial upgrade*) qui peut casser votre système. Utilisez
> toujours `-Syu`.

### Installer et supprimer

```sh
sudo pacman -S htop
```

`pacman -R paquet` supprime un paquet, et `pacman -Rs paquet` supprime aussi
les dépendances dont plus rien n'a besoin.

### L'AUR

En plus des dépôts officiels, il existe l'**AUR** (*Arch User Repository*), où
les utilisateurs partagent des recettes de compilation pour des milliers de
programmes. On utilise souvent un assistant comme `yay` ou `paru` pour
installer depuis l'AUR. Les paquets de l'AUR ne sont pas vérifiés par Arch –
lisez toujours d'abord la recette de compilation (le PKGBUILD).
:::

:::redhat
## dnf sur {{distro}}

### Des métadonnées automatiques

dnf récupère tout seul les nouvelles informations sur les paquets quand il en
a besoin, il n'y a donc pas d'étape séparée comme `apt update`. Si vous voulez
voir quelles mises à jour sont disponibles, lancez :

```sh
dnf check-update
```

Le code de retour vaut `100` s'il y a des mises à jour – pratique dans les
scripts.

### Installer et supprimer

```sh
sudo dnf install htop
```

Remarquez la question `Is this ok [y/N]`. Le `N` majuscule signifie que
**Non** est la réponse par défaut – si vous appuyez simplement sur Entrée,
l'installation est annulée. Tapez `y` puis Entrée, ou utilisez `-y`.

### Mettre à jour le système

```sh
sudo dnf upgrade
```

### Sous le capot : rpm

Les paquets sont des fichiers `.rpm` et l'outil bas niveau s'appelle `rpm`.
dnf a remplacé l'ancien `yum`, et Fedora 41 a apporté la nouvelle version
**dnf5**, nettement plus rapide. Sur RHEL, Rocky et AlmaLinux, la commande
s'appelle aussi `dnf`.
:::

## Même programme, noms différents

Les paquets ont généralement le même nom partout – mais pas toujours.
Quelques exemples :

| Programme | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| Client SSH | `openssh-client` | `openssh` | `openssh-clients` |

En cas de doute sur le nom, cherchez toujours avec le gestionnaire de
paquets.

## Les formats de paquets universels

Il existe aussi des formats qui fonctionnent sur toutes les distributions :
**Flatpak** (courant pour les applications de bureau, via Flathub), **Snap**
(de Canonical, par défaut sur Ubuntu) et **AppImage** (un seul fichier
exécutable). Ils ont leurs propres commandes et complètent le gestionnaire de
paquets de la distribution.
