# Servicios y logs con systemd

Un ordenador con Linux está haciendo cosas constantemente que nadie inicia a
mano: acepta conexiones SSH, mantiene el reloj en hora, ejecuta tareas
programadas y escribe logs. Los programas que hacen esto se llaman
**servicios**, y en casi todas las distribuciones modernas es **systemd** quien
los mantiene en orden. En este capítulo aprenderás a iniciar y detener
servicios, a hacer que arranquen al encender el ordenador y, lo más importante
de todo, a leer los logs cuando algo sale mal.

## init y systemd

Cuando el kernel de Linux ha arrancado, ejecuta un único programa: **init**,
el proceso número 1. Después, init inicia todo lo demás. Hoy en día init es
casi siempre **systemd**, tanto en Debian como en Ubuntu, Arch y Fedora.
Échale un vistazo:

```sh
ps -p 1
```

El proceso se llama `/sbin/init`, pero no es más que un enlace al programa
`systemd`.

systemd hace más que iniciar servicios. Lleva la cuenta de si siguen vivos,
los reinicia si se cuelgan (si así lo quieres), recoge todo lo que escriben en
un log común, el **journal**, y tiene herramientas para la mayoría de partes
del sistema:

| Herramienta | Hace |
|---|---|
| `systemctl` | Controla los servicios: estado, iniciar, detener, arranque |
| `journalctl` | Lee el journal (el log) |
| `hostnamectl` | Muestra y cambia el nombre del ordenador |
| `systemd-analyze` | Muestra cuánto tardó el arranque |

## Unidades y servicios

Todo aquello de lo que systemd lleva la cuenta se llama **unidad** (*unit*).
Hay varios tipos, y el tipo se ve en la terminación: `.service` (un servicio),
`.timer` (una tarea programada), `.socket`, `.mount`, `.target` (un grupo de
unidades, algo así como un «nivel» del arranque) y más. Este capítulo trata de
los servicios.

Cada unidad se describe en un **archivo de unidad** (*unit file*), un pequeño
archivo de texto. Están en dos sitios:

| Directorio | Contenido |
|---|---|
| `/usr/lib/systemd/system/` | Archivos de unidad que vienen con los paquetes. ¡No los edites aquí! |
| `/etc/systemd/system/` | Los archivos de unidad propios del administrador. Tienen prioridad. |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

Las versiones antiguas de Debian y Ubuntu suelen poner `/lib/systemd/system`
en su lugar. Es el mismo directorio: `/lib` es un enlace a `/usr/lib`.

El nombre de un servicio es el nombre del archivo, por ejemplo
`myserver.service`. Al escribir comandos puedes omitir `.service`:
`systemctl status myserver` funciona igual de bien.

## ¿Cómo está el servicio? – `systemctl status`

El comando que más vas a usar es `systemctl status`:

```sh
systemctl status ssh
```

En Ubuntu, el servidor SSH se llama `ssh`. La salida es más o menos así:

```text
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled; preset: enabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 UTC; 2h 13min ago
       Docs: man:sshd(8)
             man:sshd_config(5)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/ssh.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 ubuntu systemd[1]: Starting ssh.service - OpenBSD Secure Shell server...
Oct 30 07:54:07 ubuntu sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 ubuntu systemd[1]: Started ssh.service - OpenBSD Secure Shell server.
```

Línea a línea:

| Línea | Significa |
|---|---|
| `●` | Punto verde = en marcha. `×` rojo = ha fallado. `○` blanco = detenido. |
| `Loaded` | Dónde está el archivo de unidad, si el servicio arranca al encender (`enabled`/`disabled`/`static`) y el valor por defecto de la distribución (`preset`) |
| `Active` | La línea más importante: `active (running)`, `inactive (dead)` o `failed`, y desde cuándo |
| `Docs` | Dónde leer más (`man sshd`) |
| `Main PID` | El proceso principal del servicio: el mismo PID que en `ps aux` |
| `Memory`, `CGroup` | Cuánta memoria usa y qué procesos le pertenecen |
| Últimas líneas | Las líneas más recientes del log del servicio en el journal |

