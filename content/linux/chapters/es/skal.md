# Otros shells: zsh y fish

Hasta ahora has escrito todos los comandos en **bash**. Pero bash no es más que
uno de varios shells, y mucha gente prefiere otro. En este capítulo instalarás
dos alternativas populares, **zsh** y **fish**, las probarás y verás en qué se
diferencian de bash. También aprenderás por qué los scripts se siguen
escribiendo casi siempre para bash.

## ¿Qué era un shell?

El **shell** es el programa que lee lo que escribes, lo interpreta e inicia
otros programas. Es el shell el que entiende `|`, `>`, `$VARIABLES`, comodines
como `*.txt` y bucles. La terminal no es más que la ventana en la que se
ejecuta el shell.

Programas como `ls`, `grep` y `cat` son programas independientes que están en
`/usr/bin`: funcionan igual uses el shell que uses. Lo que cambia entre shells
es **el lenguaje que los rodea**: cómo se asignan las variables, cómo se
escriben los bucles y las condiciones, qué aspecto tiene el prompt y qué
comodidades hay disponibles.

```quiz
Cambias de bash a otro shell. ¿Cuál de estas cosas sigue exactamente igual?
- [ ] Cómo se asigna una variable
- [ ] Cómo se escribe un bucle
- [x] Lo que hace `grep` con sus opciones
- [ ] Qué aspecto tiene el prompt
---
`grep` es un programa independiente que está en `/usr/bin`. El shell solo lo
inicia: lo que cambia entre shells es el lenguaje que lo rodea.
```

## El árbol genealógico: sh, bash, zsh y fish

| Shell | Desde | Características |
|---|---|---|
| `sh` | 1979 | El Bourne shell. El `sh` actual sigue el estándar **POSIX** y es el mínimo común denominador. |
| `bash` | 1989 | *Bourne Again SHell*. El shell por defecto en casi todas las distribuciones de Linux. |
| `zsh` | 1990 | En gran parte compatible con bash, pero con más funciones. El shell por defecto en macOS. |
| `fish` | 2005 | *Friendly interactive shell*. Fácil de usar, pero con **su propia sintaxis**. |

**POSIX** es un estándar que describe cómo debe comportarse un shell `sh`. Un
script que solo usa funciones POSIX funciona en todos los shells compatibles
con `sh`: bash, zsh, `dash` (que es `/bin/sh` en Debian y Ubuntu) y `ash` (en
sistemas pequeños como Alpine). fish **no** es compatible con POSIX a
propósito: eso es lo que lo hace más sencillo, pero también diferente.

## ¿Qué shells hay instalados?

El archivo `/etc/shells` lista los shells que se pueden usar como shell de
inicio de sesión:

```sh
cat /etc/shells
```

El shell que recibes al iniciar sesión es el último campo de tu línea en
`/etc/passwd`, y también está en la variable `$SHELL`:

```sh
grep elev /etc/passwd
echo $SHELL
```

## zsh: bash con extras

### Instalar zsh

En la terminal de Ubuntu, zsh se instala con apt:

```sh
sudo apt update
sudo apt install zsh
```

Otras distribuciones usan su propio gestor de paquetes, como aprendiste en la
parte sobre distribuciones y paquetes. Allí el paquete también se llama `zsh`.

Vuelve a mirar `/etc/shells`: el paquete ha añadido `/usr/bin/zsh` (y
`/bin/zsh`):

```sh
cat /etc/shells
```

### Iniciar zsh

Un shell es un programa como cualquier otro, así que inicias zsh escribiendo
su nombre:

```sh
zsh
```

La primera vez te recibe **zsh-newuser-install**, porque todavía no tienes
ningún archivo de configuración para zsh. Es un menú que te ayuda a empezar:

| Tecla | Hace |
|---|---|
| `q` | Salir sin hacer nada (te lo vuelve a preguntar la próxima vez) |
| `0` | Crear un `~/.zshrc` casi vacío |
| `1` | El menú principal con todos los ajustes (no disponible en el simulador) |
| `2` | Crear `~/.zshrc` con los ajustes recomendados |

Responde `2`. El prompt cambia a `elev@ubuntu ~ %`: en zsh, `%` es el
signo habitual de un usuario normal (root recibe `#`, igual que en bash).

¿Qué shell estás ejecutando ahora? La variable `$0` contiene el nombre del
shell:

```sh
echo $0
ps
```

