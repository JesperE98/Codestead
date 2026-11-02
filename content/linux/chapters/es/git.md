# Git en la terminal

¿Alguna vez has guardado archivos llamados `informe-final.txt`,
`informe-final-2.txt` e `informe-AHORA-SÍ-final.txt`? Entonces ya has hecho
*control de versiones* a mano. Un sistema de control de versiones hace lo
mismo, pero bien: guarda instantáneas de todo el proyecto, recuerda quién
cambió qué y por qué, te permite viajar atrás en el tiempo y hace posible que
muchas personas trabajen a la vez en los mismos archivos.

**Git** es, con diferencia, el sistema de control de versiones más usado. Lo
escribió en 2005 Linus Torvalds –la misma persona que escribió el kernel
Linux– para gestionar el código fuente del kernel. Hoy git se usa para casi
todo el software, pero funciona igual de bien para páginas web, archivos de
configuración, apuntes y libros. Todo lo que sea texto encaja a la perfección.

Git está hecho para la terminal. Los programas gráficos y los editores tienen
botones de git, pero por debajo ejecutan los mismos comandos que aprendes aquí.

## Instalar git

Git no siempre viene preinstalado. En la terminal de Ubuntu se instala con
apt:

```sh
sudo apt update
sudo apt install git
```

Otras distribuciones lo instalan con su propio gestor de paquetes, como
aprendiste en la parte sobre distribuciones y paquetes; allí el paquete
también se llama `git`. Comprueba que funciona:

```sh
git --version
```

Todos los comandos de git tienen la forma `git COMANDO`, por ejemplo
`git status` o `git log`. El manual está disponible con `man git`.

## Dile a git quién eres

Cada versión guardada en git contiene el nombre y la dirección de correo de la
persona que la hizo. Por eso git quiere saber quién eres antes de que puedas
guardar nada. Se configura una sola vez por ordenador:

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

Puedes usar tu propio nombre. `--global` significa que la configuración se
aplica a todos tus proyectos. Se guarda en el archivo de texto normal
`~/.gitconfig`:

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

Si te saltas este paso, git se queja cuando intentas guardar:
`*** Please tell me who you are.`, y te sugiere justo estos dos comandos.

> **Consejo:** Añade también `git config --global init.defaultBranch main`.
> Así la rama principal de cada proyecto nuevo se llamará `main` en todos tus
> ordenadores. Las versiones antiguas de git la llaman `master`, y verás los
> dos nombres por ahí.

## Un repositorio nuevo

Tu directorio personal contiene un pequeño proyecto web, `~/{{webProject}}`,
con tres archivos. Entra y echa un vistazo:

```sh
cd ~/{{webProject}}
ls
```

Para que git empiece a seguir el directorio, conviértelo en un
**repositorio** (*repo*, para abreviar):

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

Lo único que ha pasado es que se ha creado un directorio oculto, `.git`. Ahí
guarda git todo el historial. Git no toca tus archivos.

```sh
ls -a
ls .git
```

No borres nunca `.git` a menos que quieras perder el historial, y no edites a
mano los archivos que contiene. Si quieres dejar de usar git en un proyecto,
basta con eliminar `.git`; tus archivos normales se quedan.

```quiz
Quieres dejar de usar git en un proyecto, pero conservar todos tus archivos. ¿Qué haces?
- [ ] Ejecutar `git init` otra vez
- [x] Eliminar el directorio oculto `.git`
- [ ] Eliminar todos los archivos excepto `.git`
---
Todo el historial está en `.git`, y git no toca tus archivos normales.
Sin `.git` los archivos se quedan: solo desaparece el historial.
```

## Tres lugares: árbol de trabajo, índice e historial

Lo más importante que hay que entender de git es que un cambio pasa por tres
lugares:

```text
 árbol de trabajo  ──git add──▶  índice  ──git commit──▶  historial
 (los archivos que ves)          (el próximo commit)       (.git)
```

- El **árbol de trabajo** (*working tree*) son los archivos tal como están
  ahora mismo, los que editas.
- El **índice** (también llamado *staging area*) es una especie de mesa de
  embalaje. Ahí pones lo que debe ir en la próxima versión guardada.