`static` significa que el servicio no se puede habilitar por sí solo: se
inicia cuando otra unidad lo necesita.

> **Consejo:** En una terminal real, la salida larga se muestra en un
> paginador (`less`). Pulsa `q` para volver. Añade `--no-pager` si prefieres
> saltártelo.

## Iniciar, detener y reiniciar

```text
sudo systemctl start myserver      # iniciar ahora
sudo systemctl stop myserver       # detener ahora
sudo systemctl restart myserver    # detener e iniciar de nuevo
sudo systemctl reload myserver     # pedirle que vuelva a leer su configuración
```

Todo lo que **cambia** algo requiere root, así que no olvides `sudo`. Sin él,
systemctl responde:

```text
Failed to start myserver.service: Interactive authentication required.
```

`reload` solo funciona con los servicios que lo admiten. La ventaja es que el
servicio sigue en marcha mientras tanto: no se corta ninguna conexión. Cuando
has cambiado el archivo de configuración de un servicio, `reload` o `restart`
es el último paso.

> **¡Pruébalo!** En el capítulo de procesos detuviste el servidor de prácticas
> con `pkill`. Mira `systemctl status myserver`: systemd se dio cuenta de que
> el proceso desapareció. Vuelve a iniciarlo con `systemctl` y compara el PID
> con `pgrep -l myserver`.

## ¿Ahora o al arrancar? `start` y `enable`

Este es el malentendido más común sobre systemd: **`start` y `enable` son dos
cosas distintas.**

| Comando | Hace |
|---|---|
| `systemctl start X` | Inicia el servicio **ahora**. Después de reiniciar, ya no está. |
| `systemctl enable X` | Inicia el servicio automáticamente **al arrancar**, pero no ahora. |
| `systemctl enable --now X` | Las dos cosas a la vez. |
| `systemctl disable X` | No iniciarlo al arrancar (`--now` también lo detiene). |

`enable` crea un enlace en un directorio que lleva el nombre del target de la
sección `[Install]` del archivo de unidad, normalmente
`multi-user.target.wants`:

```text
$ sudo systemctl enable --now myserver
Created symlink /etc/systemd/system/multi-user.target.wants/myserver.service → /etc/systemd/system/myserver.service.
```

Cuando el ordenador arranca, systemd recorre ese directorio e inicia todo lo
que hay en él. Puedes preguntar por el estado:

```sh
systemctl is-active myserver
systemctl is-enabled myserver
```

`is-active` e `is-enabled` son geniales en scripts: escriben una sola palabra
y terminan con estado 0 si la respuesta es «sí». Con `-q` no dicen nada en
absoluto:

```text
if systemctl is-active -q myserver; then echo "el servidor está en marcha"; fi
```

En un ordenador recién arrancado del simulador, `myserver` está en marcha,
pero nadie lo ha habilitado. ¿Qué imprimen estos dos comandos?

```predict
$ systemctl is-active myserver
$ systemctl is-enabled myserver
active
disabled
---
myserver está en marcha **ahora**, pero nadie ha ejecutado `enable`: después
de reiniciar no se iniciaría. `start` y `enable` son de verdad dos cosas
distintas.
```

