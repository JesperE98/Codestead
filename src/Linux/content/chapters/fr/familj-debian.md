# La famille Debian : apt et les PPA

Debian, Ubuntu et les distributions qui en dérivent, comme Linux Mint, forment
la **famille Debian**. Elles utilisent toutes le gestionnaire de paquets
**apt** et des paquets au format `.deb`. Ce chapitre tourne toujours sur une
distribution de la famille Debian – en ce moment, c'est **{{distro}}**. Vous
pouvez passer d'Ubuntu à Debian dans le menu en haut.

## apt en bref

| Quoi | Commande |
|---|---|
| Rafraîchir la liste des paquets | `apt update` |
| Tout mettre à jour | `apt upgrade` |
| Installer | `apt install X` |
| Supprimer | `apt remove X` |
| Rechercher | `apt search X` |
| Infos sur un paquet | `apt show X` |
| Lister les paquets installés | `apt list --installed` |

Les commandes qui modifient le système nécessitent les droits root, on les
lance donc avec `sudo`.

```quiz
Lesquelles de ces commandes modifient le système et ont donc besoin de `sudo` ?
- [x] `apt install htop`
- [ ] `apt search htop`
- [x] `apt remove htop`
- [ ] `apt show htop`
---
Rechercher et afficher des informations ne font que lire les listes de
paquets. Installer et supprimer modifient le système.
```

## update et upgrade sont deux choses différentes

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

```quiz
Que fait `sudo apt update` ?
- [x] Elle télécharge la liste des paquets et des versions disponibles
- [ ] Elle installe les nouvelles versions des paquets que vous avez déjà
- [ ] Elle met à jour apt lui-même vers la dernière version
---
`apt update` ne fait que rafraîchir la liste. C'est `apt upgrade` qui installe
les nouvelles versions.
```

## Installer et supprimer

```sh
sudo apt install htop
```

`apt remove` supprime un programme mais laisse ses fichiers de configuration.
`apt purge` les supprime aussi. Quand apt demande
`Do you want to continue? [Y/n]`, le `Y` majuscule signifie qu'il suffit
d'appuyer sur Entrée pour répondre oui. Avec l'option `-y`, apt répond oui
automatiquement.

La recherche n'a pas besoin des droits root. Essayez :

```try
apt search htop
```

### apt ou apt-get ?

`apt` est la variante moderne et conviviale, avec barre de progression et
couleurs. `apt-get` et `apt-cache` sont plus anciens mais ont une sortie plus
stable, c'est pourquoi on les utilise encore dans les scripts.

### Sous le capot : dpkg et .deb

Les paquets sont des fichiers `.deb`, et c'est en fait le programme `dpkg` qui
les décompresse. apt s'occupe de tout le reste : téléchargement, dépendances
et mises à jour.

## Les dépôts supplémentaires – pratiques, mais à vos risques et périls

Les dépôts de la distribution contiennent des dizaines de milliers de paquets
– mais pas tout. Un programme de niche peut en être complètement absent, ou
n'y figurer que dans une ancienne version. C'est pourquoi il existe des
**dépôts supplémentaires** où développeurs et utilisateurs partagent leurs
propres paquets.

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
distribution, puis un Flatpak (dans le chapitre sur les paquets universels),
et seulement ensuite dans un dépôt supplémentaire tenu par quelqu'un en qui
vous avez confiance.

## Les PPA

Un **PPA** (*Personal Package Archive*) est un petit dépôt hébergé sur
Launchpad, le service de Canonical pour Ubuntu. Le développeur y envoie le
code source et Launchpad construit des paquets `.deb` pour les différentes
versions d'Ubuntu. Un PPA s'écrit `ppa:utilisateur/nom`. Les PPA ne sont pas
vérifiés par la distribution.

Dans la suite de ce chapitre, vous installez un programme imaginaire,
`moonphase` (il affiche la phase de la lune dans le terminal), depuis un PPA.

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

```quiz
Vous ajoutez un dépôt à la main, en créant un fichier dans
`/etc/apt/sources.list.d/`. Que devez-vous faire avant qu'apt puisse en
installer des paquets ?
- [ ] Rien – apt lit le fichier tout seul à la prochaine installation
- [x] Lancer `sudo apt update`
- [ ] Redémarrer l'ordinateur
---
`add-apt-repository` lance `apt update` pour vous. Quand vous créez le fichier
vous-même, vous devez le faire vous-même.
```

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

```quiz
Le même paquet se trouve à la fois dans le dépôt de la distribution et dans un
PPA que vous avez ajouté. Quelle version apt choisit-il ?
- [ ] Toujours celle du dépôt de la distribution
- [ ] Celle du dépôt ajouté en dernier
- [x] La version la plus élevée
---
C'est pourquoi un PPA peut remplacer l'un des paquets de la distribution.
```

### Des PPA sur Debian ?

Les PPA sont construits pour Ubuntu, pas pour Debian. Sur Debian, ils peuvent
fonctionner, mais les paquets peuvent exiger d'autres versions de
bibliothèques que celles de Debian. Un mélange de paquets Debian et Ubuntu est
appelé en plaisantant un *FrankenDebian*, et c'est un moyen courant de casser
le système. Sur Debian, mieux vaut utiliser les *backports*, un Flatpak ou le
dépôt Debian du développeur lui-même.

### Mises à jour et suppression d'un PPA

Les paquets d'un PPA sont mis à jour avec tout le reste, avec
`sudo apt update && sudo apt upgrade`. Pour supprimer le PPA :

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

Le programme reste, mais ne reçoit plus de mises à jour. Pour vous en
débarrasser complètement, lancez aussi `sudo apt remove moonphase`.

Chaque dépôt que vous ajoutez est une source de plus à laquelle vous faites
confiance. Gardez la liste courte et faites le ménage dans ce que vous
n'utilisez plus.