- El **historial** está formado por **commits**. Un commit es una instantánea
  guardada de todos los archivos, con un mensaje, un autor y una fecha.

¿Por qué el paso intermedio? Para que puedas elegir. Si has cambiado cinco
archivos pero solo dos tienen que ver entre sí, puedes poner esos dos en el
índice, hacer un commit con ellos y dejar el resto para un commit aparte.

```quiz
Has cambiado cinco archivos, pero solo dos de los cambios tienen que ver entre
sí. ¿Cómo guardas solo esos dos en un commit?
- [ ] Ejecutas primero `git commit` y después `git add` sobre los dos archivos
- [x] Ejecutas `git add` sobre los dos archivos y luego `git commit`
- [ ] Haces commit de los cinco: un commit siempre incluye todos los archivos cambiados
---
Un commit guarda lo que hay en el índice. Los otros tres cambios se quedan en el
árbol de trabajo hasta que los añadas.
```

## `git status` es tu brújula

El comando que más vas a ejecutar es `git status`. Te dice dónde está cada
cambio y a menudo te sugiere qué hacer a continuación. ¡Mejor ejecutarlo de
más que de menos!

```sh
git status
```

```text
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	README.md
	index.html
	style.css

nothing added to commit but untracked files present (use "git add" to track)
```

Los *untracked files* son archivos que git ve pero que todavía no sigue. En
una terminal real se muestran en rojo. Ponlos en el índice con `git add`:

```sh
git add index.html style.css README.md
git status
```

```text
Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md
	new file:   index.html
	new file:   style.css
```

Ahora aparecen bajo *Changes to be committed*, en verde. En lugar de nombrar
cada archivo puedes escribir `git add .`, que añade todo lo que hay en el
directorio actual (el punto significa «aquí»). `git add -A` añade todos los
cambios de todo el repositorio.

## El primer commit

Guarda la instantánea con `git commit`. La opción `-m` indica el mensaje:

```sh
git commit -m "{{commitFirst}}"
```

```text
[main (root-commit) 3f2a9c1] {{commitFirst}}
 3 files changed, 24 insertions(+)
 create mode 100644 README.md
 create mode 100644 index.html
 create mode 100644 style.css
```

`3f2a9c1` es el principio del **id** del
commit: un *hash* de 40 caracteres calculado a partir del contenido. Tu id
será distinto, porque la fecha y tu nombre forman parte de él. Normalmente
bastan los siete primeros caracteres para identificar un commit.

Ejecuta `git status` otra vez:

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean* significa que todo está guardado. ¡Bien!

## Ver qué ha cambiado: `git diff`

Añade una línea a `README.md` y pregúntale a git qué ha pasado:

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index f7b7232..94c3464 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # {{siteTitle}}
 
 Un pequeño sitio web que mantengo con control de versiones en git.
+{{builtWith}}
```

La línea que empieza por `+` es nueva (verde), las que empiezan por `-` se han
eliminado (rojo) y el resto se muestra como contexto. `@@ -1,3 +1,4 @@`
significa que las líneas 1–3 de la versión antigua corresponden a las líneas
1–4 de la nueva.

`git diff` compara el árbol de trabajo con el índice, es decir, lo que
*todavía no* has añadido. Para ver lo que está en el índice esperando a entrar
en un commit, escribe `git diff --staged`.

Añade el cambio y haz un commit. La opción `-a` ejecuta `git add` en todos los
archivos que git ya sigue, así que basta con un solo paso:

```sh
git commit -a -m "{{commitDescribe}}"
```

Ten en cuenta que `-a` *no* incluye archivos nuevos que git todavía no sigue.
Esos siempre tienes que añadirlos antes con `git add`.

Las preguntas con comandos de este capítulo empiezan en una terminal nueva,
así que primero instalan git y hacen el primer commit. `> /dev/null 2>&1`
descarta la salida de esas líneas, como aprendiste en el capítulo sobre
redirecciones y pipes. ¿Qué imprime el último comando?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "Primera versión" > /dev/null
$ echo 'Una línea más.' >> README.md
$ git commit -m "Una línea más" > /dev/null
$ git log --oneline | wc -l
1
---
El segundo commit nunca llegó a hacerse: el cambio en `README.md` no estaba en
el índice, así que no había nada de lo que hacer commit. Un `git add README.md`
antes –o `git commit -a`– habría dado dos commits.
```