## Listar servicios

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` muestra los servicios que están en marcha (o que han fallado).
  Con `--all` se incluyen también los detenidos.
- `--failed` muestra solo los que han fallado. ¡Un buen primer comando cuando
  algo parece ir mal!
- `list-unit-files` muestra todos los archivos de unidad instalados y si están
  `enabled`, `disabled` o `static`.

## El journal – `journalctl`

Todo lo que escriben los servicios, el kernel y el propio systemd acaba en el
journal. Sin opciones obtienes el journal entero, empezando por lo más
antiguo:

```sh
journalctl
```

Eso enseguida es muchísimo, así que casi siempre se filtra:

| Comando | Muestra |
|---|---|
| `journalctl -u ssh` | Solo un servicio (`-u` de *unit*) |
| `journalctl -n 20` | Las 20 líneas más recientes |
| `journalctl -f` | Las últimas líneas, y luego las nuevas a medida que llegan (sal con Ctrl+C) |
| `journalctl -b` | Solo este arranque (`-b -1` = el anterior) |
| `journalctl --since today` | Desde medianoche. También `yesterday`, `"10:00"`, `"1 hour ago"` |
| `journalctl -p err` | Solo errores y cosas peores |
| `journalctl -xe` | Saltar al final y añadir explicaciones |
| `journalctl -k` | Solo mensajes del kernel (como `dmesg`) |

Las opciones se pueden combinar. Un par de clásicos:

```sh
journalctl -u myserver -n 5
journalctl -p err -b
journalctl --since today -u myserver
```

### Prioridades

Cada línea del journal tiene una **prioridad**. `-p` muestra la que elijas
*y todas las más graves*:

| Número | Nombre | Significa |
|---|---|---|
| 0 | `emerg` | El sistema no se puede usar |
| 1 | `alert` | Hay que arreglarlo inmediatamente |
| 2 | `crit` | Error crítico |
| 3 | `err` | Error: se muestra en rojo |
| 4 | `warning` | Advertencia: se muestra en amarillo |
| 5 | `notice` | Normal, pero digno de mención |
| 6 | `info` | Información |
| 7 | `debug` | Información de depuración |

No te preocupes si `journalctl -p err` muestra un par de errores del kernel
como `ACPI BIOS Error`. Aparecen en casi todos los ordenadores y suelen ser
inofensivos: fallos en el firmware del ordenador que el kernel sortea.

Normalmente tienes que ser root, o miembro de un grupo con permiso para leer
el journal (`adm` o `systemd-journal` en Ubuntu; otras familias usan otros
grupos), para verlo todo. Tu usuario en el simulador puede leer el journal
entero.

```quiz
¿Qué prioridades muestra `journalctl -p warning`?
- [x] `err`
- [x] `warning`
- [x] `crit`
- [ ] `notice`
- [ ] `info`
---
`-p` muestra la prioridad que elijas *y todas las más graves*, es decir,
todo lo que tiene el mismo número o uno menor (`warning` es 4).
```

## Diagnosticar un servicio que no arranca

Alguien ha configurado el servicio **reportd** en este ordenador, pero algo
va mal. Esta es la forma habitual de abordarlo:

1. **¿Qué ha fallado?** Lista los servicios que han fallado:

   ```sh
   systemctl --failed
   ```

2. **Mira el estado.** A menudo bastan las últimas líneas:

   ```sh
   systemctl status reportd
   ```

3. **Lee el log entero** del servicio. Casi siempre te dice qué falla; léelo
   con atención, palabra por palabra:

   ```sh
   journalctl -xeu reportd
   ```

   El propio `systemctl` sugiere justo ese comando cuando falla un inicio:
   `See "systemctl status reportd.service" and "journalctl -xeu
   reportd.service" for details.`

4. **Arregla el problema**, por ejemplo un archivo de configuración que falta
   o que tiene una errata.

5. **Reinicia y comprueba:**

   ```text
   sudo systemctl restart reportd
   systemctl status reportd
   ```

La línea `Main process exited, code=exited, status=1/FAILURE` significa que el
programa terminó por sí mismo con un error. Si pone `status=203/EXEC`, systemd
no encontró el programa en absoluto: revisa la ruta de `ExecStart=`.

```quiz
Un servicio no arranca, y el journal dice `status=203/EXEC`. ¿Dónde miras
primero?
- [ ] En `/etc/fstab`
- [x] En la ruta de `ExecStart=` del archivo de unidad
- [ ] En la prioridad, con `journalctl -p err`
- [ ] En ningún sitio: significa que el programa terminó por sí mismo con un error
---
203/EXEC significa que systemd no encontró el programa en absoluto. Un programa
que arranca y luego termina con un error da `status=1/FAILURE`.
```