`ps` muestra que zsh se ejecuta **dentro** de bash: bash inició zsh como un
proceso nuevo. Fíjate también en que `$SHELL` sigue siendo `/bin/bash`: esa
variable te indica tu *shell de inicio de sesión*, no qué shell estás
ejecutando en este momento.

```sh
echo $SHELL
```

### Casi todo funciona como en bash

zsh entiende casi toda la sintaxis de bash. Las pipes, las redirecciones, las
variables, `if`, `for` y las funciones funcionan como estás acostumbrado:

```sh
for f in ~/dokument/*.txt; do wc -l $f; done
```

### Función 1: `**` busca en todos los subdirectorios

En zsh, `**/` significa «todos los directorios, a cualquier nivel». Esto lista
todos los archivos `.txt` de tu directorio personal y de todo lo que hay
debajo:

```sh
ls ~/**/*.txt
```

En bash, `**` funciona como un `*` normal, a menos que antes lo actives con
`shopt -s globstar`.

### Función 2: autocd

Con la opción `autocd` (que forma parte de los ajustes recomendados) solo
tienes que escribir el nombre de un directorio para ir a él, sin `cd`:

```sh
dokument
..
```

Las opciones se activan y desactivan con `setopt` y `unsetopt`:

```sh
setopt
unsetopt autocd
setopt autocd
```

### Una diferencia a tener en cuenta: las variables no se dividen

En bash, una variable sin comillas se divide por los espacios. En zsh, no:

```sh
filer="a.txt b.txt"
for f in $filer; do echo "[$f]"; done
```

bash escribe `[a.txt]` y `[b.txt]`; zsh escribe `[a.txt b.txt]`. La forma de
zsh suele ser lo que quieres, pero significa que un script de bash no siempre
hace lo mismo en zsh. (Con `setopt shwordsplit`, zsh se comporta como bash).

No hace falta iniciar un shell para probar un solo comando en él. Con `-c`, el
shell ejecuta el comando y termina enseguida: `zsh -c 'echo $0'` imprime `zsh`,
y después sigues en bash.

La pregunta de abajo empieza en una terminal nueva, así que primero instala
zsh. `> /dev/null 2>&1` descarta la salida de esa línea. ¿Qué imprime el
último comando?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ zsh -c 'filer="x.txt y.txt z.txt"; for f in $filer; do echo "<$f>"; done'
<x.txt y.txt z.txt>
---
zsh no divide la variable por los espacios, así que el bucle se ejecuta una vez
con el valor completo. En bash, el mismo bucle imprimiría tres líneas: `<x.txt>`,
`<y.txt>` y `<z.txt>`.
```

### ~/.zshrc y el prompt

bash lee `~/.bashrc` al iniciarse; zsh lee `~/.zshrc`. Mira el archivo que ha
creado zsh-newuser-install:

```sh
cat ~/.zshrc
```

El prompt se define con la variable `PROMPT` y usa códigos con `%`:

| Código | Significa |
|---|---|
| `%n` | El nombre de usuario |
| `%m` | El nombre del ordenador |
| `%~` | El directorio completo (con `~` para tu directorio personal) |
| `%1~` | Solo la última parte del directorio |
| `%#` | `%` para usuarios normales, `#` para root |
| `%F{green}` … `%f` | Color (red, green, blue, yellow…) |

Pruébalo:

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

El cambio solo dura hasta que salgas de zsh. Si lo quieres siempre, pon la
línea en `~/.zshrc`.

### Oh My Zsh

Muchos usuarios de zsh instalan **Oh My Zsh**, una colección de temas y
plugins: por ejemplo, información de Git en el prompt, mejor autocompletado
con el tabulador y sugerencias mientras escribes. Se instala con un script
desde la web del proyecto y se configura en `~/.zshrc`. No está disponible en
el simulador, pero ahora ya sabes a qué se refiere la gente cuando habla de
él.

### Volver a bash

zsh es un proceso que se ejecuta dentro de bash. Sal con `exit` y estarás de
vuelta en bash, donde las variables, los alias y los cambios de directorio de
zsh ya no existen:

```sh
exit
echo $0
```

## fish: el shell interactivo amigable

fish quiere ser fácil de usar desde el primer momento, sin configuración:
colores, autocompletado con el tabulador y **autosugerencias**: fish te
sugiere el resto del comando en texto gris, basándose en tu historial, y
aceptas la sugerencia con la tecla de flecha derecha. (El simulador no muestra
sugerencias, pero la sintaxis funciona).

### Instalar e iniciar fish

fish se instala con apt de la misma manera; en otras distribuciones, con su
propio gestor de paquetes:

