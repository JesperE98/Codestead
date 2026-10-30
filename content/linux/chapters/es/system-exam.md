# Examen: El sistema

Responde las preguntas sobre variables, permisos, procesos y archivos comprimidos; necesitas un 80 % para aprobar.

```predict
$ echo "$HOME" '$USER'
/home/elev $USER
---
Las comillas dobles sustituyen la variable por su valor; las comillas simples
la muestran tal cual está escrita.
```

```quiz
¿Qué hace `export` con una variable?
- [ ] La guarda en `~/.bashrc`
- [x] La convierte en una variable de entorno que también pueden leer los programas que inicias
- [ ] La borra
```

```predict
$ ls ~ > /dev/null
$ echo $?
0
---
`ls` salió bien, así que el código de salida es `0`. La salida en sí
desapareció en `/dev/null`.
```

```quiz
¿Qué número da los permisos `rwxr-x---`?
- [ ] `755`
- [x] `750`
- [ ] `640`
---
Propietario: 4 + 2 + 1 = 7. Grupo: 4 + 1 = 5. Los demás: 0.
```

```predict
$ touch verktyg.sh
$ chmod 755 verktyg.sh
$ chmod go-x verktyg.sh
$ ls -l verktyg.sh | awk '{print $1}'
-rwxr--r--
```

```quiz
En Ubuntu, ¿los miembros de qué grupo pueden usar `sudo`?
- [x] `sudo`
- [ ] `root`
- [ ] `elev`
```

```quiz
¿Qué hace `sudo -i`?
- [ ] Muestra información sobre sudo
- [x] Inicia una shell de root, en la que el prompt cambia a `#`, hasta que escribes `exit`
- [ ] Vuelve a ejecutar el comando anterior como root
```

```quiz
En `ps aux`, un proceso tiene `R` en la columna `STAT`. ¿Qué significa?
- [x] Se está ejecutando
- [ ] Está durmiendo
- [ ] Pertenece a root
```

```quiz
¿Qué variable guarda el PID del último trabajo en segundo plano?
- [ ] `$?`
- [x] `$!`
- [ ] `$#`
```

```quiz
Pruebas `kill 812` con un proceso que pertenece a root y obtienes
`Operation not permitted`. ¿Qué haces?
- [ ] Uso `kill -9 812` en su lugar
- [x] Lo ejecuto con `sudo`: `sudo kill 812`
- [ ] Nada: los procesos de root nunca se pueden detener
```

```quiz
¿Cuál es la diferencia entre `pkill` y `killall`?
- [x] `pkill` busca coincidencias con un patrón, `killall` necesita el nombre exacto
- [ ] `pkill` envía `SIGKILL`, `killall` envía `SIGTERM`
- [ ] No hay ninguna: son el mismo programa
```

```quiz
¿Qué está mal en `tar -cvf dokument dokument.tar`?
- [ ] `-v` no se puede combinar con `-c`
- [x] El orden: el nombre del archivo empaquetado debe ir justo después de `f`, antes de los archivos
- [ ] Un archivo tar tiene que terminar en `.tgz`
```

```predict
$ cp dokument/frukter.txt .
$ gzip frukter.txt
$ gunzip frukter.txt.gz
$ ls frukter*
frukter.txt
```

```quiz
¿Qué hace `zcat server.log.gz`?
- [x] Muestra el contenido descomprimido, y `server.log.gz` se queda como está
- [ ] Descomprime el archivo en `server.log`
- [ ] Comprime el archivo una vez más
---
`zcat` es lo mismo que `gzip -dc`: descomprimir a la salida estándar.
```

```try
du -sh dokument
---
`-s` da un único total para todo el directorio y `-h` hace que el tamaño sea fácil de leer.
```
