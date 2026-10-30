# Résumé : distributions et paquets

## Les familles

La base est la même sur toutes les distributions : le noyau Linux, bash et
les outils GNU, l'organisation des répertoires et (presque partout) systemd.
Ce qui distingue les familles, c'est surtout la façon d'installer les
programmes.

| | Famille Debian | Famille Arch | Famille Red Hat |
|---|---|---|---|
| Exemples | Debian, Ubuntu, Linux Mint | Arch, Manjaro, EndeavourOS | Fedora, RHEL, Rocky Linux |
| Gestionnaire de paquets | `apt` | `pacman` | `dnf` |
| Format des paquets | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Outil bas niveau | `dpkg` | (pacman) | `rpm` |
| Groupe sudo | `sudo` | `wheel` | `wheel` |
| Publications | Versions stables | En continu (rolling) | Une nouvelle version tous les 6 mois (Fedora) |

- `cat /etc/os-release` montre quelle distribution vous utilisez, et
  `uname -r` montre la version du noyau.
- Un **paquet** est un programme emballé dans un fichier, un **dépôt** est un
  serveur contenant les paquets testés et signés de la distribution, et une
  **dépendance** est un autre paquet nécessaire – le gestionnaire de paquets
  l'installe automatiquement.
- Les commandes qui modifient le système nécessitent les droits root, on les
  lance donc avec `sudo`.

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

À retenir :

- **apt** : `apt update` ne fait que télécharger la liste des paquets –
  `apt upgrade` installe les nouvelles versions. Lancez `update` en premier.
  `[Y/n]` signifie qu'Entrée répond oui.
- **pacman** : la lettre majuscule est l'opération (`-S`, `-R`, `-Q`) et les
  lettres minuscules sont des modificateurs. Mettez toujours à jour avec
  `-Syu` – jamais `-Sy` suivi de `-S package` (une mise à jour partielle peut
  casser le système).
- **dnf** : récupère tout seul les informations sur les paquets.
  `dnf check-update` se termine avec `100` quand il y a des mises à jour.
  `[y/N]` signifie qu'Entrée répond **non**.

Les paquets ont généralement le même nom partout, mais pas toujours – Vim
s'appelle `vim-enhanced` dans Fedora. Cherchez en cas de doute.

## Les dépôts supplémentaires

| | PPA | AUR | COPR |
|---|---|---|---|
| Famille | Ubuntu (et p. ex. Linux Mint) | Arch (et p. ex. Manjaro, EndeavourOS) | Fedora (et la famille RHEL) |
| Ce que vous téléchargez | Des paquets `.deb` tout prêts | Une recette de construction (`PKGBUILD`) – vous construisez vous-même | Des paquets `.rpm` tout prêts |
| Ajout | `add-apt-repository ppa:…` | `git clone …` et `makepkg -si` | `dnf copr enable …` |
| Mis à jour avec | `sudo apt update && sudo apt upgrade` | `yay -Syu` – ou en reconstruisant vous-même | `sudo dnf upgrade` |
| Supprimer le dépôt | `sudo add-apt-repository --remove ppa:…` | – (il n'y a pas de dépôt à supprimer) | `sudo dnf copr remove …` |
| Vérifié par la distribution | Non | Non | Non |

- Les paquets d'un dépôt supplémentaire sont installés en root, peuvent
  entrer en conflit avec les paquets du système et peuvent cesser d'être mis
  à jour. Cherchez d'abord dans les dépôts de la distribution, puis un
  Flatpak, et seulement ensuite dans un dépôt supplémentaire tenu par
  quelqu'un en qui vous avez confiance.
- `apt policy` montre d'où vient un paquet ; apt choisit la version la plus
  élevée.
- Lisez toujours le `PKGBUILD` avant de construire. Ne lancez pas `makepkg`
  avec sudo. `pacman -Qm` liste les paquets *foreign* (étrangers), et
  `pacman -Syu` ne les met pas à jour – un assistant AUR comme `yay` le fait.

## Les paquets universels

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| Provenance | Flathub (ou d'autres *remotes*) | Snap Store (Canonical) | Le site web du développeur |
| Bac à sable | Oui | Oui (sauf *classic*) | Non |
| Mises à jour | `flatpak update` | Automatiquement en arrière-plan | Vous-même – téléchargez un nouveau fichier |
| Installation | `flatpak install flathub ID` | `sudo snap install name` | `chmod +x file` puis lancez-le |

- Les programmes Flatpak ont un ID écrit comme un nom de domaine inversé
  (`org.gimp.GIMP`) et se lancent avec `flatpak run`. `--user` installe dans
  votre répertoire personnel, avec ses propres remotes.
- Snap est la valeur par défaut sur Ubuntu. Les snaps en confinement classique
  ont besoin de `--classic`, et chaque snap a des canaux comme `stable` et
  `edge`.
- Une AppImage a besoin de FUSE 2 (`libfuse2t64` sur Ubuntu 24.04 et
  Debian 13, `fuse2` sur Arch, `fuse-libs` sur Fedora) et n'a ni bac à sable
  ni mises à jour automatiques.

**Règle empirique :** les paquets de la distribution pour les programmes
système et en ligne de commande, Flatpak pour les programmes de bureau, Snap
sur Ubuntu ou quand un programme n'existe qu'en snap, et AppImage pour
essayer rapidement un programme.
