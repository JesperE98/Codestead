# Flatpak, Snap et AppImage

Un paquet classique est construit pour une distribution et une version bien
précises. Pour qui développe un programme de bureau, c'est un problème : le
même programme doit être empaqueté à nouveau pour Debian, Ubuntu, Fedora, Arch
et toutes leurs versions. Les **formats de paquets universels** résolvent ce
problème en embarquant dans le paquet la plupart de ce dont le programme a
besoin – si bien qu'un seul et même paquet fonctionne sur toutes les
distributions.

Les trois grands sont **Flatpak**, **Snap** et **AppImage**. Ils ne remplacent
pas le gestionnaire de paquets de la distribution mais le complètent,
principalement pour les programmes de bureau.

> Le simulateur n'a qu'un terminal. Quand vous lancez un programme graphique,
> une ligne vous indique qu'il se serait ouvert dans une fenêtre.

## Quatre façons d'installer un programme

| | Paquet de la distribution | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| Provenance | Les dépôts de la distribution | Flathub (ou d'autres *remotes*) | Snap Store (Canonical) | Le site web du développeur |
| Fonctionne sur | Une distribution et une version | Toutes | Toutes celles qui ont `snapd` | Toutes (nécessite FUSE) |
| Bac à sable | Non | Oui | Oui (sauf *classic*) | Non |
| Taille | Petite – partage les bibliothèques avec le système | Grande la première fois (runtimes), ensuite partagée | Grande – chaque snap et sa base | Grande – tout dans un seul fichier |
| Mises à jour | Avec le système (`apt upgrade` …) | `flatpak update` | Automatiques en arrière-plan | À faire vous-même – télécharger un nouveau fichier |
| Idéal pour | Programmes système, outils en ligne de commande, serveurs | Programmes de bureau | Ubuntu, bureaux et serveurs | Programmes isolés, essayer de nouvelles versions |

Un **bac à sable** (*sandbox*) signifie que le programme ne peut accéder qu'à
ce qui lui a été autorisé, par exemple le réseau ou votre dossier de
téléchargements, au lieu de tout votre répertoire personnel.

```quiz
Quel format est mis à jour automatiquement en arrière-plan ?
- [ ] Flatpak
- [x] Snap
- [ ] AppImage
---
Les programmes Flatpak se mettent à jour avec `flatpak update`, et une
AppImage se remplace en téléchargeant un nouveau fichier.
```

## Flatpak

Flatpak est le format sur lequel la plupart des distributions se sont
accordées pour les programmes de bureau. Les programmes sont téléchargés
depuis un **remote** (dépôt distant) – presque toujours **Flathub** – et
partagent des **runtimes** communs (par exemple `org.gnome.Platform`), pour
que chaque programme n'ait pas à tout apporter avec lui.

:::debian
### Installer Flatpak

Flatpak n'est pas préinstallé sur {{distro}} :

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### Installer Flatpak

Flatpak se trouve dans les dépôts d'Arch :

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### Flatpak sur {{distro}}

Fedora Workstation est livré avec Flatpak, et le remote de Fedora, `fedora`,
est déjà ajouté :

```sh
flatpak --version
flatpak remotes
```
:::

### Ajouter Flathub

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` évite que la commande échoue si Flathub est déjà présent –
pratique dans les scripts et les guides d'installation.

### Rechercher, installer et lancer

Chaque programme a un **ID** écrit comme un nom de domaine à l'envers, par
exemple `org.gimp.GIMP` :

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

Flatpak affiche les **permissions** que le programme demande et les runtimes
qui viennent avec. Remarquez la taille : le premier programme entraîne un
runtime de plusieurs centaines de mégaoctets, mais le programme suivant qui
utilise le même runtime est léger.

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### Pour tout le système ou juste pour vous

Sans option, Flatpak installe pour **tout le système** (dans
`/var/lib/flatpak`). Sur un bureau, Flatpak vous demande votre mot de passe
dans une fenêtre, sudo n'est donc pas nécessaire. Avec `--user`, le programme
atterrit plutôt dans votre répertoire personnel (`~/.local/share/flatpak`) et
aucun autre utilisateur ne le voit. L'installation utilisateur a **ses propres
remotes**, il faut donc ajouter Flathub avec `--user` aussi :

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

```quiz
Que se passe-t-il quand vous installez un Flatpak avec `--user` ?
- [ ] Il est installé pour tout le système, dans `/var/lib/flatpak`
- [x] Il atterrit dans votre répertoire personnel, et aucun autre utilisateur ne le voit
- [ ] Il tourne sans bac à sable
---
N'oubliez pas que l'installation utilisateur a ses propres remotes – Flathub
doit aussi être ajouté avec `--user`.
```

### Mettre à jour et supprimer

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` supprime les runtimes qu'aucun programme installé n'utilise plus.

## Snap

Snap est le format de **Canonical** et celui par défaut sur Ubuntu – Firefox,
par exemple, y est un snap. Les snaps viennent du **Snap Store**, géré par
Canonical, et sont pris en charge par le service `snapd`. Ils sont mis à jour
automatiquement en arrière-plan.

:::debian
### Snap sur Ubuntu et Debian

Ubuntu a déjà Snap. Sur Debian, installez d'abord `snapd` :

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Snap sur Arch

Snap n'est pas dans les dépôts d'Arch – seulement dans l'AUR. Construisez-le
comme dans le chapitre sur la famille Arch :

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

Sur un vrai système, il faut aussi démarrer le service avec
`sudo systemctl enable --now snapd.socket`. C'est un signe que Snap n'est pas
chez lui sur Arch : la plupart des gens y utilisent Flatpak.
:::

:::redhat
### Snap sur Fedora

Fedora mise sur Flatpak, mais Snap se trouve dans les dépôts :

```sh
sudo dnf install snapd
```
:::

### Utiliser snap

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

Les snaps installés apparaissent comme des programmes dans `/snap/bin`.
Installer et supprimer nécessitent les droits root.

### Strict ou classic

La plupart des snaps tournent en mode **strict**, dans un bac à sable. Les
programmes qui ont besoin d'accéder à tout le système, comme les éditeurs de
code, sont publiés en **classic confinement**. Vous devez alors l'approuver
vous-même avec `--classic` :

```sh
sudo snap install code
sudo snap install code --classic
```

```quiz
Un snap est publié avec le confinement classique. Que devez-vous ajouter pour
l'installer ?
- [ ] `--user`
- [x] `--classic`
- [ ] `--channel=edge`
```

### Canaux et mises à jour

Chaque snap a des **canaux** (*channels*) : `stable`, `candidate`, `beta` et
`edge` (la toute dernière version, non testée). `snap info` les affiche et
`--channel=beta` permet d'en choisir un autre. Les mises à jour se font
automatiquement, mais vous pouvez les forcer et supprimer des snaps :

```sh
sudo snap refresh
sudo snap remove hello-world
```

Snap a aussi ses détracteurs : le Snap Store est géré uniquement par
Canonical, les mises à jour automatiques ne peuvent pas être complètement
désactivées et les programmes peuvent être lents à démarrer la première fois.

## AppImage

Une **AppImage** est un programme entier dans **un seul fichier**. Vous la
téléchargez depuis le site web du programme, la rendez exécutable et la
lancez – sans installation et sans root. Pour vous débarrasser du programme,
vous supprimez le fichier.

Il y a déjà une AppImage téléchargée dans votre répertoire personnel, dans
`~/{{downloads}}` :

```sh
cd ~/{{downloads}}
ls -l
```

```text
total 47184
-rw-r--r-- 1 {{user}} {{user}} 48312832 Oct 30 12:00 {{calculator}}
```

Les messages d'erreur de bash ont la forme `bash: CHEMIN: RAISON`, et le
chemin est affiché tel que bash le voit – avec `~` déjà remplacé par
`/home/{{user}}`. Que se passe-t-il si vous lancez le fichier tout de suite ?

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
Le fichier n'a pas la permission `x`.
```

Les fichiers téléchargés ne sont jamais exécutables au départ. Rendez-la
exécutable et lancez-la :

```sh
chmod +x {{calculator}}
./{{calculator}}
```

```try
chmod +x ~/{{downloads}}/{{calculator}}
---
Le fichier est maintenant exécutable. Vérifiez avec `ls -l ~/{{downloads}}`.
```

### FUSE

Une AppImage se monte elle-même comme un système de fichiers grâce à
**FUSE**, et a besoin de l'ancienne version 2 de la bibliothèque
(`libfuse.so.2`). Sans elle, vous obtenez l'erreur
*"AppImages require FUSE to run"*.

:::debian
Sur Ubuntu 24.04 et Debian 13, le paquet s'appelle `libfuse2t64` (*t64* vient
du passage au temps sur 64 bits ; dans les versions plus anciennes, il
s'appelait `libfuse2`) :

```sh
sudo apt update
sudo apt install libfuse2t64
./{{calculator}}
```

> N'installez **pas** le paquet `fuse` sur Ubuntu – il remplace `fuse3`, dont
> le bureau a besoin.
:::

:::arch
Sur Arch, le paquet s'appelle `fuse2` :

```sh
sudo pacman -S fuse2
./{{calculator}}
```
:::

:::redhat
Sur Fedora, le paquet s'appelle `fuse-libs` :

```sh
sudo dnf install fuse-libs
./{{calculator}}
```
:::

### Regarder à l'intérieur

Une AppImage peut aussi être décompressée. Cela fonctionne même sans FUSE :

```sh
./{{calculator}} --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` décompresse temporairement et lance le programme
aussitôt.

### À garder en tête

- AppImage n'a **pas de bac à sable** – le programme tourne avec votre
  identité et peut accéder à tout ce à quoi vous avez accès. Ne téléchargez
  que depuis le site officiel du programme.
- Il n'y a **pas de mises à jour automatiques**. Vous téléchargez un nouveau
  fichier quand une nouvelle version sort (certains programmes savent se
  mettre à jour eux-mêmes).
- Le programme n'apparaît pas tout seul dans le menu des applications. Des
  outils comme *Gear Lever* ou *AppImageLauncher* peuvent s'en charger.

## Lequel choisir ?

1. **Les paquets de la distribution** pour les programmes système et en ligne
   de commande – ce sont les plus légers et les plus rapides, et ils sont mis
   à jour avec le reste du système.
2. **Flatpak** pour les programmes de bureau quand vous voulez une version plus
   récente ou un programme absent des dépôts.
3. **Snap** si vous êtes sous Ubuntu, ou quand le programme n'existe qu'en
   snap.
4. **AppImage** pour essayer rapidement un programme, ou quand le développeur
   ne propose que ce format.
