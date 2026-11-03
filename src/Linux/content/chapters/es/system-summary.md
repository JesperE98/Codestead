# Resumen: El sistema

En esta parte has visto lo que ocurre alrededor de tus comandos: la memoria de
la shell, quién puede hacer qué, qué programas se están ejecutando y cómo se
empaquetan los archivos.

## Variables, PATH y alias

Lees una variable con `$NOMBRE` y creas una con `NOMBRE=valor`, sin espacios
alrededor del `=`. `export` la convierte en una variable de entorno, que
también pueden leer los programas que inicias. Dentro de comillas dobles las
variables se sustituyen por su valor; dentro de comillas simples todo se
muestra tal cual está escrito. La shell busca los comandos en los directorios
de `PATH`, y `$?` guarda el código de salida del último comando: `0` significa
que salió bien. Los alias y las variables desaparecen al cerrar la terminal, a
menos que los pongas en `~/.bashrc`.

## Usuarios, permisos y sudo

Cada archivo tiene un propietario, un grupo y tres juegos de permisos: para el
propietario, el grupo y los demás. `r` = 4, `w` = 2 y `x` = 1, así que `755`
es `rwxr-xr-x` y `600` es `rw-------`. Un script necesita el permiso `x` y se
ejecuta con `./` porque el directorio en el que estás no forma parte de
`PATH`. `sudo` ejecuta un solo comando como root y te pide tu propia
contraseña. En Ubuntu pueden usarlo los usuarios del grupo `sudo`.

## Enlaces e información de archivos

El contenido y los permisos de un archivo están en un **inodo**, y los nombres
de un directorio apuntan a inodos. `ln -s` crea un **enlace simbólico**, un
archivo pequeño con una ruta, que se rompe si el destino desaparece; una ruta
relativa dentro de él se cuenta desde el propio directorio del enlace. `ln`
sin `-s` crea un **enlace duro**, un nombre más para el mismo inodo. `stat`
muestra todo sobre un archivo, `file` dice qué contiene, se llame como se
llame, y la **umask** decide los permisos de los archivos nuevos: con `022`
reciben `644`, con `077` solo `600`.

## Procesos y trabajos

Cada programa en ejecución es un proceso con un PID y un padre (PPID).
`ps aux` los muestra todos, y `top` los muestra en directo, ordenados por uso
del procesador. `kill` envía una señal: `SIGTERM` (15) por defecto, y
`SIGKILL` (9) como último recurso. Con `&` un comando se ejecuta en segundo
plano, y `jobs`, `fg` y `bg` te permiten gestionar los trabajos de tu
terminal. `nohup` mantiene un comando en marcha después de cerrar la sesión, y
`watch` ejecuta un comando una y otra vez.

## Archivos comprimidos y compresión

`tar` reúne archivos en un único archivo empaquetado y `gzip` hace más pequeño
un solo archivo; juntos te dan un `.tar.gz`. Exactamente una de `c`, `x` y `t`
le dice a tar qué hacer, y a `f` le sigue el nombre del archivo empaquetado.
`zcat` lee un archivo `.gz` sin descomprimirlo, y `zip -r` / `unzip` manejan
archivos zip, que son fáciles de compartir con Windows y macOS.

## Comandos y opciones

| Comando | Qué hace |
|---|---|
| `echo $NAME` | Muestra el valor de una variable |
| `export NAME=value` | Crea una variable de entorno |
| `env` | Lista todas las variables de entorno |
| `which ls` · `type cd` | Muestra dónde está un programa · qué es un nombre |
| `echo $?` | Muestra el código de salida del comando anterior |
| `alias ll='ls -la'` · `unalias ll` | Crea · elimina un alias |
| `source ~/.bashrc` | Carga `~/.bashrc` en el acto |
| `id` · `groups` | Muestra tu usuario y tus grupos |
| `ls -l` | Muestra permisos, propietario y grupo |
| `chmod 644 file` · `chmod u+x file` | Cambia permisos con números · símbolos |
| `sudo command` · `sudo -i` | Ejecuta un comando como root · inicia una shell de root |
| `sudo tee -a file` | Al final de una pipe: añade texto a un archivo que solo root puede modificar |
| `ln -s target name` · `ln file name` | Crea un enlace simbólico · duro |
| `readlink link` · `realpath path` | Adónde apunta un enlace · la ruta completa sin enlaces |
| `ls -li` | Muestra los números de inodo y los contadores de enlaces |
| `stat file` · `stat -c '%a %U' file` | Todo sobre un archivo · solo lo que pides |
| `file file` | Qué contiene un archivo |
| `umask` · `umask 077` | Muestra · fija los permisos que pierden los archivos nuevos |
| `ps` · `ps aux` · `ps -ef` | Tus procesos · todos los procesos · con el PID del padre |
| `ps aux --sort=-%cpu` | Todos los procesos, los más pesados primero |
| `pgrep -l name` | Encuentra el PID de un proceso por su nombre |
| `top` | Una vista en directo de los procesos |
| `kill PID` · `kill -9 PID` | Pide a un proceso que termine · lo fuerza |
| `pkill pattern` · `killall name` | Detiene procesos por su nombre |
| `command &` | Ejecuta un comando en segundo plano |
| `jobs` · `fg %1` · `bg %1` · `kill %1` | Lista · primer plano · segundo plano · termina un trabajo |
| `nohup command &` | Sigue en marcha después de cerrar la sesión |
| `watch -n 5 command` | Ejecuta un comando cada cinco segundos |
| `uptime` · `free -h` | Carga · memoria |
| `tar -czvf archive.tar.gz dir` | Empaqueta y comprime un directorio |
| `tar -tzvf archive.tar.gz` | Lista el contenido de un archivo empaquetado |
| `tar -xzvf archive.tar.gz -C dir` | Desempaqueta un archivo en un directorio |
| `gzip file` · `gzip -k file` · `gunzip file.gz` | Comprime · conserva el original · descomprime |
| `zcat file.gz` | Lee directamente un archivo comprimido |
| `zip -r archive.zip dir` · `unzip archive.zip -d dir` | Crea · descomprime un archivo zip |
| `du -sh dir` | Muestra cuánto espacio ocupa algo |