## El archivo de unidad – `systemctl cat`

Para ver exactamente cómo se inicia un servicio, lee su archivo de unidad:

```sh
systemctl cat myserver
```

```text
# /etc/systemd/system/myserver.service
[Unit]
Description=Myserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/myserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| Sección | Contenido |
|---|---|
| `[Unit]` | Descripción y orden: `After=network.target` = iniciar después de la red |
| `[Service]` | Cómo se ejecuta el programa: `ExecStart=` (el comando), `User=`, `Restart=on-failure` … |
| `[Install]` | Lo que debe hacer `enable`: `WantedBy=multi-user.target` |

Si cambias un archivo de unidad, systemd tiene que volver a cargarlo antes de
que el cambio tenga efecto; si no, recibes una advertencia en
`systemctl status`:

```text
sudo systemctl daemon-reload
```

No edites nunca los archivos de `/usr/lib/systemd/system`: se sobrescriben la
próxima vez que se actualiza el paquete. Pon tu propia versión en
`/etc/systemd/system`.

```quiz
Quieres cambiar cómo se inicia un servicio que vino con un paquete. ¿Cuál es
la forma correcta?
- [ ] Editar su archivo en `/usr/lib/systemd/system` y reiniciar el servicio
- [x] Poner tu propia versión en `/etc/systemd/system`, ejecutar `sudo systemctl daemon-reload` y reiniciar el servicio
- [ ] Poner tu propia versión en `/etc/systemd/system`: systemd nota el cambio por sí solo
- [ ] Editar el archivo en `/usr/lib/systemd/system` y ejecutar `sudo systemctl enable` sobre él
---
Los archivos de `/etc/systemd/system` tienen prioridad y no se sobrescriben
cuando se actualiza el paquete. `daemon-reload` hace que systemd vuelva a
cargar el archivo de unidad modificado.
```

## ¿Cómo se llaman los servicios?

systemd funciona igual en todas partes, pero **los servicios no siempre se
llaman igual**: depende de cómo se llamen los paquetes y de qué programas haya
elegido la distribución. En Ubuntu:

| Servicio | Nombre en Ubuntu |
|---|---|
| Servidor SSH | `ssh` (alias `sshd`) |
| Tareas programadas (cron) | `cron` |
| Red | `NetworkManager` |
| Cortafuegos | `ufw` (si está instalado) |
| Reloj | `systemd-timesyncd` |

En realidad, el servicio SSH se llama `ssh.service`. Tiene el alias
`sshd.service`, así que `systemctl status sshd` también funciona, pero la
salida muestra el nombre real. Otras familias pueden llamar de otra forma a
los mismos servicios (en Arch y Fedora el servicio SSH se llama `sshd`): de
esas diferencias trata la parte sobre distribuciones y paquetes.

¿No sabes cómo se llama algo? Busca en la lista:

```sh
systemctl list-unit-files | grep ssh
```

```try
systemctl list-unit-files | grep ssh
---
`ssh.service` es el archivo de unidad real, y `sshd.service` aparece como
`alias` suyo.
```

## Reiniciar el ordenador

`enable` solo muestra su efecto cuando el ordenador se reinicia. Puedes
probarlo en el simulador, que se reinicia en un instante:

```text
sudo systemctl reboot
```

Después de reiniciar, solo están en marcha los servicios habilitados. Con
`journalctl -b -1` ves el log del arranque anterior (y cómo se apagó todo), y
`journalctl --list-boots` muestra todos los arranques del journal.

## Más cosas de systemd

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

`hostnamectl` muestra el nombre del ordenador, el sistema operativo y el
kernel (y le cambia el nombre con `sudo hostnamectl set-hostname NUEVONOMBRE`).
`systemd-analyze` muestra cuánto tardó el arranque, y `blame`, qué servicios
tardaron más: perfecto cuando el ordenador arranca despacio.
