# AUR, PPA et COPR

Les dépôts de la distribution contiennent des dizaines de milliers de paquets
– mais pas tout. Un programme de niche peut en être complètement absent, ou
n'y figurer que dans une ancienne version. C'est pourquoi il existe des
**dépôts supplémentaires** où développeurs et utilisateurs partagent leurs
propres paquets. Chaque famille a le sien : les **PPA** sur Ubuntu, l'**AUR**
sur Arch et **COPR** sur Fedora.

Dans ce chapitre, vous installez le même programme imaginaire, `moonphase` (il
affiche la phase de la lune dans le terminal), depuis le dépôt supplémentaire
de {{distro}}. Changez de distribution dans le menu si vous voulez comparer
avec le fonctionnement des autres familles.

## Pratique – mais à vos risques et périls

Les paquets des dépôts officiels de la distribution sont testés ensemble,
signés et vérifiés par les développeurs de la distribution. Un dépôt
supplémentaire, en revanche, peut être créé par n'importe qui. Gardez cela en
tête avant d'en ajouter un :

- **Les paquets sont installés en root.** Un paquet peut faire absolument
  n'importe quoi à l'ordinateur. Vous faites autant confiance à la personne
  qui l'a construit qu'à la distribution.
- **Il peut y avoir des conflits.** Un paquet d'un dépôt supplémentaire peut
  remplacer les bibliothèques du système ou exiger d'autres versions que
  celles que vous avez.
- **Il peut cesser d'être mis à jour.** Si la personne qui gère le dépôt s'en
  désintéresse, vous ne recevez plus de mises à jour de sécurité pour le
  programme.

Une bonne règle empirique : cherchez d'abord dans les dépôts de la
distribution, puis un Flatpak (chapitre suivant), et seulement ensuite dans un
dépôt supplémentaire tenu par quelqu'un en qui vous avez confiance.

## Trois familles, trois solutions

| | PPA | AUR | COPR |
|---|---|---|---|
| Famille | Ubuntu (et par ex. Linux Mint) | Arch (et par ex. Manjaro, EndeavourOS) | Fedora (et la famille RHEL) |
| Site web | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| Ce que vous téléchargez | Des paquets `.deb` tout prêts | Une recette de construction (`PKGBUILD`) – vous construisez vous-même | Des paquets `.rpm` tout prêts |
| Pour l'ajouter | `add-apt-repository ppa:…` | `git clone …` et `makepkg -si` | `dnf copr enable …` |
| Vérifié par la distribution | Non | Non | Non |

:::debian
## Les PPA sur {{distro}}

Un **PPA** (*Personal Package Archive*) est un petit dépôt hébergé sur
Launchpad, le service de Canonical pour Ubuntu. Le développeur y envoie le
code source et Launchpad construit des paquets `.deb` pour les différentes
versions d'Ubuntu. Un PPA s'écrit `ppa:utilisateur/nom`.

### L'outil add-apt-repository

On ajoute les PPA avec `add-apt-repository`, qui se trouve dans le paquet
`software-properties-common`. Il est préinstallé sur Ubuntu, mais pas sur
Debian :

```sh
sudo apt update
sudo apt install software-properties-common
```

### Ajouter le PPA

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

Vous voyez ce qui va être ajouté ainsi qu'une description du PPA. Appuyez sur
Entrée pour continuer (avec `-y`, vous sautez la question). Deux choses se
produisent :

1. Un fichier est créé dans `/etc/apt/sources.list.d/`. Il indique où se
   trouve le dépôt et contient la clé avec laquelle les paquets sont signés.
2. `add-apt-repository` lance `apt update` pour vous – sinon apt ne
   connaîtrait pas les nouveaux paquets. Si vous ajoutez une source à la main
   (en créant un fichier), vous devez lancer `sudo apt update` vous-même
   ensuite.

Regardez le fichier :

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

Remarquez `Suites: noble` – les paquets sont construits pour Ubuntu 24.04.

### Installer et lancer

Le paquet s'installe maintenant comme n'importe quel autre :

```sh
sudo apt install moonphase
moonphase
```

### D'où vient le paquet ?

`apt policy` montre dans quels dépôts se trouve un paquet et lequel
l'emporte :

```sh
apt policy moonphase
```

`***` marque la version installée. Le nombre `500` est la priorité du dépôt et
`100` signifie « ce qui est déjà installé ». Si le même paquet se trouve dans
plusieurs dépôts, apt choisit la version la plus élevée – un PPA peut donc
remplacer l'un des paquets de la distribution par sa propre version.

### Des PPA sur Debian ?

Les PPA sont construits pour Ubuntu, pas pour Debian. Sur Debian, ils peuvent
fonctionner, mais les paquets peuvent exiger d'autres versions de
bibliothèques que celles de Debian. Un mélange de paquets Debian et Ubuntu est
appelé en plaisantant un *FrankenDebian*, et c'est un moyen courant de casser
le système. Sur Debian, mieux vaut utiliser les *backports*, un Flatpak ou le
dépôt Debian du développeur lui-même.

### Supprimer un PPA

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

Le programme reste, mais ne reçoit plus de mises à jour. Pour vous en
débarrasser complètement, lancez aussi `sudo apt remove moonphase`.
:::