```sh
sudo apt update
sudo apt install fish
```

```sh
fish
```

fish te da la bienvenida y el prompt pasa a ser `elev@ubuntu ~>`. Baja
unos cuantos directorios y mira cómo fish acorta la ruta en el prompt:

```sh
mkdir -p ~/dokument/projekt
cd ~/dokument/projekt
cd ~
```

En el directorio `~/dokument/projekt`, el prompt muestra `~/d/projekt>`: todos
los directorios menos el último se acortan a una sola letra.

### fish tiene su propia sintaxis

Aquí es donde fish más se diferencia de bash y zsh:

| Esto | bash y zsh | fish |
|---|---|---|
| Asignar una variable | `frukt=äpple` | `set frukt äpple` |
| Variable de entorno | `export EDITOR=nano` | `set -x EDITOR nano` |
| Eliminar una variable | `unset frukt` | `set -e frukt` |
| Sustitución de comandos | `$(pwd)` | `(pwd)` |
| Último estado de salida | `$?` | `$status` |
| Argumentos del script | `$@`, `$1` | `$argv`, `$argv[1]` |
| Condición | `if …; then …; fi` | `if …; …; end` |
| Bucle | `for …; do …; done` | `for …; …; end` |
| Función | `hej() { …; }` | `function hej; …; end` |
| Aritmética | `$((17 * 23))` | `math 17 x 23` |

### Variables con set

Prueba a asignar una variable a la manera de bash (`frukt` es «fruta» en sueco
y `äpple`, «manzana»):

```sh
frukt=äpple
```

fish se niega y te dice cómo escribirlo:

```text
fish: Unsupported use of '='. In fish, please use 'set frukt äpple'.
```

Así se hace en fish:

```sh
set frukt äpple
echo $frukt
set -x EDITOR nano
set -e frukt
```

`-x` (*export*) convierte la variable en una variable de entorno que pueden
ver los programas que inicies, y `-e` (*erase*) la elimina.

En fish, todas las variables son **listas**. Los elementos se numeran desde
1:

```sh
set frukter äpple päron banan
echo $frukter[2]
count $frukter
```

`-c` también funciona en fish. ¿Qué imprime el último comando?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'set frukter äpple päron banan; echo $frukter[3]'
banan
---
Los elementos de una lista de fish se numeran desde 1, así que `[3]` es el
tercer y último elemento.
```

### Sustitución de comandos y $status

En fish, la sustitución de comandos se escribe con paréntesis normales:

```sh
echo "Estoy en" (pwd)
```

Dentro de las comillas, los paréntesis son texto normal; por eso `(pwd)` va
fuera. El estado de salida del último comando se llama `$status`:

```sh
false
echo $status
```

### and, or y not

fish tiene sus propios comandos para encadenar condiciones:

```sh
test -f ~/.bashrc; and echo exists
test -f ~/missing.txt; or echo missing
```

Las versiones más recientes de fish (3.0 y posteriores) también entienden `&&`
y `||`, y desde la 3.4 también funciona `$(...)`. Pero `X=1`, `$?` y `$((...))`
siguen sin funcionar: dan errores que te indican la forma de hacerlo en fish.

### Los bloques terminan con end

En fish, todos los bloques (`if`, `for`, `while`, `switch` y `function`)
terminan con `end`. No hay `then`, `do`, `done` ni `fi`:

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo exists; else; echo missing; end
```

También puedes escribir el bloque en varias líneas. El shell espera a `end`
antes de ejecutar el bucle:

```sh
for f in ~/dokument/*.txt
echo (basename $f)
end
```

Las funciones reciben sus argumentos en la lista `$argv`:

```sh
function hello; echo "¡Hola $argv!"; end
hello Kim
```

### Aritmética con math

fish no tiene `$((...))`. En su lugar está el comando `math`, que además
maneja decimales:

```sh
math 17 x 23
math 10 / 4
```

Escribe `x` (o `"17 * 23"` entre comillas) para multiplicar: un `*` suelto es
un comodín en fish, igual que en bash.

### Ajustes de fish

fish lee `~/.config/fish/config.fish` al iniciarse. Si quieres quitarte de
encima el mensaje de bienvenida, vacía la variable `fish_greeting`. Con `-U`
la variable pasa a ser **universal**: se guarda en
`~/.config/fish/fish_variables` y se aplica en todos los shells fish, incluso
después de reiniciar.

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

Sal de fish con `exit`:

```sh
exit
```

## Por qué los scripts se siguen escribiendo para bash

