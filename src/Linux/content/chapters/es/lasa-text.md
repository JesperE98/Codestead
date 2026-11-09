# Leer y buscar texto

Casi todo en Linux es texto: configuraciones, registros, listas. Por eso hay
un montón de pequeñas herramientas para leer y buscar en archivos de texto. En
tu directorio personal hay un directorio llamado `{{documents}}` con archivos
para practicar, entre ellos `{{fruits}}`, una lista de frutas, y `server.log`,
el registro de un servidor web inventado. Como en los registros reales, cada
línea lleva un nivel: `INFO`, `WARN` o `ERROR`.

## Mostrar un archivo – `cat` y `less`

`cat` imprime el archivo entero:

```sh
cat {{documents}}/{{fruits}}
```

Para archivos largos, `less` es mejor. Allí te desplazas con las flechas y la
barra espaciadora, buscas con `/palabra` y sales con `q`.

Mira la lista de frutas: la necesitarás para la siguiente pregunta:

```try
cat {{documents}}/{{fruits}}
```

## El principio y el final – `head` y `tail`

`head` muestra las primeras líneas y `tail` las últimas. Por defecto son 10
líneas, pero puedes elegir otro número con `-n`:

```sh
head -n 5 {{documents}}/server.log
tail -n 3 {{documents}}/server.log
```

`tail -f` *sigue* un archivo y muestra las líneas nuevas a medida que se
escriben: perfecto para los registros. Se detiene con **Ctrl+C**.

```predict
$ tail -n 1 {{documents}}/{{fruits}}
mango
---
`tail -n 1` muestra solo la última línea.
```

## Contar – `wc`

`wc` (*word count*) cuenta líneas, palabras y bytes:

```sh
wc {{documents}}/{{fruits}}
```

A menudo solo quieres el número de líneas: `wc -l`.

## Buscar – `grep`

`grep` es uno de los comandos más útiles que existen. Muestra todas las líneas
que contienen un patrón:

```sh
grep INFO {{documents}}/server.log
```

Algunas opciones que usarás mucho:

| Opción | Significado |
|---|---|
| `-i` | Ignorar la diferencia entre mayúsculas y minúsculas |
| `-n` | Mostrar los números de línea |
| `-v` | Mostrar las líneas que *no* coinciden |
| `-c` | Contar las líneas que coinciden |
| `-r` | Buscar de forma recursiva en todos los archivos de un directorio |
| `-E` | Patrones extendidos, p. ej. `"ERROR|WARN"` |

```sh
grep -n WARN {{documents}}/server.log
```

El patrón es una *expresión regular*. Un par de ejemplos: `^` significa el
principio de la línea y `$` el final, así que `grep "^2026"` encuentra las
líneas que empiezan por 2026.

```quiz
`server.log` tiene dos líneas con `WARN` y una línea con `warn` en minúsculas.
¿Qué imprime `grep -c WARN {{documents}}/server.log`?
- [ ] 1
- [x] 2
- [ ] 3
---
`-c` cuenta las líneas que coinciden, y sin `-i` las mayúsculas y las minúsculas
son distintas. `grep -ic WARN` contaría las tres.
```

```quiz
¿Qué comando muestra todas las líneas de `server.log` que **no** contienen `INFO`?
- [ ] `grep -i INFO {{documents}}/server.log`
- [ ] `grep -c INFO {{documents}}/server.log`
- [x] `grep -v INFO {{documents}}/server.log`
```

## Ordenar – `sort` y `uniq`

`sort` ordena las líneas alfabéticamente (`-n` para números, `-r` para orden
inverso). `uniq` elimina las líneas idénticas a la línea *inmediatamente
anterior*; por eso casi siempre se usa después de `sort`:

```sh
sort {{documents}}/{{fruits}}
```

```quiz
¿Por qué `uniq` casi siempre se usa después de `sort`?
- [ ] `uniq` solo funciona con archivos ordenados y, si no, falla
- [x] `uniq` solo elimina las líneas idénticas a la línea inmediatamente anterior, así que las líneas iguales tienen que estar juntas
- [ ] `sort` elimina los duplicados y `uniq` los vuelve a poner
```

## Recortar campos – `cut`

En `{{documents}}` hay un tercer archivo de práctica, un archivo CSV con las
puntuaciones de los alumnos:

```sh
cat ~/{{documents}}/{{grades}}
```

CSV significa *comma-separated values* (valores separados por comas): las
columnas están separadas por comas y la primera línea es una cabecera.

Cuando un archivo está formado por campos con un separador entre ellos, `cut`
puede extraer un campo. `-d` elige el separador (*delimiter*) y `-f` qué
campo conservar. Aquí están las asignaturas –el campo 2– del archivo CSV:

```sh
cut -d, -f2 ~/{{documents}}/{{grades}}
```

En `/etc/passwd`, los campos están separados por dos puntos y el campo 1 es el
nombre de usuario, así que `cut -d: -f1 /etc/passwd` lista todos los usuarios.

## El manual – `man`

¿Has olvidado qué hace una opción? Cada comando tiene su página del manual:

```sh
man grep
```
