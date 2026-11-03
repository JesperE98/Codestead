# Procesos y trabajos

Todo programa que se ejecuta es un **proceso**. Ahora mismo, el ordenador
simulado está ejecutando una docena más o menos: los servicios del sistema, tu
shell… y algo más que pronto vas a ver. En este capítulo aprenderás a ver qué
se está ejecutando, a detener programas que se portan mal y a ejecutar cosas
en segundo plano.

## ¿Qué es un proceso?

Un proceso es un programa en ejecución junto con todo lo que necesita:
memoria, archivos abiertos y el usuario con el que se ejecuta. Cada proceso
tiene un **PID** (*process ID*), un número que lo identifica, y un padre, el
**PPID**, que lo inició. Todo empieza con el proceso número 1, `init` (en casi
todas las distribuciones es `systemd`), que arranca todos los demás.

```quiz
¿Qué es el PPID de un proceso?
- [ ] El número del procesador en el que se ejecuta
- [x] El PID del proceso que lo inició: su padre
- [ ] Su prioridad
---
Todo proceso tiene un padre. Si sigues a los padres lo suficiente, acabas en
el proceso número 1.
```

## Mis procesos – `ps`

`ps` (*process status*) sin opciones muestra los procesos de tu propia
terminal:

```sh
ps
```

Verás tu shell, `bash`, y el propio `ps`, que solo vive mientras se está
ejecutando.

## Todos los procesos – `ps aux`

Para ver todo lo que se está ejecutando en el ordenador, lo habitual es usar
`ps aux`:

```sh
ps aux
```

| Columna | Significa |
|---|---|
| `USER` | El usuario con el que se ejecuta el proceso |
| `PID` | El número de identificación del proceso |
| `%CPU` / `%MEM` | Cuánto procesador y memoria usa |
| `STAT` | Estado: `R` en ejecución, `S` durmiendo, `s` líder de sesión |
| `COMMAND` | El comando que inició el proceso |

La lista es larga, así que a menudo se combina con `grep` o `sort`:

```sh
ps aux | grep sshd
ps aux --sort=-%cpu | head -5
```

La variante `ps -ef` muestra los mismos procesos, pero con el PID del padre en
una columna propia. Si solo quieres el PID de un proceso cuyo nombre conoces,
tienes `pgrep`:

```sh
pgrep -l sshd
```

```try
pgrep -l sshd
---
`-l` muestra el nombre junto al PID.
```

## Una vista en directo – `top` y `htop`

`top` muestra los procesos ordenados según el tiempo de procesador que usan y
se actualiza cada segundo: perfecto para encontrar lo que está ralentizando el
ordenador. Arriba del todo verás la carga (*load average*), el número de
procesos y la memoria.

```sh
top
```

En una terminal real, sales de `top` con `q`. Mucha gente prefiere `htop`, que
tiene colores y se puede manejar con el ratón, pero normalmente hay que
instalarlo primero.

## Detener procesos – `kill`

El nombre suena dramático, pero en realidad `kill` envía una **señal** a un
proceso. La señal por defecto, `SIGTERM` (15), le pide al proceso que se cierre
de forma ordenada. Si no hace caso, puedes enviar `SIGKILL` (9), que lo obliga
a detenerse inmediatamente, aunque entonces no tiene ocasión de guardar nada
ni de limpiar.

```text
kill 1234        # pide al proceso 1234 que termine (SIGTERM)
kill -9 1234     # lo fuerza (SIGKILL): el último recurso
```

Si conoces el nombre pero no el PID, puedes usar `pkill` (busca por patrón) o
`killall` (nombre exacto):

```text
pkill firefox
killall firefox
```

Solo puedes enviar señales a tus **propios** procesos. Para los procesos que
pertenecen a root o a otros usuarios, necesitas `sudo`.

```quiz
Un programa ha dejado de responder. ¿Qué comando deberías probar **primero**?
- [x] `kill 1234`: envía `SIGTERM` y deja que el programa se cierre de forma ordenada
- [ ] `kill -9 1234`: siempre funciona mejor
- [ ] `sudo kill -9 1`
---
Empieza con la señal por defecto, `SIGTERM`. `SIGKILL` (`-9`) es el último
recurso, ya que el programa no tiene ocasión de guardar ni de limpiar.
```

