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

## Desde un archivo – `<`

`<` hace que un programa lea su stdin desde un archivo:

```sh
wc -l < dokument/frukter.txt
```

## Mensajes de error – `2>`

Los mensajes de error van a stderr y no se ven afectados por `>`. Para
manejarlos, escribe el número del flujo delante:

```sh
ls /finnsinte 2> fel.txt
```

(*Finns inte* significa «no existe» en sueco, y *fel* significa «error».)

El archivo `/dev/null` es un «agujero negro»: todo lo que se escribe en él
desaparece. Resulta muy útil para silenciar errores. Con `2>&1`, stderr se
envía al mismo sitio que stdout.

## Pipes – `|`

Una **pipe** envía la stdout de un comando directamente a la stdin del
siguiente. Este es el corazón de la filosofía Unix: *haz una sola cosa y hazla
bien, y deja que los programas colaboren*.

```sh
grep INFO dokument/server.log | wc -l
```

`grep` encuentra las líneas y `wc -l` las cuenta. Puedes encadenar tantos
comandos como quieras:

```sh
sort dokument/frukter.txt | uniq -c | sort -rn
```

Léelo paso a paso: ordena las frutas, cuenta cuántas hay de cada una
(`uniq -c`) y luego ordena numéricamente con la mayor primero (`sort -rn`).

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
mkdir -p ny && cd ny
```