Qué shell usas en la terminal es cuestión de gustos. Pero los **scripts** se
escriben casi siempre para bash (o para el `sh` de POSIX):

- bash está instalado prácticamente en todos los sistemas Linux; zsh y fish
  no.
- La sintaxis de fish no funciona en bash, ni al revés.
- La línea `#!` al principio del script decide qué shell lo ejecuta,
  **independientemente** del shell en el que estés.

Prueba a escribir un script de bash y ejecutarlo desde fish:

```sh
cat > ~/hej.sh << 'SLUT'
#!/bin/bash
name=Kim
echo "Hola $name, me ejecuta bash"
SLUT
chmod +x ~/hej.sh
fish
~/hej.sh
exit
```

El script funciona en fish, aunque `name=Kim` esté prohibido allí, porque lo
ejecuta bash. Por eso `#!/bin/bash` (o `#!/usr/bin/env bash`) es tan
importante. Un script que tiene que funcionar en todas partes, incluso donde
no hay bash, se escribe con `#!/bin/sh` y solo con sintaxis POSIX.

```quiz
Estás en fish y ejecutas un script que empieza con `#!/bin/bash` y contiene la
línea `count=3`. ¿Qué ocurre?
- [ ] fish se niega, porque `count=3` no está permitido en fish
- [x] Funciona: lo ejecuta bash, estés en el shell que estés
- [ ] Solo funciona si antes cambias tu shell de inicio de sesión a bash con `chsh`
---
La línea `#!` decide qué shell ejecuta el script. fish solo lo inicia.
```

## Cambiar tu shell por defecto con chsh

Escribir `zsh` cada vez que abres una terminal acaba cansando. Con `chsh`
(*change shell*) cambias tu **shell de inicio de sesión**, el que está en
`/etc/passwd`:

```sh
chsh -s /usr/bin/zsh
grep elev /etc/passwd
```

- El shell tiene que indicarse con su ruta completa y estar en `/etc/shells`.
- `chsh` te pide la contraseña (el simulador se lo salta).
- El cambio tiene efecto en el **próximo inicio de sesión**. La terminal que
  tienes abierta conserva su shell anterior, y `$SHELL` solo cambia cuando
  vuelves a iniciar sesión.
- root puede cambiar el shell de otros: `sudo chsh -s /usr/bin/fish kim`.

Para volver a bash, haz lo mismo:

```sh
chsh -s /bin/bash
```

Un consejo habitual con fish es mantener bash como shell de inicio de sesión y
dejar que el programa de terminal inicie fish: así sigue funcionando todo lo
que espera un shell POSIX al iniciar sesión.

La pregunta empieza en una terminal nueva, instala zsh y lo convierte en el
shell de inicio de sesión. ¿Qué imprime el último comando?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ chsh -s /usr/bin/zsh > /dev/null 2>&1
$ echo $SHELL
/bin/bash
---
`chsh` cambió tu línea en `/etc/passwd`, pero el cambio tiene efecto en el
próximo inicio de sesión. La terminal que tienes abierta conserva bash, y
`$SHELL` también.
```

## ¿Qué shell deberías elegir?

- **bash**: el estándar en todas partes. Lo que aprendes aquí funciona en
  cualquier servidor en el que vayas a iniciar sesión. Escribe tus scripts
  para bash.
- **zsh**: para ti si quieres más comodidad pero mantener la sintaxis de bash.
  Oh My Zsh te da temas y plugins.
- **fish**: la mejor experiencia sin configurar nada, pero con otra sintaxis.
  Los comandos que copias de la web no siempre funcionan.
- **sh/dash**: para scripts que tienen que funcionar en todas partes, y en
  sistemas pequeños.

## Resumen

| Comando | Hace |
|---|---|
| `cat /etc/shells` | Listar los shells que se pueden usar |
| `echo $0` / `ps` | Ver qué shell estás ejecutando ahora mismo |
| `echo $SHELL` | Ver tu shell de inicio de sesión |
| `zsh` / `fish` / `exit` | Iniciar otro shell / volver |
| `ls ~/**/*.txt` | Buscar en todos los subdirectorios (zsh, fish) |
| `setopt autocd` | Activar una opción de zsh |
| `set frukt äpple` | Asignar una variable en fish |
| `set -x NAME value` | Asignar una variable de entorno en fish |
| `chsh -s /usr/bin/zsh` | Cambiar tu shell de inicio de sesión |

Los archivos de configuración: `~/.bashrc` (bash), `~/.zshrc` (zsh) y
`~/.config/fish/config.fish` (fish).
