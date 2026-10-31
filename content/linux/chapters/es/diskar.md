# Discos y sistemas de archivos

¿Dónde acaban realmente los archivos que guardas? En Windows la respuesta es
una letra: `C:`, `D:`, `E:`. Linux no tiene letras de unidad en absoluto, solo
**un** árbol de directorios que empieza en `/`. En este capítulo levantas el
capó: qué discos tiene el ordenador, cómo están divididos, cuánto espacio
queda… y cómo conectar una memoria USB y volver a quitarla sin perder nada.

## Disco, partición y sistema de archivos

Tres palabras que a menudo se confunden, pero que significan cosas distintas:

- Un **disco** es el propio dispositivo de almacenamiento: un SSD, un disco
  duro, una tarjeta SD o una memoria USB.
- Una **partición** es un trozo del disco. Un disco se puede dividir en varias
  particiones que se usan para cosas diferentes. Dónde empieza y termina cada
  partición se guarda en la **tabla de particiones** del disco: en los
  ordenadores nuevos es del tipo **GPT**, y en los más antiguos y en la mayoría
  de memorias USB es la vieja **MBR** (que las herramientas llaman `dos`).
- Un **sistema de archivos** es el orden *dentro* de una partición: cómo se
  guardan los nombres de archivo, los directorios, los permisos y el propio
  contenido. Una partición nueva está vacía y no sirve para nada hasta que
  creas un sistema de archivos en ella: eso es lo que significa
  **formatear**.

Imagina el disco como un almacén vacío, las particiones como las paredes que
lo dividen en habitaciones y el sistema de archivos como las estanterías y las
etiquetas de cada habitación. Sin estanterías no encuentras nada.

```quiz
Acabas de crear una partición nueva en un disco. ¿Por qué todavía no puedes
guardar archivos en ella?
- [ ] Primero hay que añadirla a la tabla de particiones
- [x] Todavía no tiene sistema de archivos: primero hay que formatearla
- [ ] Las particiones no pueden contener archivos, solo los discos
- [ ] Primero tiene que recibir una letra de unidad
---
Una partición nueva está vacía y no sirve para nada hasta que creas un sistema
de archivos en ella. Eso es lo que significa formatear.
```

## Los discos son archivos en `/dev`

En Linux casi todo es un archivo, discos incluidos. Cada disco y cada
partición tiene un **archivo de dispositivo** en `/dev`:

```sh
ls -l /dev/sd*
```

| Archivo de dispositivo | Es |
|---|---|
| `/dev/sda` | El primer disco (SATA, USB o un disco virtual) |
| `/dev/sda1`, `/dev/sda2` | Las particiones 1 y 2 de `sda` |
| `/dev/sdb` | El segundo disco: la memoria USB de este ordenador |
| `/dev/nvme0n1`, `/dev/nvme0n1p1` | Un SSD NVMe y su primera partición |
| `/dev/vda` | Un disco en una máquina virtual |
| `/dev/mmcblk0p1` | La primera partición de una tarjeta SD (p. ej. en una Raspberry Pi) |

Las letras se reparten en el orden en que se encuentran los discos. Si el
ordenador tiene un SSD NVMe, una memoria USB bien puede convertirse en `sda`,
así que **nunca adivines**: compruébalo siempre. Los archivos de dispositivo
pertenecen a root y al grupo `disk`, así que como usuario normal no puedes
leer los discos directamente.

## ¿Qué discos hay? – `lsblk`

`lsblk` (*list block devices*) dibuja los discos como un árbol, con las
particiones debajo de cada disco:

```sh
lsblk
```

| Columna | Significa |
|---|---|
| `NAME` | El nombre en `/dev` |
| `RM` | 1 = extraíble, p. ej. una memoria USB |
| `SIZE` | El tamaño |
| `TYPE` | `disk` o `part` (partición) |
| `MOUNTPOINTS` | Dónde aparece el sistema de archivos en el árbol de directorios; `[SWAP]` para la swap |

En este ordenador, `sda1` es la **partición EFI** (desde la que arranca el
firmware del ordenador) en `/boot/efi`, `sda2` es el **sistema de archivos
raíz** `/` y `sda3` es la **swap**. Otras distribuciones –y otras
instalaciones– pueden dividir el disco de otra forma, así que mira siempre en
lugar de dar nada por supuesto.

Con `-f`, `lsblk` muestra también los sistemas de archivos: tipo, etiqueta,
UUID y cuánto espacio libre queda:

```sh
lsblk -f
```

