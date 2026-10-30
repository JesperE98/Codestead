# Bienvenido a la shell de Linux

Esta guía te enseña a usar Linux desde la línea de comandos: desde tus
primeros comandos hasta la gestión de paquetes en distintas distribuciones.
Cada capítulo explica un tema y termina con una serie de **tareas** que
resuelves en la terminal de la derecha. Una tarea se marca automáticamente
como completada en cuanto la resuelves bien. La mejor forma de aprender es
*haciendo*: lee, prueba, equivócate y vuelve a intentarlo.

## ¿Qué es Linux?

En sentido estricto, **Linux** es solo el *kernel* (núcleo): el programa que se
comunica con el hardware y permite que los demás programas compartan el
procesador, la memoria y los discos. Linus Torvalds creó el kernel en 1991, y
es software libre.

Para tener un sistema utilizable hace falta mucho más: una shell, herramientas
para gestionar archivos, un gestor de paquetes y quizá un entorno de
escritorio. Una **distribución** (*distro*) lo reúne todo en un conjunto listo
para usar. Ahora mismo estás usando **{{distro}}**.

Las distribuciones se agrupan en *familias* que se basan unas en otras y
comparten gestor de paquetes:

| Familia | Gestor de paquetes | Ejemplos |
|---|---|---|
| Debian | `apt` | Debian, Ubuntu, Linux Mint, Pop!_OS |
| Arch | `pacman` | Arch Linux, Manjaro, EndeavourOS |
| Red Hat | `dnf` | Fedora, RHEL, Rocky Linux, AlmaLinux |

Casi todo lo que aprendas en esta guía funciona igual en todas partes. Lo que
cambia –sobre todo la gestión de paquetes– tiene sus propios capítulos. Puedes
cambiar de distribución cuando quieras desde el menú de la parte superior.

## ¿Qué es una shell?

Una **shell** es el programa que lee los comandos que escribes y los ejecuta.
La shell más común es **bash**, la predeterminada en casi todas las
distribuciones. Otras shells populares son **zsh** (la predeterminada en macOS)
y **fish**. Lo básico es igual en todas ellas.

Fíjate en la diferencia entre una *terminal* y una *shell*: la terminal es la
ventana que muestra el texto, y la shell es el programa que se ejecuta dentro
de ella.

## El prompt

Cuando la shell está esperando un comando, muestra un **prompt** (indicador).
En {{distro}} tiene más o menos este aspecto:

:::debian
```text
elev@{{hostname}}:~$
```
:::

:::arch
```text
[elev@{{hostname}} ~]$
```
:::

:::redhat
```text
[elev@{{hostname}} ~]$
```
:::

Te indica quién eres (`elev`), en qué ordenador estás (`{{hostname}}`) y en qué
lugar del sistema de archivos te encuentras (`~` significa tu directorio
personal). El signo `$` indica que eres un usuario normal. Si eres el
administrador (*root*), verás un `#` en su lugar.

## Tu primer comando

Haz clic en la terminal, escribe el comando de abajo y pulsa **Enter**:

```sh
echo Hej världen
```

`echo` simplemente imprime lo que le pases; aquí, *Hej världen*, que en sueco
significa «Hola mundo». La mayoría de los comandos siguen el mismo patrón:

```text
comando  -opciones  argumentos
ls       -l         /etc
```

El *comando* es el programa que se ejecuta, las *opciones* (o *flags*)
modifican su comportamiento y los *argumentos* son aquello sobre lo que debe
trabajar el comando.

## Cómo funciona el simulador

La terminal de esta página es un **simulador** que se ejecuta por completo en
tu navegador. Se comporta como un ordenador Linux real, pero nada de lo que
hagas puede dañar tu propio equipo, y si haces alguna tontería siempre puedes
empezar de nuevo con el botón *Restablecer*.

- **Haz clic en un ejemplo de código** para poner el comando en la terminal.
- **Tab** completa comandos y nombres de archivo.
- **Flechas arriba/abajo** recorren los comandos anteriores.
- **Ctrl+L** limpia la pantalla y **Ctrl+C** cancela la línea que estás
  escribiendo.
- `help` muestra todos los comandos, y `man comando` muestra una página del
  manual.

### Algunas palabras en sueco

Esta guía se escribió originalmente en sueco, por eso el usuario y los
archivos de práctica del simulador tienen nombres suecos. No necesitas saber
sueco –los comandos son exactamente los mismos–, pero este pequeño glosario
puede ayudarte:

| Nombre | Significado |
|---|---|
| `elev` | alumno (tu nombre de usuario) |
| `dokument` | documentos |
| `anteckningar.txt` | notas |
| `frukter.txt` | frutas |
| `betyg.csv` | calificaciones |
| `bilder` | imágenes |
| `gammalt` | cosas viejas |
