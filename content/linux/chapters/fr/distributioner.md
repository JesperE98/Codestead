# Distributions et familles

Vous connaissez maintenant les bases, et elles fonctionnent de la même façon
sur toutes les distributions. Alors, qu'est-ce qui les distingue ?

:::debian
Vous utilisez actuellement **{{distro}}**, de la **famille Debian**.
:::

:::arch
Vous utilisez actuellement **{{distro}}**, de la **famille Arch**.
:::

:::redhat
Vous utilisez actuellement **{{distro}}**, de la **famille Red Hat**.
:::

Ce chapitre est une vue d'ensemble. N'hésitez pas à changer de distribution
dans le menu en haut et à refaire les tâches – vous verrez tout de suite les
différences. Après ce chapitre vient un chapitre pour chaque famille : la
**famille Debian** (apt), la **famille Arch** (pacman) et la **famille Red
Hat** (dnf). Chacun tourne toujours sur une distribution de cette famille,
vous pouvez donc faire les trois.

## Qu'est-ce qui est pareil partout ?

- **Le noyau Linux** – mais dans des versions différentes.
- **Le shell bash** et les outils de base (`ls`, `cp`, `grep` ...) de GNU.
- **L'organisation des répertoires** – `/etc`, `/home`, `/usr/bin` et ainsi
  de suite.
- **systemd**, qui démarre le système et gère les services, sur presque
  toutes les grandes distributions.

```predict
$ echo $SHELL
/bin/bash
---
Le shell est bash sur toutes les distributions du simulateur – quelle que soit
celle que vous avez choisie.
```

## Qu'est-ce qui diffère ?

| | Famille Debian | Famille Arch | Famille Red Hat |
|---|---|---|---|
| Gestionnaire de paquets | `apt` | `pacman` | `dnf` |
| Format des paquets | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Outil bas niveau | `dpkg` | (pacman) | `rpm` |
| Groupe sudo | `sudo` | `wheel` | `wheel` |
| Publications | Versions stables | En continu (rolling) | Une nouvelle version tous les 6 mois (Fedora) |

```quiz
Dans quelles familles le groupe autorisé à utiliser sudo s'appelle-t-il `wheel` ?
- [ ] La famille Debian
- [x] La famille Arch
- [x] La famille Red Hat
---
La famille Debian appelle ce groupe `sudo` ; Arch et Red Hat l'appellent
`wheel`.
```

### Modèles de publication

- **Stable, avec des versions fixes** – Debian sort une nouvelle version
  environ tous les deux ans, et Ubuntu LTS (*Long Term Support*) paraît tous
  les deux ans avec cinq ans de support. Les programmes reçoivent des
  correctifs de sécurité mais sont rarement remplacés par des versions plus
  récentes. Idéal pour les serveurs.
- **En continu** (*rolling release*) – Arch n'a pas de versions du tout. On
  met à jour en permanence et on a toujours les dernières nouveautés. Cela
  demande un peu plus d'implication de la part de l'utilisateur.
- **Rapide** – Fedora sort une nouvelle version environ tous les six mois et
  sert en quelque sorte de banc d'essai pour Red Hat Enterprise Linux (RHEL),
  qui bénéficie quant à lui de dix ans de support et est utilisé par les
  entreprises.

```quiz
Quelle distribution n'a pas de versions du tout, mais est mise à jour en
continu (*rolling*) ?
- [ ] Debian
- [ ] Ubuntu LTS
- [x] Arch
- [ ] Fedora
```

## Quelle distribution est-ce que j'utilise ?

Le fichier `/etc/os-release` existe sur toutes les distributions modernes et
indique le nom et la version :

```sh
cat /etc/os-release
```

La version du noyau s'affiche avec `uname -r` :

```sh
uname -r
```

```try
cat /etc/os-release
---
Les lignes `NAME` et `PRETTY_NAME` vous indiquent de quelle distribution il
s'agit.
```

## Paquets, dépôts et dépendances

Sous Windows et macOS, on télécharge souvent les programmes depuis un site
web. Sous Linux, on installe plutôt presque tout avec un **gestionnaire de
paquets**. C'est la plus grande différence entre les familles de
distributions.

- Un **paquet** est un programme (ou une bibliothèque) emballé dans un
  fichier, avec des informations sur sa version et ce dont il a besoin.
- Un **dépôt** (*repository*) est un serveur sur lequel la distribution publie
  tous ses paquets. Ils sont testés et signés, vous savez donc qu'ils n'ont
  pas été trafiqués.
- Une **dépendance** est un autre paquet nécessaire. Le gestionnaire de
  paquets installe les dépendances automatiquement.

Le gestionnaire de paquets garde aussi la trace de ce qui est installé, et
peut mettre à jour *tout* l'ordinateur en une seule commande. Les commandes
qui modifient le système nécessitent les droits root, on les lance donc avec
`sudo`.

```quiz
Un paquet a besoin d'un autre paquet que vous n'avez pas. Que se passe-t-il
quand vous l'installez avec le gestionnaire de paquets ?
- [ ] L'installation s'arrête, et vous devez trouver l'autre paquet vous-même
- [x] Le gestionnaire de paquets installe la dépendance automatiquement
- [ ] Le paquet est installé, mais ne fonctionne pas tant que vous n'avez pas téléchargé l'autre
```

### Même programme, noms différents

Les paquets ont généralement le même nom partout – mais pas toujours.
Quelques exemples :

| Programme | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| Client SSH | `openssh-client` | `openssh` | `openssh-clients` |

En cas de doute sur le nom, cherchez toujours avec le gestionnaire de
paquets.

## La configuration du gestionnaire de paquets

:::debian
Dans la famille Debian, les fichiers de `/etc/apt/sources.list.d/` indiquent
depuis quels *dépôts* apt récupère les paquets :

```sh
ls /etc/apt/sources.list.d
```
:::

:::arch
Dans la famille Arch, pacman se configure dans `/etc/pacman.conf`, et la liste
des serveurs miroirs se trouve dans `/etc/pacman.d/mirrorlist` :

```sh
cat /etc/pacman.conf
```
:::

:::redhat
Dans la famille Red Hat, les réglages de dnf sont dans `/etc/dnf/dnf.conf`, et
les *dépôts* sont décrits par des fichiers dans `/etc/yum.repos.d/` :

```sh
ls /etc/yum.repos.d
```
:::

## Laquelle choisir ?

Il n'y a pas de bonne réponse, mais voici une règle empirique :

- **Vous débutez sous Linux ?** Ubuntu, Linux Mint ou Fedora.
- **Pour un serveur ?** Debian, Ubuntu LTS ou un clone de RHEL comme Rocky
  Linux.
- **Vous voulez comprendre comment tout s'articule ?** Arch – et son
  excellent wiki.