Fíjate en `sdb1`: un sistema de archivos `vfat` con la etiqueta `USBSTICK`
que no está montado en ninguna parte. Es la memoria
USB que vamos a conectar.

## Distintos sistemas de archivos

Hay muchos sistemas de archivos, con puntos fuertes diferentes:

| Sistema de archivos | Se usa para |
|---|---|
| `ext4` | El estándar clásico de Linux. Estable y rápido; lo usan Debian y Ubuntu |
| `btrfs` | Instantáneas (*snapshots*), compresión y subvolúmenes. Por defecto en Fedora y openSUSE |
| `xfs` | Bueno con archivos grandes y en servidores. Por defecto en Red Hat Enterprise Linux |
| `vfat` (FAT32) | Funciona en todas partes: Windows, macOS, cámaras, radios de coche. Sin permisos de Linux y como máximo 4 GiB por archivo. La partición EFI tiene que ser FAT |
| `exfat` | Como FAT, pero sin el límite de 4 GiB. Habitual en memorias USB y tarjetas SD nuevas |
| `ntfs` | El sistema de archivos de Windows. Linux puede leerlo y escribirlo |
| `swap` | No es un sistema de archivos para archivos: «memoria» extra en el disco |
| `tmpfs` | Un sistema de archivos que solo existe en la RAM y desaparece al reiniciar |

## Todo es un único árbol: montar

**Montar** un sistema de archivos significa engancharlo al árbol de
directorios en un directorio concreto, un **punto de montaje**. El sistema de
archivos raíz se monta en `/`, y todo lo demás se cuelga en algún sitio por
debajo. Por eso Linux se apaña sin letras de unidad: otro disco no es más que
otro directorio.

`findmnt` muestra todos los montajes como un árbol:

```sh
findmnt
```

Y `mount` sin argumentos lista lo mismo, una línea por sistema de archivos:

```sh
mount
```

También verás cosas que no son discos: `proc` en `/proc` y `sysfs` en `/sys`
son información del kernel disfrazada de archivos, y los `tmpfs` son sistemas
de archivos en la RAM. Puntos de montaje habituales:

| Directorio | Se usa para |
|---|---|
| `/` | El sistema de archivos raíz |
| `/boot`, `/boot/efi` | El kernel y la partición EFI |
| `/mnt` | Montajes temporales que haces a mano |
| `/media/{{user}}/…` o `/run/media/{{user}}/…` | Donde el escritorio monta automáticamente las memorias USB |

## ¿Cuánto espacio queda? – `df`

`df` (*disk free*) muestra lo lleno que está cada sistema de archivos montado.
Con `-h` obtienes tamaños legibles para humanos:

```sh
df -h
```

| Columna | Significa |
|---|---|
| `Filesystem` | Dónde está el sistema de archivos, p. ej. una partición o `tmpfs` |
| `Size`, `Used`, `Avail` | Tamaño, usado y disponible |
| `Use%` | El porcentaje ocupado |
| `Mounted on` | El punto de montaje |

`-T` añade el tipo de sistema de archivos, y si das una ruta, solo se muestra
el sistema de archivos en el que está:

```sh
df -hT
df -h ~
```

¿Te has fijado en que `Used` y `Avail` no suman exactamente `Size`? ext4
reserva un 5 % para root, de modo que el sistema sigue funcionando aunque un
usuario normal haya llenado el disco.

```try
df -hT
---
La columna `Type` muestra que `/` es `ext4` y `/boot/efi` es `vfat`.
```

## ¿`df` o `du`?

Dos comandos con casi el mismo nombre, pero que responden a preguntas
distintas:

| Pregunta | Comando |
|---|---|
| ¿Cómo de lleno está el **disco**? | `df -h`: le pregunta al sistema de archivos |
| ¿Cuánto espacio ocupan estos **archivos**? | `du -sh directorio`: recorre los archivos y los suma |

Cuando un disco se llena, usas los dos: primero `df -h` para ver *qué* sistema
de archivos está lleno, y luego `du` para encontrar *qué* ocupa el espacio:

```sh
du -h -d 1 ~
```

## Montar una memoria USB

Ahora vamos a conectar la memoria USB. Primero: ¿qué dispositivo es?
`lsblk -f` mostró un disco extraíble, `sdb`, con la partición `sdb1` con la
etiqueta `USBSTICK`. Lo que se monta es la **partición**, no el disco entero.

Después necesitas un punto de montaje: un directorio normal y vacío. Tanto
crearlo como montar requieren root:

```sh
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
```

