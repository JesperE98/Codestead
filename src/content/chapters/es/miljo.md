# Variables, PATH y alias

La shell tiene su propia memoria en forma de **variables**. En este capítulo
aprenderás a leerlas y asignarlas, cómo encuentra la shell los programas y
cómo crear tus propios atajos.

## Variables de entorno

Una variable se lee poniendo un `$` delante de su nombre:

```sh
echo $HOME
echo "Me llamo $USER"
```

`env` muestra todas las *variables de entorno*, es decir, las variables que
también pueden leer los programas que arrancas:

```sh
env
```

Una variable se crea con `NOMBRE=valor` (¡sin espacios alrededor del `=`!).
Con `export` se convierte en una variable de entorno:

```sh
export EDITOR=nano
```

## Comillas simples y dobles

Hay una diferencia importante:

```sh
echo "Inicio: $HOME"
echo 'Inicio: $HOME'
```

Dentro de comillas **dobles**, las variables se sustituyen por su valor.
Dentro de comillas **simples**, todo se imprime exactamente como está escrito.

## PATH: ¿dónde se encuentran los comandos?

Cuando escribes `ls`, la shell busca un archivo llamado `ls` en los
directorios que aparecen en la variable `PATH`, uno tras otro:

```sh
echo $PATH
```

`which` muestra dónde se encontró un programa. Algunos comandos, como `cd`, no
son archivos, sino que están *integrados* en la shell (son *builtins*); `type`
te dice qué es un nombre:

```sh
which ls
type cd
```

Si quieres ejecutar un programa que no está en `PATH`, tienes que indicar su
ruta, por ejemplo `./miprograma` para un archivo del directorio en el que
estás.

## Códigos de salida – `$?`

Todo comando deja un **código de salida** al terminar: `0` significa que todo
fue bien, y cualquier otro valor indica un error. El último código de salida
se guarda en `$?`:

```sh
ls /finnsinte
echo $?
```

Es el código de salida lo que miran `&&` y `||`.

## Alias

Un **alias** es un atajo propio:

```sh
alias ll='ls -la'
ll
```

`alias` sin argumentos muestra todos los alias, y `unalias ll` elimina uno.

## Guardar la configuración – `~/.bashrc`

Las variables y los alias que creas desaparecen al cerrar la terminal. Para
conservarlos, ponlos en el archivo `~/.bashrc`, que bash lee cada vez que se
abre una terminal nueva. Después de modificar el archivo, puedes cargarlo
enseguida con:

```sh
source ~/.bashrc
```
