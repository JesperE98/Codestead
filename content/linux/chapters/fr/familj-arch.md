# La famille Arch : pacman et l'AUR

Arch Linux et les distributions qui en dérivent, comme Manjaro et
EndeavourOS, forment la **famille Arch**. Elles utilisent le gestionnaire de
paquets **pacman** et des paquets au format `.pkg.tar.zst`. Ce chapitre tourne
toujours sur une distribution de la famille Arch – en ce moment, c'est
**{{distro}}**.

## pacman en bref

| Quoi | Commande |
|---|---|
| Rafraîchir la liste des paquets | `pacman -Sy` |
| Tout mettre à jour | `pacman -Syu` |
| Installer | `pacman -S X` |
| Supprimer | `pacman -R X` |
| Rechercher | `pacman -Ss X` |
| Infos sur un paquet | `pacman -Si X` |
| Lister les paquets installés | `pacman -Q` |

Les commandes qui modifient le système nécessitent les droits root, on les
lance donc avec `sudo`.

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

```quiz
Que signifie le `Q` majuscule dans `pacman -Q` ?
- [ ] Quit – arrêter pacman
- [x] Query – interroger les paquets installés
- [ ] Quick – installer sans poser de question
---
`-Q` interroge ce qui est installé, `-S` installe depuis les dépôts et `-R`
supprime.
```

La recherche n'a pas besoin des droits root. Essayez :

```try
pacman -Ss htop
```

## Mettre à jour le système

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

```quiz
Pourquoi ne faut-il pas lancer `pacman -Sy` puis `pacman -S paquet` ?
- [ ] Parce que `-Sy` supprime la base de données des paquets
- [x] Le nouveau paquet peut avoir besoin de bibliothèques plus récentes que les vôtres, ce qui peut casser le système
- [ ] Parce que pacman ne peut installer qu'un paquet par jour
---
Mettez toujours tout à jour d'un coup avec `-Syu`.
```

## Installer et supprimer

```sh
sudo pacman -S htop
```

`pacman -R paquet` supprime un paquet, et `pacman -Rs paquet` supprime aussi
les dépendances dont plus rien n'a besoin.

## L'AUR

Les dépôts de la distribution contiennent des dizaines de milliers de paquets
– mais pas tout. Un programme de niche peut en être complètement absent, ou
n'y figurer que dans une ancienne version. Dans la famille Arch, la réponse
est l'**AUR** (*Arch User Repository*).

L'AUR est différent des dépôts ordinaires : il ne contient pas de paquets tout
prêts, seulement des **recettes de construction**. Une recette s'appelle
`PKGBUILD` ; c'est un petit script bash qui indique où se trouve le code
source et comment construire le programme. Vous téléchargez la recette,
construisez le paquet vous-même et l'installez avec pacman. L'AUR est immense
– on y trouve presque tout ce qui existe pour Linux – mais n'importe qui peut
y publier une recette.

```quiz
Que téléchargez-vous depuis l'AUR ?
- [ ] Un paquet `.pkg.tar.zst` tout prêt, vérifié par Arch
- [x] Une recette de construction (`PKGBUILD`) à partir de laquelle vous construisez le paquet vous-même
- [ ] Un Flatpak
```

### À vos risques et périls

Les paquets des dépôts officiels de la distribution sont testés ensemble,
signés et vérifiés par les développeurs de la distribution. Les paquets de
l'AUR ne sont pas vérifiés par Arch. Gardez cela en tête :

- **Les paquets sont installés en root.** Un paquet peut faire absolument
  n'importe quoi à l'ordinateur. Vous faites autant confiance à la personne
  qui a écrit la recette qu'à la distribution.
- **Il peut y avoir des conflits.** Un paquet peut remplacer les bibliothèques
  du système ou exiger d'autres versions que celles que vous avez.
- **Il peut cesser d'être mis à jour.** Si la personne qui maintient la
  recette s'en désintéresse, vous ne recevez plus de mises à jour de sécurité
  pour le programme.

Une bonne règle empirique : cherchez d'abord dans les dépôts de la
distribution, puis un Flatpak (dans le chapitre sur les paquets universels),
et seulement ensuite dans l'AUR.

Dans la suite de ce chapitre, vous installez un programme imaginaire,
`moonphase` (il affiche la phase de la lune dans le terminal), depuis l'AUR.

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

```quiz
Vous avez installé `moonphase` depuis l'AUR et lancez `sudo pacman -Syu`.
`moonphase` est-il mis à jour ?
- [ ] Oui – pacman met à jour tous les paquets installés
- [x] Non – pacman ne sait rien de l'AUR
---
Récupérez la nouvelle recette avec `git pull` et reconstruisez, ou utilisez un
assistant AUR.
```

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

Il n'y a pas de dépôt à supprimer pour l'AUR – chaque paquet est sa propre
recette. Faites le ménage dans ce que vous n'utilisez plus.
