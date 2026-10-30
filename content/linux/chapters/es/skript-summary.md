# Resumen: Scripts y automatización

En esta parte has convertido comandos en programas propios.

## Scripts de shell

Un script es un archivo de texto con comandos que empieza por el shebang
`#!/bin/bash`. Puedes escribirlo con un here document (`cat > file << 'SLUT'`),
hacerlo ejecutable con `chmod +x` y ejecutarlo con `./`. Las líneas que
empiezan por `#` son comentarios.

Creas variables con `nombre=valor`, sin espacios, y las usas dentro de
comillas dobles: `"$nombre"`, o `"${nombre}_texto"` cuando el texto va justo
detrás. `$(comando)` se sustituye por lo que muestra el comando, y `$(( ))`
hace aritmética con números enteros. Un script lee sus argumentos de `$1`,
`$2` …, `$#` y `"$@"`.

`if` mira el código de salida de un comando, normalmente el comando de prueba
`[ ]`. Los números se comparan con `-eq`, `-lt` y compañía; el texto con `=` y
`!=`. `for` recorre una lista, `while` sigue mientras una condición sea
verdadera, y `while read` recorre un archivo línea a línea. `case` elige entre
patrones, las funciones son trozos de código con nombre y su propio `$1`, y
`read` pide datos al usuario. `exit 1` le dice a quien llamó al script que
algo salió mal.

## Comandos y sintaxis

| Sintaxis | Qué hace |
|---|---|
| `#!/bin/bash` | El shebang: qué programa ejecuta el script |
| `cat > file << 'SLUT'` | Escribe líneas en un archivo hasta la línea `SLUT` |
| `name=value` · `"$name"` · `"${name}"` | Crea · usa una variable |
| `$(command)` | Se sustituye por lo que muestra el comando |
| `$(( a * 6 ))` · `(( a++ ))` | Aritmética entera · modifica una variable |
| `$0` · `$1` · `$#` · `"$@"` | El nombre del script · primer argumento · número de argumentos · todos los argumentos |
| `if [ ... ]; then ...; elif ...; else ...; fi` | Condiciones |
| `-f` · `-d` · `-z` | El archivo existe · el directorio existe · la variable está vacía |
| `=` · `!=` | Texto igual · distinto |
| `-eq` · `-ne` · `-lt` · `-le` · `-gt` · `-ge` | Compara números |
| `[[ $file == *.txt ]]` | La prueba más lista de bash, con patrones |
| `for x in list; do ...; done` | Recorre una lista |
| `while [ ... ]; do ...; done` | Repite mientras la condición sea verdadera |
| `while read line; do ...; done < file` | Recorre un archivo línea a línea |
| `break` · `continue` | Sale del bucle · pasa a la siguiente vuelta |
| `case $x in pattern) ...;; *) ...;; esac` | Elige según un patrón |
| `name() { ...; }` · `local` · `return` | Una función · variable local · termina la función |
| `read -p "Question " var` | Lee una línea del teclado |
| `exit 1` | Termina el script con un código de salida |
| `set -euo pipefail` | Detiene el script en el primer error |
