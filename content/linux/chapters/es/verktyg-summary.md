# Resumen: Más herramientas

En esta parte has conocido dos herramientas que usarás el resto de tu vida en
la terminal: git, que guarda el historial de tus archivos, y otras shells
aparte de bash. Esto es lo que deberías recordar antes del examen.

## Git en la terminal

**Git** es un sistema de control de versiones: guarda instantáneas de todo el
proyecto, recuerda quién cambió qué y por qué, y te permite volver atrás en el
tiempo. En Ubuntu lo instalas con `sudo apt install git`; otras distribuciones
usan su propio gestor de paquetes.

- Antes de tu primer commit le dices a git quién eres con
  `git config --global user.name` y `user.email`. `--global` significa todos
  tus proyectos; la configuración acaba en `~/.gitconfig`.
- `git init` convierte un directorio en un **repositorio**. Todo el historial
  vive en el directorio oculto `.git`.
- Un cambio pasa por tres lugares: el **árbol de trabajo** (los archivos que
  ves), el **índice** (lo que entra en el próximo commit) y el **historial**
  (los commits). `git add` lleva los cambios al índice, `git commit` guarda el
  índice como un commit nuevo.
- `git commit -a` añade todos los archivos modificados que git ya sigue, pero
  nunca archivos nuevos.
- `git diff` muestra los cambios que aún no están en el índice;
  `git diff --staged` muestra lo que hay en el índice.
- Una **rama** es una etiqueta que apunta a un commit y avanza con los commits
  nuevos. Cuando cambias de rama, git reescribe el árbol de trabajo.
- `git merge` trae una rama a aquella en la que estás. Si las dos ramas han
  cambiado las mismas líneas tienes un **conflicto**: arregla el archivo, haz
  `git add` y termina con `git commit`.
- `.gitignore` lista los archivos que git no debe seguir. Solo se aplica a
  archivos que git aún no sigue.
- Un **remoto** es una copia del repositorio en otro sitio, normalmente
  llamada `origin`. `git pull` descarga y fusiona, `git push` envía tus
  commits.

| Comando | Qué hace |
|---|---|
| `git config --global user.name "…"` | Le dice a git tu nombre (y `user.email`) |
| `git init` | Convierte el directorio en un repositorio |
| `git status` | Muestra dónde está cada cambio |
| `git add FILE` / `git add .` | Pone cambios en el índice |
| `git commit -m "…"` | Guarda el índice como un commit nuevo |
| `git commit -am "…"` | Añade todos los archivos seguidos y hace commit en un paso |
| `git diff` / `git diff --staged` | Muestra los cambios sin commit |
| `git log --oneline --graph --all` | Muestra el historial |
| `git restore FILE` | Descarta los cambios de un archivo |
| `git restore --staged FILE` | Saca un archivo del índice |
| `git switch -c BRANCH` / `git switch BRANCH` | Crea una rama / cambia de rama |
| `git merge BRANCH` | Fusiona una rama con aquella en la que estás |
| `git branch -d BRANCH` | Borra una rama fusionada |
| `git rm --cached FILE` | Deja de seguir un archivo pero lo conserva en el disco |
| `git clone`, `git pull`, `git push` | Colabora a través de un remoto |

## Otras shells: zsh y fish

La **shell** lee lo que escribes e inicia otros programas. Programas como `ls`
y `grep` funcionan igual en todas las shells; lo que cambia es el lenguaje que
los rodea: variables, bucles, condiciones y el prompt.

- `/etc/shells` lista las shells que pueden ser shells de inicio de sesión. Tu
  shell de inicio de sesión es el último campo de tu línea en `/etc/passwd` y
  también está en `$SHELL`. `$0` contiene la shell que estás ejecutando ahora
  mismo.
- **zsh** entiende casi toda la sintaxis de bash y añade comodidades: `**/`
  busca en todos los subdirectorios, y con `autocd` vas a un directorio con
  solo escribir su nombre. Las opciones se activan y desactivan con `setopt` y
  `unsetopt`. A diferencia de bash, zsh no divide por los espacios las
  variables sin comillas.
- **fish** es fácil de usar desde el principio, pero tiene **su propia
  sintaxis**: `set` en lugar de `=`, `$status` en lugar de `$?`, `math` en
  lugar de `$((...))`, y cada bloque termina con `end`. Toda variable es una
  lista, numerada desde 1.
- Una shell que inicias se ejecuta **dentro** de bash; `exit` te devuelve.
  Con `-c` una shell ejecuta un comando y termina.
- Los scripts se siguen escribiendo para bash (o `sh` POSIX): la línea `#!`
  decide qué shell ejecuta un script, sea cual sea la shell en la que estés.
- `chsh -s` cambia tu shell de inicio de sesión. El cambio se aplica en el
  siguiente inicio de sesión.

| Comando | Qué hace |
|---|---|
| `cat /etc/shells` | Lista las shells que se pueden usar |
| `echo $0` / `ps` | Muestra qué shell estás ejecutando ahora mismo |
| `echo $SHELL` | Muestra tu shell de inicio de sesión |
| `zsh` / `fish` / `exit` | Inicia otra shell / vuelve |
| `zsh -c '…'` / `fish -c '…'` | Ejecuta un comando en otra shell |
| `setopt autocd` / `unsetopt autocd` | Activa / desactiva una opción de zsh |
| `set {{fruitVar}} {{fruitWord}}` / `set -e {{fruitVar}}` | Crea / elimina una variable en fish |
| `set -x NAME value` | Crea una variable de entorno en fish |
| `math 17 x 23` | Aritmética en fish |
| `chsh -s /usr/bin/zsh` | Cambia tu shell de inicio de sesión |

Los archivos de configuración: `~/.bashrc` (bash), `~/.zshrc` (zsh) y
`~/.config/fish/config.fish` (fish).
