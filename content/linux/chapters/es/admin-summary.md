# Resumen: Administración del sistema

En esta parte te has ocupado del ordenador como administrador: los servicios
que se ejecutan en segundo plano, los discos en los que acaban los archivos y
los usuarios que comparten el ordenador. Casi todo lo que **modifica** algo
aquí requiere root, así que `sudo` ha aparecido mucho.

## Servicios y logs con systemd

**systemd** es el proceso número 1 y arranca todo lo demás. Todo lo que
controla es una **unidad**, descrita por un archivo de unidad: los que vienen
con los paquetes están en `/usr/lib/systemd/system`, y los tuyos en
`/etc/systemd/system`, que tienen prioridad. `systemctl` controla los
servicios, y **`start` (ahora) y `enable` (al arrancar) son dos cosas
distintas**. Todo lo que escriben los servicios acaba en el **journal**, que
lees y filtras con `journalctl`. Cuando un servicio no arranca: `systemctl
--failed`, `systemctl status` y luego `journalctl -xeu`, y lee el log palabra
por palabra. En Ubuntu el servicio SSH se llama `ssh`; otras familias a veces
dan otros nombres a los servicios.

## Discos y sistemas de archivos

Un **disco** se divide en **particiones**, y cada partición necesita un
**sistema de archivos** antes de poder guardar archivos. Los discos son
archivos en `/dev` (`/dev/sda`, `/dev/sda1`, …). Linux no tiene letras de
unidad: cada sistema de archivos se **monta** en algún lugar del único árbol
de directorios que empieza en `/`. `lsblk` muestra los discos, `df` lo llenos
que están los sistemas de archivos y `du` lo que ocupan los archivos.
**Desmonta** siempre una memoria USB antes de sacarla, porque puede haber
cambios esperando todavía en la RAM. Lo que se monta al arrancar está en
`/etc/fstab`, preferiblemente por **UUID**, que nunca cambia. `fdisk` y `mkfs`
están entre los comandos más peligrosos que existen: comprueba dos veces.

## Usuarios y grupos

Cada usuario tiene un **UID**: root tiene 0, los usuarios del sistema reciben
números bajos y las personas empiezan en 1000. Los usuarios están en
`/etc/passwd`, los grupos en `/etc/group` y los hashes de las contraseñas en
`/etc/shadow`, que solo root puede leer. Cada usuario tiene un **grupo
principal** y cualquier número de **grupos secundarios**.
`useradd -m -s /bin/bash` crea un usuario, `passwd` fija la contraseña y
`usermod -aG` añade a un grupo: **no olvides la `-a`**. En Ubuntu los derechos
de sudo vienen del grupo `sudo` (otras familias usan `wheel`). `su -` cambia
de usuario con la contraseña de ese usuario, y `sudo -u` ejecuta un comando
como otra persona con la tuya.

## Comandos

| Comando | Qué hace |
|---|---|
| `systemctl status NAME` | ¿Cómo está el servicio? |
| `sudo systemctl start` / `stop` / `restart` / `reload NAME` | Iniciar, detener, reiniciar, releer la configuración |
| `sudo systemctl enable --now NAME` | Iniciar al arrancar, y ahora |
| `systemctl is-active` / `is-enabled NAME` | Una palabra, estado de salida 0 para «sí» |
| `systemctl --failed` | Servicios que han fallado |
| `systemctl cat NAME` | Muestra el archivo de unidad |
| `sudo systemctl daemon-reload` | Vuelve a cargar los archivos de unidad modificados |
| `journalctl -u NAME` | El log de un servicio |
| `journalctl -p err -b` | Errores y cosas peores desde este arranque |
| `journalctl -n 20`, `-f`, `--since today` | Las últimas líneas, seguir, desde medianoche |
| `lsblk -f` | Discos, particiones y sistemas de archivos |
| `blkid`, `findmnt -n -o UUID /` | Tipo, etiqueta y UUID |
| `df -h`, `du -sh DIR` | Lo lleno que está el disco, lo que ocupan los archivos |
| `sudo mount /dev/sdb1 /mnt/usb` | Monta un sistema de archivos |
| `sudo umount /mnt/usb` | Desmonta |
| `cat /etc/fstab`, `sudo mount -a` | Lo que se monta al arrancar, y probar los cambios |
| `swapon --show`, `free -h` | Swap y memoria |
| `id`, `groups` | UID, GID y grupos |
| `sudo useradd -m -s /bin/bash NAME` | Crea un usuario |
| `sudo passwd NAME` | Fija una contraseña |
| `sudo groupadd GROUP` | Crea un grupo |
| `sudo usermod -aG GROUP NAME` | Añade a un grupo |
| `sudo usermod -L` / `-U NAME` | Bloquea / desbloquea una cuenta |
| `sudo userdel -r NAME` | Borra un usuario y su directorio personal |
| `su - NAME`, `sudo -u NAME COMMAND` | Cambia de usuario, ejecuta como otro usuario |