## Buenos mensajes de commit

Dentro de seis meses, los mensajes de commit son los que cuentan la historia,
a ti y a los demás. Algunas reglas prácticas:

- Escribe una primera línea corta, mejor de menos de 50 caracteres, que
  resuma el cambio.
- Describe *qué* hace el cambio y, a ser posible, *por qué*, no *cómo* lo
  escribiste.
- Un commit debe hacer una sola cosa. Mejor tres commits pequeños que uno
  grande.
- ¿Necesitas explicar más? Deja una línea en blanco y escribe un texto más
  largo debajo. Cada `-m` se convierte en un párrafo propio:
  `git commit -m "Título" -m "Explicación."`

| Mal | Mejor |
|---|---|
| `arreglo` | `Arregla el enlace roto a la página de contacto` |
| `cambios` | `Agranda los títulos en el móvil` |
| `asdf` | `Añade un formulario de contacto` |

En inglés, los mensajes suelen escribirse en imperativo: *Add contact form*,
*Fix broken link*. Se lee como «este commit va a …». En español es habitual
usar el presente (*Añade*, *Arregla*) o el infinitivo (*Añadir*, *Arreglar*);
lo importante es ser coherente.

## Mirar el historial

```sh
git log
```

```text
commit 8d41b7e0c2a3f1d5e9b6a7c8d9e0f1a2b3c4d5e6 (HEAD -> main)
Author: {{gitName}} <{{user}}@example.com>
Date:   Fri Oct 30 14:12:09 2026 +0100

    {{commitDescribe}}

commit 3f2a9c1...
```

El commit más reciente aparece primero. `HEAD -> main` significa que estás en
la rama `main` y que este es su último commit. Algunas variantes útiles:

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` da una línea por commit, `-n 1` muestra solo el último, `--stat`
muestra qué archivos cambiaron y `git show` muestra un commit junto con el
propio cambio. También puedes ver un archivo tal como estaba en un commit
concreto: `git show HEAD~1:README.md` (`HEAD~1` significa «el commit anterior
al último»).

## Deshacer

Git hace que deshacer sea fácil; de eso se trata, en buena parte:

| Si quieres … | Comando |
|---|---|
| descartar los cambios de un archivo (aún no añadidos) | `git restore ARCHIVO` |
| sacar un archivo del índice (el cambio se mantiene) | `git restore --staged ARCHIVO` |
| cambiar el mensaje del último commit | `git commit --amend -m "Mensaje nuevo"` |
| volver a como estaba todo en el último commit | `git reset --hard` |

Prueba a estropear un archivo y recuperarlo:

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **¡Ojo!** `git restore ARCHIVO` y `git reset --hard` descartan cambios que
> nunca llegaron a un commit. No se pueden recuperar. En cambio, todo lo que
> estuvo en un commit en algún momento casi siempre se puede rescatar:
> pregúntale a `git reflog` por dónde has pasado.

## Ramas

Una **rama** (*branch*) es una línea de desarrollo separada. Puedes probar una
idea nueva en una rama sin tocar la versión que funciona en `main`. Si sale
bien, fusionas la rama con `main`; si no, la tiras.

Técnicamente, una rama no es más que una etiqueta que apunta a un commit y que
avanza cuando haces commits nuevos. Por eso las ramas son baratas en git:
¡úsalas a menudo!

```sh
git branch
git switch -c {{newDesign}}
git branch
```

`git switch -c {{newDesign}}` crea la rama y se cambia a ella. La
estrella de `git branch` indica dónde estás. Haz un cambio y un commit en la
rama:

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

Vuelve a `main` y mira `style.css`:

```sh
git switch main
tail -3 style.css
```

¡El color morado ha desaparecido! Cuando cambias de rama, git reescribe el
árbol de trabajo para que se parezca al último commit de esa rama. El cambio
está a salvo en `{{newDesign}}`. `git log --oneline --all` muestra todas las
ramas:

```sh
git log --oneline --all
```

> **Consejo:** Las guías antiguas suelen usar `git checkout {{newDesign}}` y
> `git checkout -b rama-nueva`. `checkout` hace lo mismo que `switch`, pero
> además puede restaurar archivos. Los comandos más nuevos `switch` y
> `restore` se reparten el trabajo y son más fáciles de recordar.

Los cambios sin commit te acompañan cuando cambias de rama, salvo que choquen
con la otra rama. En ese caso git se niega y te pide que hagas un commit
primero (o que apartes los cambios temporalmente con `git stash` y los
recuperes con `git stash pop`).

¿Cuántas líneas con `purple` tiene `style.css` al final?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "Primera versión" > /dev/null
$ git switch -c {{newDesign}} > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "{{commitPurple}}" > /dev/null
$ git switch main > /dev/null 2>&1
$ grep purple style.css | wc -l
0
---
La línea morada se guardó en un commit en `{{newDesign}}`. Cuando cambias a `main`,
git hace que el árbol de trabajo se parezca al último commit de `main`, donde
la línea todavía no existe.
```

