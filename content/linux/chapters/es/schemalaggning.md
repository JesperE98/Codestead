# Tareas programadas con cron

Una copia de seguridad cada noche, limpiar logs viejos cada semana, descargar
datos cada cinco minutos: el ordenador puede ejecutar comandos por su cuenta a
horas fijas. La herramienta clásica para eso es **cron**, y systemd tiene sus
propios **timers**.

## cron y crontab

El servicio cron se despierta cada minuto y ejecuta las tareas a las que les ha
llegado la hora. Cada usuario tiene su propia lista de tareas, una
**crontab**:

```sh
crontab -l
```

*no crontab for {{user}}* significa que todavía no tienes tareas.

## Los cinco campos de tiempo

Cada línea de una crontab tiene cinco campos de tiempo y después el comando:

```text
┌───────────── minuto (0–59)
│ ┌─────────── hora (0–23)
│ │ ┌───────── día del mes (1–31)
│ │ │ ┌─────── mes (1–12)
│ │ │ │ ┌───── día de la semana (0–7, el domingo es 0 o 7)
│ │ │ │ │
* * * * *  comando
```

| Escribes | Significa |
|---|---|
| `*` | Cada |
| `5` | Exactamente 5 |
| `1-5` | Del 1 al 5 |
| `1,15` | 1 y 15 |
| `*/10` | Cada diez: 0, 10, 20 … |

| Línea | Se ejecuta |
|---|---|
| `* * * * * command` | Cada minuto |
| `*/5 * * * * command` | Cada cinco minutos |
| `30 2 * * * command` | A las 02:30 cada noche |
| `0 7 * * 1-5 command` | A las 07:00 de lunes a viernes |
| `0 0 1 * * command` | A medianoche el día uno de cada mes |
| `@reboot command` | Una vez, cuando arranca el ordenador |

`@hourly`, `@daily`, `@weekly` y `@monthly` también son atajos.

```quiz
¿Cuándo se ejecuta la tarea `15 8 * * 6 ~/backup.sh`?
- [ ] A las 15:08 todos los días
- [x] A las 08:15 todos los sábados
- [ ] El día 15 de cada mes a las 08:00
---
El orden es minuto, hora, día del mes, mes y día de la semana: minuto 15,
hora 8, cualquier fecha, cualquier mes, día 6: sábado.
```

```quiz
¿Con qué frecuencia se ejecuta `0 */2 * * * command`?
- [ ] Cada dos minutos
- [x] Cada dos horas, a la hora en punto
- [ ] Dos veces al día
---
Minuto 0 y una hora sí y otra no: 00:00, 02:00, 04:00 …
```

## Instalar tareas

`crontab -e` abre tu crontab en un editor de texto y la instala cuando
guardas. El simulador todavía no tiene editor, así que aquí le das las tareas a
`crontab` por su entrada; `-` significa «leer de la entrada»:

```sh
echo '* * * * * date >> ~/cron.log' | crontab -
crontab -l
```

Cuidado: `crontab -` y `crontab FILE` **sustituyen** toda la crontab. Para
añadir una tarea, combina las tareas antiguas con la nueva:

```sh
(crontab -l; echo '30 2 * * * ~/backup.sh') | crontab -
```

Para quitar una línea, fíltrala con `grep -v` e instala el resto, o elimínalo
todo con `crontab -r`:

```sh
crontab -l | grep -v backup.sh | crontab -
```

`crontab` comprueba las líneas antes de instalar nada:

```predict
$ echo '0 25 * * * date' | crontab -
"-":1: bad hour
errors in crontab file, can't install.
---
No existe la hora 25: las horas van de 0 a 23. No se ha instalado nada.
```

## Verla en marcha

Cuando hayas instalado la tarea que se ejecuta cada minuto, espera un minuto y
mira:

```sh
cat ~/cron.log
journalctl -u cron
```

Cada ejecución se escribe en el journal, por ejemplo
`CRON[4211]: ({{user}}) CMD (date >> ~/cron.log)`. En el simulador, cron solo
funciona mientras la aplicación está abierta; igual que un ordenador real, no
recupera las tareas que se perdió mientras estaba apagado.

## La trampa de cron: otro entorno

Las tareas no se ejecutan en tu terminal, y eso sorprende a casi todo el mundo:

- Se ejecutan con `/bin/sh`, sin tus alias ni tu `~/.bashrc`.
- `PATH` es corto (`/usr/bin:/bin`), así que los programas que están en otros
  sitios necesitan su ruta completa.
- Empiezan en tu directorio personal.
- La salida que no se envía a un archivo se pierde. Termina siempre la línea
  con, por ejemplo, `>> ~/job.log 2>&1`.

Ejecuta primero el comando a mano. Cuando funcione ahí, ponlo en la crontab.

```quiz
La tarea `* * * * * echo hi` se ejecuta cada minuto, pero nunca ves `hi` en
ninguna parte. ¿Por qué?
- [ ] cron no permite `echo`
- [x] La salida no tiene adónde ir: envíala a un archivo con `>>`
- [ ] Las tareas solo se ejecutan como root
---
La salida de las tareas de cron no se muestra en ninguna terminal. El cron
real intenta enviarla por correo, y la mayoría de los ordenadores no tienen
correo, así que se pierde.
```

## Las tareas propias del sistema

Además de las crontabs de los usuarios existe `/etc/crontab`, y directorios
como `/etc/cron.daily` y `/etc/cron.weekly`. Los scripts que contienen se
ejecutan una vez al día o una vez a la semana:

```sh
cat /etc/crontab
ls /etc/cron.daily
```

Las líneas de `/etc/crontab` tienen un campo más antes del comando: el usuario
con el que se ejecuta la tarea.

## Timers de systemd

En las distribuciones modernas, gran parte de esto lo hacen los **timers** de
systemd: una unidad `.timer` que inicia una unidad `.service` a horas fijas.
Escriben en el journal y pueden recuperar las ejecuciones perdidas, pero cada
tarea necesita dos archivos de unidad. Para tus propias tareas pequeñas, cron
es lo más rápido. Lista los timers del ordenador, con la próxima y la última
ejecución:

```try
systemctl list-timers
```

## En otras distribuciones

| | Ubuntu y Debian | Fedora | Arch |
|---|---|---|---|
| Paquete | `cron` | `cronie` | `cronie` |
| Servicio | `cron` | `crond` | `cronie` |
| Instalado de serie | Sí | Sí | No |

En Arch empiezas con `sudo pacman -S cronie` y
`sudo systemctl enable --now cronie`.
