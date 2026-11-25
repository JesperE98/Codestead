# Proyecto: Incorporación el lunes

Viernes, las tres y media. Tu jefa se asoma por la puerta:
«Ah, por cierto: {{newUser}} se incorpora al equipo de soporte el lunes. ¿Puedes
dejarlo todo listo? La cuenta, la carpeta del equipo, la lectura de la primera
semana. Y que esta vez funcione la intranet: la última persona nueva se pasó toda
la primera mañana mirando *Couldn't connect to server*».

Todo lo que necesitas está en *Administración del sistema* (usuarios y grupos,
discos y servicios), con un poco de ayuda de las partes anteriores. Aquí no hay
nada nuevo; el reto es juntar las piezas por tu cuenta, para que el lunes por la
mañana todo salga sin contratiempos.

## La misión

1. **Una cuenta.** Crea el usuario `{{newUser}}` con directorio personal y
   `/bin/bash` como shell, y ponle una contraseña a la cuenta.
2. **El equipo.** Crea el grupo `{{teamGroup}}` y añade tanto a `{{newUser}}` como
   a ti. `{{newUser}}` no tiene derechos de sudo; todavía no, eso llega después del
   periodo de prueba.
3. **La carpeta compartida.** Crea `/srv/{{teamGroup}}`, que pertenece al grupo
   `{{teamGroup}}`. El grupo puede leer, escribir y entrar en la carpeta; los demás
   no pueden hacer nada de nada.
4. **Prueba la cuenta.** Conviértete en `{{newUser}}`, crea un archivo en la
   carpeta compartida para demostrar que los permisos funcionan y vuelve a tu
   propia cuenta.
5. **El paquete de bienvenida.** La lectura de la primera semana, `{{report}}`,
   está en la memoria USB (`/dev/sdb1`). Pon una copia en el directorio personal
   de `{{newUser}}` (que pertenezca a `{{newUser}}`, no a root) y desmonta la
   memoria cuando termines.
6. **La intranet.** La intranet del equipo es el servicio `myserver`. Asegúrate
   de que se está ejecutando ahora **y** de que arranca solo cada vez que arranca
   el ordenador.
7. **Ensayo general.** Reinicia el ordenador y muestra en el journal que la
   intranet arrancó sola en este arranque.

Los hitos de la lista junto a este texto se comprueban automáticamente cuando ejecutas
tus comandos.

## Consejos por el camino

- Casi todo aquí modifica el sistema, así que la mayoría de los comandos necesitan
  `sudo`.
- `usermod -aG`: no olvides la `-a`, o el usuario sale de todos sus otros grupos.
  `id {{newUser}}` muestra en qué grupos está una cuenta.
- `ls -ld` muestra el propietario, el grupo y los permisos de un directorio.
  Cuenta los permisos en octal: *rwx* es 7 y nada es 0.
- Un archivo que copias con `sudo` pertenece a root. Cópialo mejor *como* la
  persona nueva (con `su -` o `sudo -u`) y pertenecerá a quien debe desde el
  principio.
- ¿Ya hay ahí una copia que pertenece a root? `{{newUser}}` puede borrarla (está en
  su propio directorio personal) y volver a copiarla.
- ¿`umount` dice *target is busy*? Tu propio shell está dentro del directorio:
  primero `cd ~`.
- `start` y `enable` son dos cosas distintas. `systemctl is-active` y
  `systemctl is-enabled` muestran cómo están las cosas.
- Después de reiniciar, `journalctl -b` muestra solo el arranque actual.

## ¿Quieres hacer más?

Cuando termines los hitos, puedes seguir. ¿Cabrán los archivos de la persona
nueva? `df -h` y `du -sh` lo saben. Bloquea la cuenta con `usermod -L` hasta el
lunes por la mañana, compruébalo con `passwd -S` y desbloquéala con
`usermod -U`. Y mira tu trabajo desde el lado del sistema: las líneas de
`{{newUser}}` en `/etc/passwd` y `/etc/group`, y `systemctl status myserver`.