> **¡Encuéntralo y detenlo!** Hay un proceso en este ordenador que está usando
> casi el 100 % del procesador. Usa `top` o `ps aux --sort=-%cpu` para
> averiguar cómo se llama y cuál es su PID, y después detenlo.

## Primer plano y segundo plano

Cuando ejecutas un comando, la shell espera a que termine: se ejecuta en
**primer plano**. Si pones `&` al final, se ejecuta en **segundo plano**, y
recuperas el prompt inmediatamente:

```sh
sleep 300 &
```

La shell responde con el número de trabajo entre corchetes y el PID del
proceso, por ejemplo `[1] 4200`. Los programas iniciados desde la terminal se
llaman **trabajos** (*jobs*):

```sh
jobs
```

| Comando | Hace |
|---|---|
| `jobs` | Muestra los trabajos de esta terminal |
| `fg %1` | Trae el trabajo 1 al primer plano |
| `bg %1` | Deja que un trabajo detenido continúe en segundo plano |
| `kill %1` | Termina el trabajo 1 |
| `Ctrl+C` | Interrumpe el programa en primer plano |
| `Ctrl+Z` | Pausa el programa en primer plano (se reanuda con `fg` o `bg`) |

La variable `$!` contiene el PID del último trabajo en segundo plano. Cuando
un trabajo termina, la shell te avisa con una línea como
`[1]+  Done   sleep 300`.

```quiz
Has pulsado `Ctrl+Z` en un programa en primer plano. ¿Cómo dejas que siga
ejecutándose mientras conservas el prompt?
- [ ] `fg %1`
- [x] `bg %1`
- [ ] `Ctrl+C`
---
`Ctrl+Z` pausa el programa. `bg` deja que un trabajo detenido continúe en
segundo plano, mientras que `fg` lo traería de vuelta al primer plano.
```

### Seguir después de cerrar la sesión – `nohup`

Cuando cierras la terminal o la conexión ssh, los programas que iniciaste
reciben la señal **SIGHUP** (*hang up*) y terminan, también los trabajos en
segundo plano. `nohup` hace que un comando ignore esa señal:

```sh
nohup ./long-job.sh &
```

La salida que se habría mostrado en la terminal acaba en el archivo
`nohup.out`:

```predict
$ nohup echo done
$ cat nohup.out
nohup: ignoring input and appending output to 'nohup.out'
done
```

Para los programas que tienen que estar siempre en marcha es mejor un
**servicio**; los conocerás en la parte sobre administración del sistema.

### Vigilar un comando – `watch`

`watch` vuelve a ejecutar un comando cada dos segundos y muestra el resultado
en una pantalla limpia: muy útil para ver cómo crece un archivo o cómo se
llena un disco. Sal con `Ctrl+C`. En el simulador el resultado se muestra una
sola vez.

```sh
watch -n 5 'ls -l /tmp'
```

## ¿Cómo está el ordenador?

Dos pequeños comandos te dan una visión general rápida:

```sh
uptime
free -h
```

`uptime` muestra cuánto tiempo lleva encendido el ordenador y la carga de los
últimos 1, 5 y 15 minutos. `free -h` muestra cuánta memoria está en uso.
Fíjate en la columna *available* (disponible): Linux usa la memoria sobrante
como caché de archivos, así que *free* (libre) suele parecer baja aunque haya
memoria de sobra.

```quiz
`free -h` muestra poca memoria *free* pero mucha memoria *available*. ¿Qué
significa eso?
- [ ] El ordenador está a punto de quedarse sin memoria
- [x] Linux usa la memoria sobrante como caché de archivos: fíjate en *available*
- [ ] Parte de la memoria está estropeada
```

## Igual en todas partes

Los procesos funcionan igual en todas las distribuciones. En Ubuntu, las
herramientas vienen del paquete **procps**, y `killall` de **psmisc**. Algunas
distribuciones dan a los paquetes nombres un poco distintos, y también cambia
qué servicios se ejecutan desde el arranque: podrás comparar distribuciones en
la parte sobre distribuciones.
