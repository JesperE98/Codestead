# Resumen: Lo básico

Has aprendido los comandos que usarás todos los días, en todas las
distribuciones. Aquí tienes un repaso rápido antes del examen.

## Moverse por el sistema de archivos

Todo está en un único árbol que empieza en la raíz, `/`. La configuración está
en `/etc`, los programas en `/usr/bin`, los registros en `/var/log` y tus
propios archivos en tu directorio personal, `~`. `pwd` muestra dónde estás,
`ls` lista lo que hay y `cd` te lleva a otro sitio. Una ruta **absoluta**
empieza por `/`; una ruta **relativa** parte del directorio en el que estás.
`..` es el directorio de arriba, y `cd` sin argumentos te lleva a casa.

## Archivos y directorios

`mkdir` crea directorios (`-p` crea varios niveles a la vez) y `touch` crea
archivos vacíos. `cp` copia (`-r` para directorios enteros), `mv` mueve y
también cambia el nombre, y `rm` borra, para siempre: no hay papelera.
`rmdir` solo elimina directorios vacíos; `rm -r` elimina un directorio y todo
lo que contiene. La shell expande los comodines como `*`, `?` y `[abc]` antes
de que se ejecute el comando, y los nombres con espacios necesitan comillas.

## Leer y buscar texto

`cat` muestra un archivo y `less` te deja desplazarte por él. `head` y `tail`
muestran el principio y el final (`-n` elige cuántas líneas, `tail -f` sigue
un archivo). `wc` cuenta líneas, palabras y bytes. `grep` muestra las líneas
que coinciden con un patrón, `sort` ordena líneas y `uniq` elimina las líneas
repetidas que están una al lado de otra. `man` muestra el manual de un
comando.

## Redirecciones y pipes

Todo programa tiene tres flujos: stdin, stdout y stderr. `>` envía stdout a un
archivo (y lo sobrescribe), `>>` añade al final, `<` lee stdin desde un
archivo y `2>` redirige los mensajes de error, por ejemplo a `/dev/null`. Una
pipe `|` envía la salida de un comando al siguiente, y `tee` guarda una copia
por el camino. `;`, `&&` y `||` ejecutan varios comandos en una línea.

## Procesar texto con sed, tr y awk

`tr` sustituye, borra (`-d`) o comprime (`-s`) caracteres sueltos y solo lee
stdin. `sed` edita líneas: `s/viejo/nuevo/` sustituye (`g` para todas las
coincidencias), las direcciones eligen líneas, `d` borra y `-n` con `p`
muestra solo lo que pides. `sed -i` modifica el propio archivo. `cut` extrae
un campo, y `awk` trabaja con columnas: `-F` fija el separador, `$1` … `$NF`
son los campos, un patrón delante de `{ }` elige líneas y `END { }` se ejecuta
después de la última línea.

## Comandos y opciones

| Comando | Qué hace | Opciones y sintaxis de esta parte |
|---|---|---|
| `pwd` | Muestra el directorio en el que estás | |
| `ls` | Lista el contenido de un directorio | `-l` formato largo, `-a` también archivos ocultos |
| `cd` | Cambia de directorio | `..` arriba, `~` casa, `-` el último directorio, sin argumento = casa |
| `mkdir` | Crea un directorio | `-p` varios niveles a la vez |
| `touch` | Crea un archivo vacío | |
| `cp` | Copia | `-r` directorios enteros |
| `mv` | Mueve o cambia el nombre | |
| `rm` | Borra | `-r` directorios y su contenido, `-f` sin preguntas |
| `rmdir` | Elimina un directorio vacío | |
| `cat` | Muestra un archivo | |
| `less` | Muestra un archivo página a página | `/palabra` busca, `q` sale |
| `head` / `tail` | Las primeras / últimas líneas | `-n N` número de líneas, `tail -f` sigue |
| `wc` | Cuenta líneas, palabras y bytes | `-l` solo líneas |
| `grep` | Muestra las líneas que coinciden | `-i`, `-n`, `-v`, `-c`, `-r`, `-E` |
| `sort` | Ordena líneas | `-n` números, `-r` orden inverso |
| `uniq` | Elimina líneas repetidas contiguas | `-c` las cuenta |
| `man` | Muestra la página del manual | |
| `tee` | Pasa la entrada y guarda una copia | |
| `tr` | Traduce caracteres | `-d` borrar, `-s` comprimir |
| `sed` | Edita un flujo de líneas | `s/…/…/g`, `d`, `p`, `q`, `-n`, `-i`, `-E`, `-e` |
| `cut` | Extrae campos | `-d` separador, `-f` campo |
| `awk` | Trabaja con columnas | `-F` separador, `$1`, `$NF`, `NF`, `NR`, `BEGIN`, `END` |

| Sintaxis | Significa |
|---|---|
| `>` / `>>` | stdout a un archivo (sobrescribir / añadir) |
| `<` | stdin desde un archivo |
| `2>` | stderr a un archivo, p. ej. `2> /dev/null` |
| `2>&1` | stderr por el mismo camino que stdout |
| `\|` | Pipe: el stdout de un comando al stdin del siguiente |
| `a ; b` | Ejecuta a y luego b |
| `a && b` | Ejecuta b solo si a tuvo éxito |
| `a \|\| b` | Ejecuta b solo si a falló |
| `*`, `?`, `[abc]` | Comodines para nombres de archivo |