## Fusionar ramas: `git merge`

Colócate en la rama que debe *recibir* los cambios –aquí, `main`– y fusiona:

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward* significa que `main` no ha cambiado desde que se creó la rama.
Entonces git solo tiene que mover `main` hacia delante hasta el mismo commit
que `{{newDesign}}`.

Si las dos ramas tienen commits nuevos, git hace una **fusión a tres bandas**
(*three-way merge*): compara las dos ramas con su antecesor común y crea un
nuevo *merge commit* con dos padres. `git log --oneline --graph --all` muestra
cómo el historial se separa y vuelve a unirse:

```text
*   e4b1d0a (HEAD -> main) Merge branch 'titulo'
|\
| * 7c3f9e2 (titulo) Título más amable
* | 52d8a71 Texto más corto
|/
* c19e2f4 {{commitPurple}}
```

Una rama ya fusionada no hace falta y se puede borrar. `-d` se niega si la rama
tiene commits que no están en la rama en la que estás:

```sh
git branch -d {{newDesign}}
```

## Conflictos

Si las dos ramas cambiaron *las mismas líneas*, git no puede saber qué versión
es la buena. Eso se llama **conflicto**, y entonces decides tú. Vamos a crear
uno a propósito:

```sh
git switch -c titulo
sed -i 's/Bienvenido!/Hola y bienvenido!/' index.html
git commit -am "Título más amable"
git switch main
sed -i 's/Bienvenido!/Bienvenido a mi sitio!/' index.html
git commit -am "Título más largo"
git merge titulo
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

Tranquilo: no se ha roto nada. `git status` muestra el archivo bajo *Unmerged
paths* como `both modified`. Mira dentro:

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>¡Bienvenido a mi sitio!</h1>
=======
  <h1>¡Hola y bienvenido!</h1>
>>>>>>> titulo
```

Entre `<<<<<<< HEAD` y `=======` está tu versión (la de la rama en la que
estás); entre `=======` y `>>>>>>> titulo`, la de la otra rama. Así se
resuelve el conflicto:

1. Abre el archivo en un editor y déjalo como quieras –elige una de las líneas
   o combínalas– y borra las líneas de marcas.
2. Dile a git que el conflicto está resuelto con `git add ARCHIVO`.
3. Termina la fusión con `git commit`.

El simulador no tiene un editor de verdad, pero si solo quieres quedarte con
la versión de uno de los lados, git puede hacerlo por ti: `--ours` toma tu
versión y `--theirs`, la de la otra rama.

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "Fusiona la rama titulo"
```

Si cambias de idea en mitad de un conflicto, `git merge --abort` te devuelve a
donde estabas antes de la fusión.

Los conflictos son completamente normales cuando varias personas trabajan en
el mismo proyecto. Una buena manera de tener menos es hacer commits pequeños y
fusionar a menudo.

```quiz
Estás en `main` y ejecutas `git merge titulo`. El archivo tiene un conflicto:

    <<<<<<< HEAD
      <h1>Hello!</h1>
    =======
      <h1>Welcome!</h1>
    >>>>>>> titulo