`mount` reconoce el sistema de archivos FAT por sí solo; si quieres ser
explícito, puedes añadir `-t vfat`. Ahora los archivos de la memoria aparecen
en el directorio:

```sh
ls -l /mnt/usb
df -h /mnt/usb
```

A partir de aquí, la memoria funciona como cualquier otro directorio. Copia un
archivo a tu directorio personal:

```sh
cp /mnt/usb/{{todo}} ~
```

> **¿Por qué todo pertenece a root?** FAT no tiene permisos de Linux. Cuando
> se monta una memoria FAT, *todos* los archivos reciben por tanto el mismo
> propietario y los mismos permisos: el propietario es quien la montó, es
> decir, root. Para escribir en la memoria necesitas o bien `sudo`, o bien
> montarla de forma que tú seas el propietario:
> `sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb` (1000 es tu id de
> usuario: mira `id`).

También puedes montar por etiqueta en lugar de por nombre de dispositivo:
`sudo mount LABEL=USBSTICK /mnt/usb`. En un ordenador con escritorio, el
gestor de archivos hace todo esto automáticamente cuando conectas la memoria.

```quiz
Después de `sudo mount /dev/sdb1 /mnt/usb`, todos los archivos de la memoria
FAT pertenecen a root. ¿Por qué?
- [ ] Los archivos los creó root en otro ordenador
- [x] FAT no tiene permisos de Linux, así que todos los archivos reciben como propietario a quien la montó: root
- [ ] Todo lo que hay en `/mnt` pertenece siempre a root
- [ ] Las memorias USB solo las puede usar root
---
Con `-o uid=1000,gid=1000` puedes elegir tú mismo el propietario al
montar.
```

## Desmontar… ¡antes de sacar la memoria!

Linux no siempre escribe en el disco al instante. Los cambios se acumulan en
la RAM (*caché*) y se escriben un poco más tarde, porque es mucho más rápido.
Si sacas una memoria que todavía está montada, puede que falten archivos que
«guardaste» o que estén dañados. Por eso primero se **desmonta**, con
`umount`, sin n:

```text
sudo umount /mnt/usb
```

`umount` escribe todo lo que está pendiente y luego desengancha el sistema de
archivos. Cuando vuelve a aparecer el prompt, ya puedes sacar la memoria sin
peligro. (`sync` también escribe todo lo pendiente, pero sin desmontar).

Si algo está usando el sistema de archivos, `umount` se niega:

```text
$ cd /mnt/usb
$ sudo umount /mnt/usb
umount: /mnt/usb: target is busy.
```

Aquí es tu propio shell el que está dentro del directorio. Sal con `cd ~` y
vuelve a intentarlo. Después de desmontar, `/mnt/usb` vuelve a ser un
directorio vacío, pero los archivos, y los cambios que hiciste, siguen en la
memoria la próxima vez que la montes.

```quiz
¿Por qué deberías desmontar una memoria USB antes de sacarla?
- [ ] Si no, se borran los archivos de la memoria
- [x] Puede que todavía haya cambios esperando en la RAM: `umount` los escribe antes de desenganchar el sistema de archivos
- [ ] Si no, la memoria recibe otro nombre de dispositivo la próxima vez
- [ ] La memoria no se puede volver a montar hasta que se haya desmontado en el mismo ordenador
---
Linux acumula los cambios en la RAM (*caché*) y los escribe un poco más tarde.
Una memoria que se saca mientras sigue montada puede perder archivos que «guardaste».
```

## `/etc/fstab`: lo que se monta al arrancar

El sistema de archivos raíz, `/boot` y la swap se montan automáticamente cada
vez que arranca el ordenador. Lo que se debe montar está indicado en el
archivo `/etc/fstab` (*file system table*):

```sh
cat /etc/fstab
```

Cada línea tiene seis columnas:

| Columna | Ejemplo | Significa |
|---|---|---|
| Dispositivo | `UUID=3f1c…` | Qué sistema de archivos |
| Punto de montaje | `/` | Dónde en el árbol (`none` para la swap) |
| Tipo | `ext4` | El tipo de sistema de archivos |
| Opciones | `defaults`, `errors=remount-ro` | Opciones de montaje, separadas por comas |
| dump | `0` | Antiguo indicador de copia de seguridad, casi siempre 0 |
| pass | `1` | El orden en que `fsck` los comprueba al arrancar (1 = raíz, 2 = los demás, 0 = nunca) |

