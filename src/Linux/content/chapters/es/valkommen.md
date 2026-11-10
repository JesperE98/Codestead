# Bienvenido a la shell de Linux

Esta guía te enseña a usar Linux desde la línea de comandos: desde tus
primeros comandos hasta la gestión de paquetes en distintas distribuciones.
Cada capítulo explica un tema. Por el camino hay breves **preguntas** en el
texto; algunas las pruebas en la terminal de la derecha. Respóndelas todas y se
desbloquearán las **tareas** del capítulo. Una tarea se marca automáticamente como completada en
cuanto la resuelves bien. La mejor forma de aprender es *haciendo*: lee,
prueba, equivócate y vuelve a intentarlo.

## ¿Qué es Linux?

En sentido estricto, **Linux** es solo el *kernel* (núcleo): el programa que se
comunica con el hardware y permite que los demás programas compartan el
procesador, la memoria y los discos. Linus Torvalds creó el kernel en 1991, y
es software libre.

Para tener un sistema utilizable hace falta mucho más: una shell, herramientas
para gestionar archivos, un gestor de paquetes y quizá un entorno de
escritorio. Una **distribución** (*distro*) lo reúne todo en un conjunto listo
para usar. Debian, Ubuntu, Arch Linux y Fedora son algunos ejemplos conocidos.

Casi todo lo que aprendas en esta guía funciona igual en todas las
distribuciones, así que el curso empieza por ahí. La terminal de esta página
ejecuta **Ubuntu 24.04 LTS**. Las distribuciones se diferencian sobre todo en
cómo se instala el software: eso lo verás en el capítulo sobre distribuciones.

## ¿Qué es una shell?

Una **shell** es el programa que lee los comandos que escribes y los ejecuta.
La shell más común es **bash**, la predeterminada en casi todas las
distribuciones. Otras shells populares son **zsh** (la predeterminada en macOS)
y **fish**. Lo básico es igual en todas ellas.

Fíjate en la diferencia entre una *terminal* y una *shell*: la terminal es la
ventana que muestra el texto, y la shell es el programa que se ejecuta dentro
de ella.

```quiz
Escribes `ls` y pulsas Enter. ¿Qué programa lee el comando y lo ejecuta?
- [ ] La terminal
- [x] La shell
- [ ] El kernel
---
La terminal solo muestra el texto. La shell (aquí bash) lee lo que escribes
y lo ejecuta.
```

## El prompt

Cuando la shell está esperando un comando, muestra un **prompt** (indicador).
En la terminal de esta página tiene este aspecto:

```text
{{user}}@ubuntu:~$
```

Te indica quién eres (`{{user}}`), en qué ordenador estás (`ubuntu`) y en qué
lugar del sistema de archivos te encuentras (`~` significa tu directorio
personal). El signo `$` indica que eres un usuario normal. Si eres el
administrador (*root*), verás un `#` en su lugar.

```quiz
El prompt termina en `#` en lugar de `$`. ¿Qué te dice eso?
- [ ] Que estás en tu directorio personal
- [ ] Que el comando anterior falló
- [x] Que eres el administrador, root
```

## Tu primer comando

Haz clic en la terminal, escribe el comando de abajo y pulsa **Enter**:

```sh
echo {{helloWorld}}
```

`echo` simplemente imprime lo que le pases; aquí, *{{helloWorld}}*. La
mayoría de los comandos siguen el mismo patrón:

```text
comando  -opciones  argumentos
ls       -l         /etc
```

El *comando* es el programa que se ejecuta, las *opciones* (o *flags*)
modifican su comportamiento y los *argumentos* son aquello sobre lo que debe
trabajar el comando.

```quiz
En el comando `ls -l /etc`, ¿qué parte es la **opción**?
- [ ] `ls`
- [x] `-l`
- [ ] `/etc`
---
`ls` es el comando, `-l` modifica su comportamiento y `/etc` es el argumento:
aquello sobre lo que debe trabajar `ls`.
```

Prueba `echo` con un texto tuyo:

```try
echo Linux is fun
---
`echo` imprimió exactamente las palabras que le diste.
```

## ¿Quién soy y dónde estoy?

Dos pequeños comandos te informan sobre el sistema en el que estás. `whoami`
imprime el nombre del usuario con el que has iniciado sesión. El archivo
`/etc/os-release` describe la distribución, y `cat` imprime un archivo
(verás más sobre `cat` en un capítulo posterior):

```sh
whoami
cat /etc/os-release
```

## Cómo funciona el simulador

La terminal de esta página es un **simulador** que se ejecuta por completo
dentro de esta aplicación. Se comporta como un ordenador Linux real, pero nada
de lo que hagas puede dañar tu propio equipo, y si haces alguna tontería
siempre puedes empezar de nuevo con *Restablecer terminal* en los ajustes.

- **Haz clic en un ejemplo de código** para poner el comando en la terminal.
- **Tab** completa comandos y nombres de archivo.
- **Flechas arriba/abajo** recorren los comandos anteriores.
- **Ctrl+L** limpia la pantalla y **Ctrl+C** cancela la línea que estás
  escribiendo.
- `help` muestra todos los comandos, y `man comando` muestra una página del
  manual.

```quiz
Has escrito `ech` y pulsas **Tab**. ¿Qué ocurre?
- [ ] Se cancela la línea
- [x] La shell intenta completar el resto del nombre
- [ ] Se limpia la pantalla
---
Tab completa comandos y nombres de archivo. **Ctrl+C** cancela la línea y
**Ctrl+L** limpia la pantalla.
```
