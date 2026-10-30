# La famille Red Hat : dnf et COPR

Fedora, Red Hat Enterprise Linux (RHEL) et les clones de RHEL comme Rocky
Linux forment la **famille Red Hat**. Elles utilisent le gestionnaire de
paquets **dnf** et des paquets au format `.rpm`. Ce chapitre tourne toujours
sur une distribution de la famille Red Hat – en ce moment, c'est
**{{distro}}**.

## dnf en bref

| Quoi | Commande |
|---|---|
| Rafraîchir la liste des paquets | `dnf check-update` |
| Tout mettre à jour | `dnf upgrade` |
| Installer | `dnf install X` |
| Supprimer | `dnf remove X` |
| Rechercher | `dnf search X` |
| Infos sur un paquet | `dnf info X` |
| Lister les paquets installés | `dnf list --installed` |

Les commandes qui modifient le système nécessitent les droits root, on les
lance donc avec `sudo`.

## Des métadonnées automatiques

dnf récupère tout seul les nouvelles informations sur les paquets quand il en
a besoin, il n'y a donc pas d'étape séparée comme `apt update` dans la famille
Debian. Si vous voulez voir quelles mises à jour sont disponibles, lancez :

```sh
dnf check-update
```

`dnf check-update` n'a pas besoin des droits root. Le code de retour vaut
`100` s'il y a des mises à jour – pratique dans les scripts. Dans le
simulateur, des mises à jour sont en attente. Qu'est-ce que ceci affiche ?

```predict
$ dnf check-update > /dev/null; echo $?
100
---
`> /dev/null` masque la liste, et `$?` est le code de retour de la dernière
commande : `100` signifie qu'il y a des mises à jour.
```

## Installer et supprimer

```sh
sudo dnf install htop
```

Remarquez la question `Is this ok [y/N]`. Le `N` majuscule signifie que
**Non** est la réponse par défaut – si vous appuyez simplement sur Entrée,
l'installation est annulée. Tapez `y` puis Entrée, ou utilisez `-y`.

```quiz
dnf demande `Is this ok [y/N]` et vous appuyez simplement sur Entrée. Que se passe-t-il ?
- [ ] Le paquet est installé
- [x] L'installation est annulée
- [ ] dnf repose la question
---
La lettre majuscule est la réponse par défaut. Dans la famille Debian, apt
demande `[Y/n]`, donc Entrée y signifie oui.
```

`dnf remove paquet` supprime à nouveau un paquet.

## Mettre à jour le système

```sh
sudo dnf upgrade
```

## Sous le capot : rpm

Les paquets sont des fichiers `.rpm` et l'outil bas niveau s'appelle `rpm`.
dnf a remplacé l'ancien `yum`, et Fedora 41 a apporté la nouvelle version
**dnf5**, nettement plus rapide. Sur RHEL, Rocky et AlmaLinux, la commande
s'appelle aussi `dnf`.

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

## COPR

**COPR** (*Cool Other Package Repo*) est le service de construction de Fedora.
Toute personne ayant un compte Fedora peut y construire des paquets `.rpm`, et
chaque projet devient un dépôt à part entière nommé `utilisateur/projet`. Les
dépôts COPR ne sont pas vérifiés par la distribution.

Dans la suite de ce chapitre, vous installez un programme imaginaire,
`moonphase` (il affiche la phase de la lune dans le terminal), depuis COPR.

### Les dépôts que vous avez maintenant

```sh
dnf repolist
```

```try
dnf repolist
---
Ce sont les dépôts officiels de Fedora.
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

```quiz
Toute personne ayant un compte Fedora peut construire des paquets dans COPR. Qui les vérifie ?
- [ ] Les développeurs de Fedora, avant leur publication
- [ ] Red Hat
- [x] Personne – vous devez faire confiance à la personne qui gère le dépôt
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

```quiz
Quelle est la différence entre `dnf copr disable` et `dnf copr remove` ?
- [x] `disable` désactive le dépôt mais laisse le fichier, `remove` le supprime
- [ ] `disable` désinstalle aussi les paquets, `remove` non
- [ ] Il n'y a aucune différence
```

### RPM Fusion

Un autre dépôt supplémentaire courant pour Fedora est **RPM Fusion**. Il
contient ce que Fedora ne peut pas ou ne veut pas inclure, comme certains
codecs multimédias et pilotes. C'est un grand projet collectif – pas le dépôt
d'un seul utilisateur comme avec COPR.

Chaque dépôt que vous ajoutez est une source de plus à laquelle vous faites
confiance. Gardez la liste courte et faites le ménage dans ce que vous
n'utilisez plus.
