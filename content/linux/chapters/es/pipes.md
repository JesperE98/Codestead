# Redirecciones y pipes

Este capítulo trata de lo que hace que la línea de comandos sea tan potente:
*conectar* pequeños programas entre sí.

## Tres flujos

Todo programa tiene tres flujos estándar:

| Número | Nombre | Qué es |
|---|---|---|
| 0 | stdin | La entrada, normalmente desde el teclado |
| 1 | stdout | La salida normal, normalmente a la pantalla |
| 2 | stderr | Los mensajes de error, también a la pantalla |

Con las *redirecciones* y las *pipes* (tuberías) puedes enviar estos flujos a
otro sitio.

## A un archivo – `>` y `>>`

`>` envía stdout a un archivo en lugar de a la pantalla. El archivo se crea si
no existe, ¡y se **sobrescribe** si ya existe!

```sh
echo "primera línea" > test.txt
```

`>>`, en cambio, añade al final del archivo:

```sh
echo "segunda línea" >> test.txt
cat test.txt
```

```predict
$ echo one > t.txt
$ echo two > t.txt
$ cat t.txt
two
---
El segundo `>` sobrescribió el archivo. Con `>>` contendría las dos líneas.
```

## Desde un archivo – `<`

`{{fruits}}` tiene diez líneas, una fruta por línea. Cuando le das a `wc -l`
un nombre de archivo, imprime el número de líneas seguido del nombre; aquí
para `{{grades}}`, que tiene nueve líneas:

```sh
wc -l {{documents}}/{{grades}}
```

```text
9 {{documents}}/{{grades}}
```

`<` hace que un programa lea su stdin desde un archivo:

```sh
wc -l < {{documents}}/{{fruits}}
```

Ahora `wc` nunca ve el nombre del archivo –solo recibe el texto por stdin–, así
que imprime únicamente el número.

```predict
$ wc -l {{documents}}/{{fruits}}
$ wc -l < {{documents}}/{{fruits}}
10 {{documents}}/{{fruits}}
10
---
Con un nombre de archivo como argumento, `wc` imprime también el nombre. Con `<`,
solo recibe el texto.
```

## Mensajes de error – `2>`

Los mensajes de error van a stderr y no se ven afectados por `>`. Para
manejarlos, escribe el número del flujo delante:

```sh
ls /{{missing}} 2> errores.txt
```

```quiz
Ejecutas `ls /{{missing}} > errores.txt`. ¿Dónde acaba el mensaje de error?
- [ ] En `errores.txt`
- [x] En la pantalla: `errores.txt` se queda vacío
- [ ] En ninguna parte, desaparece
---
`>` solo redirige stdout (el flujo 1). El mensaje de error va a stderr
(el flujo 2), que sigue yendo a la pantalla. Necesitarías `2>`.
```

El archivo `/dev/null` es un «agujero negro»: todo lo que se escribe en él
desaparece. Resulta muy útil para silenciar errores. Con `2>&1`, stderr se
envía al mismo sitio que stdout.

## Pipes – `|`

Una **pipe** envía la stdout de un comando directamente a la stdin del
siguiente. Este es el corazón de la filosofía Unix: *haz una sola cosa y hazla
bien, y deja que los programas colaboren*.

```sh
grep INFO {{documents}}/server.log | wc -l
```

`grep` encuentra las líneas y `wc -l` las cuenta. Puedes encadenar tantos
comandos como quieras:

```sh
sort {{documents}}/{{fruits}} | uniq -c | sort -rn
```

Léelo paso a paso: ordena las frutas, cuenta cuántas hay de cada una
(`uniq -c`) y luego ordena numéricamente con la mayor primero (`sort -rn`).

¿Cuántos archivos y directorios hay en `/etc`? Cuéntalos con una pipe:

```try
ls /etc | wc -l
```

## De la entrada a los argumentos – `xargs`

Algunos comandos no leen de una pipe en absoluto, sino que quieren nombres
como **argumentos**: `rm`, `mkdir`, `touch`, y `wc` cuando tiene que contar
dentro de archivos. `xargs` tiende el puente: lee las palabras de su entrada y las
pone detrás de un comando.

```sh
find {{documents}} -type f | xargs wc -l
```

Es lo mismo que escribir tú mismo cada nombre de archivo detrás de `wc -l`.
Con `-n 1`, `xargs` ejecuta el comando una vez por cada palabra, y con `-I {}`
una vez por cada línea, sustituyendo `{}` por la línea:

```sh
ls {{documents}} | xargs -I {} echo "File: {}"
```

```predict
$ printf 'a\nb\nc\n' | xargs echo
a b c
---
`xargs` reunió las tres líneas y ejecutó `echo a b c`, una sola vez.
```

## En pantalla y en un archivo – `tee`

`tee` pasa su entrada hacia delante *y* guarda una copia en un archivo:

```sh
ls /etc | tee etc-lista.txt | wc -l
```

## Cadenas – `;`, `&&` y `||`

Se pueden poner varios comandos en la misma línea:

| Sintaxis | Significa |
|---|---|
| `a ; b` | Ejecuta a y luego b |
| `a && b` | Ejecuta b solo si a tuvo éxito |
| `a \|\| b` | Ejecuta b solo si a falló |

```sh
mkdir -p nuevo && cd nuevo
```

```predict
$ mkdir {{documents}} 2> /dev/null && echo created || echo failed
failed
---
`{{documents}}` ya existe, así que `mkdir` falla (su mensaje de error desaparece en
`/dev/null`). `echo created` se omite y se ejecuta `echo failed`.
```
