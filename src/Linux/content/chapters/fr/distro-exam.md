# Examen : distributions et paquets

Répondez aux questions ci-dessous. Il faut 80 % pour réussir.

```quiz
Quel fichier indique le nom et la version de la distribution sur toutes les
distributions modernes ?
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
`uname -r` montre la version du noyau Linux.
```

```quiz
Quel gestionnaire de paquets et quel format de paquets vont ensemble ?
- [x] `pacman` et `.pkg.tar.zst`
- [ ] `dnf` et `.deb`
- [ ] `apt` et `.rpm`
```

```quiz
Quelle distribution est une *rolling release* sans versions ?
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
Quelle est la différence entre `apt update` et `apt upgrade` ?
- [x] `update` télécharge la liste des paquets disponibles, `upgrade` installe les nouvelles versions
- [ ] `update` installe les nouvelles versions, `upgrade` télécharge la liste
- [ ] Il n'y a aucune différence
```

```quiz
Quelle commande installe le paquet `htop` sur Arch ?
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
Pourquoi est-ce une mauvaise idée de lancer `pacman -Sy` puis `pacman -S package` ?
- [ ] Cela installe le paquet deux fois
- [x] C'est une mise à jour partielle qui peut casser le système
- [ ] `-Sy` supprime tous les paquets installés
```

```quiz
dnf demande `Is this ok [y/N]` et vous appuyez simplement sur Entrée. Que se passe-t-il ?
- [ ] Le paquet est installé
- [x] Rien n'est installé – Non est la réponse par défaut
```

```quiz
Lesquelles de ces affirmations sur l'AUR sont vraies ?
- [x] Il contient des recettes de construction (`PKGBUILD`), pas des paquets tout prêts
- [x] Ses paquets ne sont pas vérifiés par Arch
- [ ] `sudo pacman -Syu` met à jour les paquets AUR
- [ ] `makepkg` doit être lancé avec sudo
```

```quiz
Quelle commande ajoute un dépôt COPR sur Fedora ?
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` et `makepkg -si`
```

```quiz
Comment les paquets Snap sont-ils mis à jour ?
- [ ] Avec `flatpak update`
- [x] Automatiquement en arrière-plan
- [ ] En téléchargeant un nouveau fichier depuis le site web du développeur
```

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
Un fichier téléchargé n'est jamais exécutable au départ. Lancez d'abord
`chmod +x ~/{{downloads}}/{{calculator}}`.
```

```quiz
Vous voulez une version plus récente d'un programme de bureau qui manque dans
les dépôts de la distribution. Que recommande d'abord la règle empirique ?
- [ ] Un dépôt supplémentaire tenu par quelqu'un que vous ne connaissez pas
- [x] Un Flatpak
- [ ] Construire le programme à partir du code source en root
```