:::arch
## L'AUR sur {{distro}}

L'**AUR** (*Arch User Repository*) est différent des autres : il ne contient
pas de paquets tout prêts, seulement des **recettes de construction**. Une
recette s'appelle `PKGBUILD` ; c'est un petit script bash qui indique où se
trouve le code source et comment construire le programme. Vous téléchargez la
recette, construisez le paquet vous-même et l'installez avec pacman. L'AUR
est immense – on y trouve presque tout ce qui existe pour Linux – mais
n'importe qui peut y publier une recette.

### Préparatifs

Pour télécharger des recettes et construire des paquets, il vous faut `git` et
`base-devel` (un compilateur, `make`, `fakeroot` et d'autres outils) :

```sh
sudo pacman -S --needed git base-devel
```

`--needed` ignore ce qui est déjà installé.

### Récupérer la recette

Chaque paquet de l'AUR est un dépôt git à part entière :

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> Si vous faites une faute de frappe dans le nom du paquet, git affiche
> *"You appear to have cloned an empty repository"* et le répertoire est
> vide. L'AUR vous laisse cloner n'importe quoi !

### Lisez le PKGBUILD – à chaque fois

```sh
less PKGBUILD
```

`PKGBUILD` est un script qui s'exécute sur votre ordinateur. Vérifiez au
moins :

- que `source=` télécharge depuis le vrai site web du programme,
- que `build()` et `package()` ne font que construire et copier des fichiers –
  et ne téléchargent pas, par exemple, quelque chose d'autre pour l'exécuter
  (`curl … | sh`),
- que le paquet a l'air maintenu (dates, commentaires sur aur.archlinux.org).

### Construire et installer

```sh
makepkg -si
```

`makepkg` lit `PKGBUILD`, télécharge le code source, le construit et l'emballe
dans un fichier `.pkg.tar.zst`. `-s` installe les dépendances manquantes et
`-i` installe le paquet avec pacman une fois terminé. Ne lancez **pas**
makepkg avec sudo – il refuse de tourner en root et utilise sudo de lui-même
quand c'est nécessaire.

```sh
ls
moonphase
```

### Les paquets « étrangers »

pacman ne sait rien de l'AUR. Les paquets qui ne viennent pas des dépôts sont
appelés *foreign* (étrangers) et se listent avec :

```sh
pacman -Qm
```

Cela signifie aussi que `sudo pacman -Syu` ne met **pas** à jour les paquets
de l'AUR. Vous devez récupérer vous-même la nouvelle recette (`git pull`) et
reconstruire – ou laisser un assistant AUR s'en charger.

### L'assistant AUR yay

Un assistant AUR (*AUR helper*) fait tout cela pour vous : il cherche,
télécharge, affiche le `PKGBUILD`, construit et installe. Le plus courant est
**yay** (un autre est *paru*). yay lui-même n'existe que dans l'AUR, il
s'installe donc une fois à la main. Le paquet `yay-bin` est précompilé et
c'est le plus rapide :

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

Ensuite, yay s'utilise à peu près comme pacman – mais sans sudo :

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (ou simplement `yay`) met à jour à la fois les paquets des dépôts
et vos paquets de l'AUR. Le confort ne vous dispense pas de lire les
recettes !
:::

:::redhat
## COPR sur {{distro}}

**COPR** (*Cool Other Package Repo*) est le service de construction de Fedora.
Toute personne ayant un compte Fedora peut y construire des paquets `.rpm`, et
chaque projet devient un dépôt à part entière nommé `utilisateur/projet`.

### Les dépôts que vous avez maintenant

```sh
dnf repolist
```

### Activer un dépôt COPR

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf vous rappelle que le dépôt ne fait pas partie de Fedora et que la qualité
peut varier. La réponse par défaut est **Non**, répondez donc `y`. Un nouveau
fichier est créé dans `/etc/yum.repos.d/` :

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

### Installer et lancer

dnf récupère de lui-même les informations du nouveau dépôt, le paquet peut
donc être installé tout de suite :

```sh
sudo dnf install moonphase
moonphase
```

### D'où vient le paquet ?

```sh
dnf info moonphase
```

La ligne `From repository` montre que le paquet vient de COPR. Les paquets de
COPR sont mis à jour comme d'habitude avec `sudo dnf upgrade`.

### Désactiver ou supprimer

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` laisse le fichier en place mais désactive le dépôt, `remove` le
supprime complètement. Le programme reste, mais ne reçoit plus de mises à
jour.

### RPM Fusion

Un autre dépôt supplémentaire courant pour Fedora est **RPM Fusion**. Il
contient ce que Fedora ne peut pas ou ne veut pas inclure, comme certains
codecs multimédias et pilotes. C'est un grand projet collectif – pas le dépôt
d'un seul utilisateur comme avec COPR.
:::

## Mises à jour et entretien

| | Mis à jour avec | Supprimer le dépôt |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu` – ou reconstruire vous-même | – (il n'y a pas de dépôt à supprimer) |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

Les dépôts supplémentaires sont un outil puissant, mais chaque dépôt que vous
ajoutez est une source de plus à laquelle vous faites confiance. Gardez la
liste courte et faites le ménage dans ce que vous n'utilisez plus.