¿Qué línea viene de `main`?
- [x] `<h1>Hello!</h1>`
- [ ] `<h1>Welcome!</h1>`
---
`HEAD` es la rama en la que estás, aquí `main`. Su versión está entre
`<<<<<<< HEAD` y `=======`; la versión de la otra rama va después de `=======`.
```

## Archivos que git debe ignorar: `.gitignore`

Algunos archivos no deberían acabar nunca en el historial: contraseñas y
claves, registros, archivos temporales y cosas que se generan
automáticamente. Escribe sus nombres o patrones en el archivo `.gitignore`, en
la raíz del repositorio:

```sh
echo 'password=secret' > secreto.txt
echo 'error' > errores.log
printf 'secreto.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`secreto.txt` y `errores.log` ya no aparecen: ni
siquiera `git add .` los recoge. Un `*` coincide con cualquier cosa, y una
barra al final (`build/`) indica un directorio entero. En cambio, el propio
`.gitignore` sí debe ir en un commit, para que todos los que trabajan en el
proyecto ignoren lo mismo:

```sh
git add .gitignore
git commit -m "Ignora secretos y registros"
```

Ten en cuenta que `.gitignore` solo afecta a los archivos que git todavía no
sigue. Si un archivo ya está en un commit, quítalo del repositorio (pero no
del disco) con `git rm --cached ARCHIVO`.

## GitHub, GitLab y repositorios remotos

Hasta ahora todo ha estado en tu propio repositorio. Para colaborar, o
simplemente para tener una copia de seguridad, se suele guardar una copia del
repositorio en un servidor: un **remoto** (*remote*). Los servicios más
conocidos son **GitHub**, **GitLab** y **Codeberg**.

| Comando | Qué hace |
|---|---|
| `git clone URL` | Descarga un repositorio entero, con todo su historial, en un directorio nuevo |
| `git push` | Envía tus commits nuevos al remoto |
| `git pull` | Trae los commits nuevos del remoto y los fusiona con los tuyos |
| `git fetch` | Trae los commits nuevos sin fusionar nada |
| `git remote -v` | Lista los remotos |

El remoto suele llamarse `origin`, y un flujo de trabajo típico es así:
`git pull` al empezar, luego editar, `git add` y `git commit`, y por último
`git push`. GitHub y GitLab usan una clave SSH o un token de acceso para
identificarte, no una contraseña.

Todo esto necesita red, y el simulador no la tiene. Pero `clone`, `push` y
`pull` funcionan igual de bien entre dos repositorios del mismo ordenador, así
que puedes probarlos de todos modos. Clona tu proyecto en un directorio nuevo:

```sh
cd ~
git clone ~/{{webProject}} ~/copia
cd ~/copia
git log --oneline
git remote -v
```

Un servidor como GitHub solo tiene el historial, sin árbol de trabajo. Un
repositorio así, *bare*, se crea con `git init --bare`. Imagina que es tu
cuenta de GitHub y sube `main` allí:

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

`-u` vincula tu `main` con `origin/main`, para que `git status` pueda decirte
si vas por delante o por detrás del servidor, y para que a partir de entonces
baste con un simple `git push` o `git pull`.

## Resumen

| Comando | Qué hace |
|---|---|
| `git init` | Convierte el directorio en un repositorio |
| `git status` | Muestra el estado: ¡ejecútalo a menudo! |
| `git add ARCHIVO` / `git add .` | Pone cambios en el índice |
| `git commit -m "…"` | Guarda el índice como un commit nuevo |
| `git diff` / `git diff --staged` | Muestra los cambios que no están en un commit |
| `git log --oneline --graph --all` | Muestra el historial |
| `git restore ARCHIVO` | Descarta los cambios de un archivo |
| `git switch -c RAMA` | Crea una rama y se cambia a ella |
| `git merge RAMA` | Fusiona una rama con la rama en la que estás |
| `git clone`, `git pull`, `git push` | Colaborar a través de un remoto |
