# Utilisateurs, permissions et sudo

Linux est conçu pour que plusieurs utilisateurs puissent partager le même
ordinateur. C'est pourquoi chaque fichier a un propriétaire et des règles qui
définissent qui a le droit de faire quoi.

## Utilisateurs et groupes

Vous êtes connecté en tant qu'utilisateur `elev`. Chaque utilisateur
appartient à un ou plusieurs **groupes** :

```sh
id
```

L'utilisateur le plus important est **root** – l'administrateur, qui a le
droit de tout faire. On se connecte rarement en tant que root. On utilise
plutôt `sudo` (voir plus bas).

## Lire les permissions

Lancez `ls -l` et regardez la première colonne :

```text
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
```

Le premier caractère indique le type : `-` pour un fichier, `d` pour un
répertoire. Viennent ensuite trois groupes de trois caractères chacun :

```text
-     rw-            r--     r--
type  propriétaire   groupe  autres
```

| Caractère | Pour un fichier | Pour un répertoire |
|---|---|---|
| `r` (read) | Lire le contenu | Lister le contenu |
| `w` (write) | Modifier le contenu | Créer et supprimer des fichiers dedans |
| `x` (execute) | Exécuter le fichier comme un programme | Entrer dans le répertoire avec `cd` |

Après cela viennent le propriétaire (`elev`) et le groupe (`elev`).

## Modifier les permissions – `chmod`

Les permissions peuvent s'exprimer en **chiffres**. Chaque groupe reçoit un
chiffre qui est la somme de r = 4, w = 2 et x = 1 :

| Nombre | Permissions | Typique pour |
|---|---|---|
| `755` | `rwxr-xr-x` | Programmes et répertoires |
| `644` | `rw-r--r--` | Fichiers ordinaires |
| `600` | `rw-------` | Fichiers secrets |

```sh
chmod 644 anteckningar.txt
```

Ou avec des **symboles** : `u` (le propriétaire, *user*), `g` (le groupe),
`o` (les autres, *others*), `a` (tous, *all*), suivis de `+`, `-` ou `=` et des
permissions :

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

## Les scripts

Un **script** est un fichier texte qui contient des commandes. La première
ligne, `#!/bin/bash`, s'appelle le *shebang* et indique au système quel
programme doit exécuter le fichier :

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Date du jour :"; date' >> datum.sh
cat datum.sh
```

Pour lancer le script comme un programme, il doit être exécutable :

```sh
chmod +x datum.sh
./datum.sh
```

Le `./` est nécessaire parce que le répertoire où vous êtes ne fait pas
partie de `PATH`.

## root et sudo

Certains fichiers, comme `/etc/shadow` où sont stockés les mots de passe, ne
peuvent être lus que par root. Avec `sudo` (*superuser do*), vous exécutez une
seule commande en tant que root :

```sh
sudo whoami
```

La première fois, `sudo` demande **votre propre** mot de passe. Seuls les
utilisateurs du groupe des administrateurs peuvent utiliser sudo. Sur
{{distro}}, ce groupe s'appelle **{{adminGroup}}** :

:::debian
Dans la famille Debian, le groupe s'appelle `sudo`.
:::

:::arch
Dans la famille Arch, le groupe s'appelle `wheel` – un vieux nom Unix pour
« ceux qui commandent » (en anglais, un *big wheel* est un gros bonnet).
:::

:::redhat
Dans la famille Red Hat, le groupe s'appelle `wheel` – un vieux nom Unix pour
« ceux qui commandent » (en anglais, un *big wheel* est un gros bonnet).
:::

Si vous devez lancer beaucoup de commandes en tant que root, vous pouvez
ouvrir un shell root avec `sudo -i`. L'invite se transforme alors en `#`.
Revenez avec `exit`.

> **À retenir !** Avec sudo, il n'y a pas de filet de sécurité. Ne lancez que
> des commandes que vous comprenez.

### Un piège classique

```text
sudo echo "texte" > /etc/fichier     # ne fonctionne PAS
```

C'est *votre* shell – et non sudo – qui ouvre le fichier pour `>`. Utilisez
plutôt `tee`, qui s'exécute avec sudo :

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```
