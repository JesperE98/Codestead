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

N'hésitez pas à changer de distribution dans le menu en haut et à refaire les
exercices – vous verrez tout de suite les différences.

## Qu'est-ce qui est pareil partout ?

- **Le noyau Linux** – mais dans des versions différentes.
- **Le shell bash** et les outils de base (`ls`, `cp`, `grep` ...) de GNU.
- **L'organisation des répertoires** – `/etc`, `/home`, `/usr/bin` et ainsi
  de suite.
- **systemd**, qui démarre le système et gère les services, sur presque
  toutes les grandes distributions.

## Qu'est-ce qui diffère ?

| | Famille Debian | Famille Arch | Famille Red Hat |
|---|---|---|---|
| Gestionnaire de paquets | `apt` | `pacman` | `dnf` |
| Format des paquets | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Outil bas niveau | `dpkg` | (pacman) | `rpm` |
| Groupe sudo | `sudo` | `wheel` | `wheel` |
| Publications | Versions stables | En continu (rolling) | Une nouvelle version tous les 6 mois (Fedora) |

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
