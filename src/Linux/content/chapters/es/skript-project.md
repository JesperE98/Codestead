# Proyecto: El robot de los informes

¿Te acuerdas del día en que el servidor dio problemas? A tu jefa le encantó tu
informe – un poco demasiado. «Genial. Quiero uno así en mi mesa todas las mañanas.
Todos los días laborables. Antes de las siete». No tienes ninguna intención de
levantarte a las seis para teclear comandos `grep`. Por suerte no hace falta: ya
sabes escribir scripts. Es hora de construir un robot que haga el trabajo por ti.

El robot lee el log `~/{{documents}}/server.log` y escribe un informe breve:
cuántas líneas hay de cada nivel y qué errores ocurrieron. Todo lo que necesita está
en *Scripts y automatización*; el reto es montarlo tú solo.

## La misión

1. **Construye el robot.** Crea el script `~/{{robotScript}}` con una línea shebang y
   una línea que imprima un título. Hazlo ejecutable y ejecútalo.
2. **Enséñale a pedir el log.** El robot recibe el archivo de log como primer
   argumento. Si se ejecuta sin argumentos, debe explicar cómo se usa y terminar con
   un código de salida distinto de 0.
3. **… y a quejarse de los archivos que faltan.** Si el archivo del argumento no
   existe, el robot lo dice y termina con un código de salida distinto de 0. Pruébalo
   con un nombre de archivo que no exista.
4. **Cuenta los niveles.** Ejecutado sobre `~/{{documents}}/server.log`, el robot
   imprime cuántas líneas tiene el log de cada nivel, contadas con `awk`. Cuidado:
   ¡`WARN` y `warn` son el mismo nivel!
5. **Lista los errores.** Debajo de los números, el informe lista cada error con su
   hora y su mensaje, pero **sin** la fecha, que de todos modos es la misma en todas
   las líneas. Quítala con `sed`.
6. **Contrata al robot.** Prográmalo con cron: se ejecuta sobre el log del servidor
   a las 06:30 de lunes a viernes, y su salida se añade a `~/{{robotLog}}`. Conserva
   tus tareas antiguas.
7. **Ensayo general.** Ejecuta a mano una vez el comando de la tarea, para que el
   informe de hoy acabe en `~/{{robotLog}}`, y echa un vistazo al archivo.

Los hitos de la lista que hay junto a este texto se comprueban automáticamente
mientras ejecutas tus comandos.

## Consejos por el camino

- Construye el robot pieza a pieza y ejecútalo después de cada cambio. Lo más
  sencillo es volver a escribir todo el script con el here document: sustituye la
  versión anterior.
- Prueba primero cada línea en la terminal, con la ruta del log en lugar de `"$1"`.
  Cuando funcione ahí, pásala al script.
- `echo $?` justo después del robot muestra con qué código de salida terminó.
- `toupper()` de `awk` convierte `warn` en `WARN`, y `sort | uniq -c` cuenta las
  líneas iguales.
- Cada línea del log empieza con la fecha y un espacio: el comando `s` de `sed`
  puede sustituir ese trozo por nada.
- Las tareas de cron no se ejecutan en tu terminal: usa rutas completas como
  `~/{{robotScript}}` y envía la salida a un archivo. Con `>>` el informe de cada
  mañana se añade al final en lugar de sobrescribir el de ayer.

## ¿Quieres hacer más?

Cuando termines los hitos, el robot puede aprender trucos nuevos. Pon la fecha en
el título con `$(date)`. Convierte cada parte del informe en una función propia.
Deja que el robot acepte varios logs a la vez con `for file in "$@"`, o cuenta
cuántas peticiones recibieron la respuesta `404`. Y si la aplicación sigue abierta
a las 06:30 de un día laborable, `journalctl -u cron` muestra que el robot de verdad
fue a trabajar.