La opción `errors=remount-ro` significa que el sistema de archivos raíz pasa a
ser de solo lectura si se detecta un error: mejor eso que estropear más cosas.
Los comentarios como `# / was on /dev/sda2 during installation` los escribió
el instalador.

¿Por qué `UUID=…` y no simplemente `/dev/sda2`? Los nombres de dispositivo
pueden cambiar: conecta un disco nuevo y puede que el antiguo reciba otra
letra. Un UUID se crea junto con el sistema de archivos y nunca cambia. Lo
encuentras con `lsblk -f`, `blkid` o `findmnt`:

```sh
sudo blkid
findmnt -n -o UUID /
```

Con `findmnt`, `-o` elige las columnas que se muestran y `-n` omite la
cabecera: muy práctico cuando solo quieres el valor.

```predict
$ findmnt -n -o FSTYPE /boot/efi
vfat
---
`/boot/efi` es la partición EFI, y la partición EFI tiene que ser FAT.
```

Si quieres que la memoria siempre se pueda montar en `/mnt/usb`, puedes añadir
una línea como esta:

```text
LABEL=USBSTICK  /mnt/usb  vfat  noauto,user,uid=1000,gid=1000  0  0
```

`noauto` significa que no se monta al arrancar (puede que la memoria no esté
conectada), y `user`, que los usuarios normales pueden montarla: así basta con
`mount /mnt/usb`, sin `sudo`.

> **Advertencia:** un error en `/etc/fstab` puede impedir que el ordenador
> arranque correctamente. Prueba siempre los cambios con `sudo mount -a`, que
> monta todo lo del archivo que aún no esté montado, *antes* de reiniciar.
> Para discos externos que no siempre están conectados, añade la opción
> `nofail`.

## Swap

La **swap** es espacio que se usa cuando se acaba la RAM: las partes de la
memoria que no se están usando en ese momento se trasladan allí, para que
quepan los programas. La swap es mucho más lenta que la RAM, así que un
ordenador que usa mucho la swap va lento, pero eso es mejor que los programas
se cuelguen.

```sh
swapon --show
free -h
```

Aquí la swap es una partición propia, `sda3`. Muchas instalaciones (por
ejemplo, las versiones más recientes de Ubuntu) usan en su lugar un *archivo
de swap* en el sistema de archivos raíz.

## Particionar y formatear, con el máximo cuidado

`fdisk -l` muestra las tablas de particiones de todos los discos, con dónde
empieza y termina cada partición y de qué tipo es. Requiere root:

```sh
sudo fdisk -l
```

Con `fdisk` (sin `-l`), `parted` o el gráfico `gparted` puedes cambiar la
tabla de particiones, y con `mkfs` creas un sistema de archivos nuevo, es
decir, formateas:

```text
sudo umount /mnt/usb
sudo mkfs.vfat -n USBSTICK /dev/sdb1    # FAT32: funciona en todas partes
sudo mkfs.ext4 -L BACKUP /dev/sdb1      # ext4: permisos de Linux, pero solo Linux
```

> **¡Advertencia!** `fdisk` y `mkfs` están entre los comandos más peligrosos
> que existen. Una letra mal escrita, `sda` en lugar de `sdb`, y todo el disco
> del sistema desaparece. Antes de formatear nada en un ordenador real:
> comprueba con `lsblk -f` que el tamaño, la columna `RM` y la etiqueta
> coinciden, asegúrate de que la partición no está montada y ten una copia de
> seguridad de todo lo importante.

En el simulador puedes probar `mkfs.ext4` y `mkfs.vfat` en la memoria USB,
pero haz primero las tareas, porque los archivos de la memoria desaparecen.
Las particiones del propio sistema están protegidas porque están montadas,
igual que en un sistema real.

## Resumen

| Comando | Hace |
|---|---|
| `lsblk`, `lsblk -f` | Mostrar discos, particiones y sistemas de archivos |
| `blkid` | Mostrar tipo, etiqueta y UUID |
| `df -h` | ¿Cómo de llenos están los sistemas de archivos? |
| `du -sh directorio` | ¿Cuánto espacio ocupan los archivos? |
| `findmnt`, `mount` | ¿Qué está montado y dónde? |
| `sudo mount /dev/sdb1 /mnt/usb` | Montar un sistema de archivos |
| `sudo umount /mnt/usb` | Desmontar, antes de sacar la memoria |
| `cat /etc/fstab` | ¿Qué se monta al arrancar? |
| `swapon --show` | Mostrar la swap |
| `sudo fdisk -l` | Mostrar las tablas de particiones |
