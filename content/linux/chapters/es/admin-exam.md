# Examen: Administración del sistema

Demuestra lo que has aprendido sobre servicios, discos y usuarios. Las
preguntas abarcan toda la parte, y necesitas un 80 % de aciertos para aprobar.

```quiz
`minserver` debe arrancar automáticamente cada vez que se inicia el ordenador,
pero **no** debe iniciarse ahora mismo. ¿Qué comando hace exactamente eso?
- [ ] `sudo systemctl start minserver`
- [x] `sudo systemctl enable minserver`
- [ ] `sudo systemctl enable --now minserver`
- [ ] `sudo systemctl restart minserver`
---
`enable` se aplica al arrancar, `start` se aplica ahora, y `--now` hace las
dos cosas.
```

El servicio `rapportd` de este ordenador no ha conseguido arrancar. ¿Qué
muestra este comando?

```predict
$ systemctl is-active rapportd
failed
---
`is-active` muestra una sola palabra: aquí el mismo estado que lista
`systemctl --failed`. El estado de salida es 0 solo cuando la respuesta es
`active`.
```

```quiz
Quieres vigilar el log de `minserver` mientras lo pruebas, viendo las líneas
nuevas a medida que llegan. ¿Qué comando usas?
- [ ] `journalctl -n 20`
- [x] `journalctl -u minserver -f`
- [ ] `journalctl -p err -b`
- [ ] `systemctl status minserver --all`
---
`-u` elige una unidad y `-f` sigue mostrando líneas nuevas hasta que pulsas
Ctrl+C.
```

```try
systemctl cat minserver
---
`ExecStart=` es el comando que inicia el servicio, y `WantedBy=` es lo que
usa `enable`.
```

```quiz
Ejecutas `systemctl stop minserver` sin `sudo` y obtienes
*Interactive authentication required*. ¿Por qué?
- [ ] minserver no se está ejecutando
- [x] Todo lo que modifica un servicio requiere root
- [ ] Primero tienes que ejecutar `daemon-reload`
- [ ] `stop` solo funciona con servicios habilitados
```

```quiz
¿Por qué `/etc/fstab` suele poner `UUID=…` en lugar de `/dev/sda2`?
- [ ] Los UUID son más cortos de escribir
- [x] Los nombres de dispositivo pueden cambiar al añadir discos, pero un UUID nunca cambia
- [ ] `mount` no entiende los nombres de dispositivo
- [ ] El UUID muestra lo lleno que está el sistema de archivos
---
El UUID se crea junto con el sistema de archivos. Lo encuentras con
`lsblk -f`, `blkid` o `findmnt`.
```

```quiz
`df -h` muestra que `/` está lleno al 98 %. ¿Qué comando te ayuda a encontrar
**qué directorios** ocupan el espacio?
- [ ] `df -hT`
- [ ] `lsblk -f`
- [x] `du -h -d 1`
- [ ] `swapon --show`
---
`df` pregunta al sistema de archivos lo lleno que está; `du` recorre los
archivos y los suma.
```

Tu directorio personal no está en un sistema de archivos propio en este
ordenador. ¿Qué muestra esto?

```predict
$ df -h ~ | awk 'NR > 1 {print $6}'
/
---
Si le das una ruta, `df` muestra solo el sistema de archivos en el que está.
La sexta columna es `Mounted on`: el sistema de archivos raíz.
```

```quiz
Has añadido una línea a `/etc/fstab`. ¿Qué deberías hacer **antes** de
reiniciar?
- [ ] Nada: el archivo solo se lee al arrancar
- [x] Probarlo con `sudo mount -a`
- [ ] Ejecutar `sudo systemctl daemon-reload`
- [ ] Formatear la partición con `mkfs`
---
Un error en `/etc/fstab` puede impedir que el ordenador arranque bien.
`mount -a` monta todo lo del archivo que aún no está montado, así que ves los
errores ahora.
```

```quiz
Vas a formatear una partición con `mkfs` en un ordenador real. ¿Qué deberías
comprobar primero? (Elige todas las correctas).
- [x] Con `lsblk -f`, que el tamaño, la columna `RM` y la etiqueta coinciden
- [x] Que la partición no está montada
- [x] Que tienes una copia de seguridad de todo lo importante
- [ ] Que la partición aparece en `/etc/fstab`
```

```quiz
¿Por qué los hashes de las contraseñas están en `/etc/shadow` y no en `/etc/passwd`?
- [ ] `/etc/passwd` es demasiado pequeño
- [x] `/etc/passwd` debe poder leerlo todo el mundo, pero `/etc/shadow` solo root
- [ ] Los hashes son reversibles, así que hay que ocultarlos
- [ ] `/etc/passwd` solo se lee al arrancar
---
Si no, cualquiera podría copiar los hashes e intentar descifrarlos con toda
la calma. `ls -l` necesita `/etc/passwd` para mostrar los nombres de los
propietarios.
```

Los campos de `/etc/group` son el nombre del grupo, `x`, el GID y los
miembros. ¿Quién está en el grupo `sudo`?

```predict
$ grep ^sudo /etc/group | cut -d: -f4
elev
```

```quiz
¿Qué pasa con `sudo userdel kim`, sin `-r`?
- [x] Se borra el usuario, pero el directorio personal `/home/kim` se queda
- [ ] Nada: `userdel` siempre necesita `-r`
- [ ] Se borran el usuario y su directorio personal
- [ ] Solo se bloquea la cuenta
```

```quiz
Un usuario tiene el UID 33 y la shell `/usr/sbin/nologin`. ¿Qué es lo más probable?
- [ ] root
- [ ] Un usuario normal: una persona
- [x] Un usuario del sistema con el que se ejecuta un servicio
- [ ] Un usuario borrado
---
Los UID 1–999 son para usuarios del sistema, y `nologin` significa que nadie
puede iniciar sesión como ellos.
```

```try
getent group sudo
---
`getent` busca el grupo de la misma forma que lo hace el sistema.
```
