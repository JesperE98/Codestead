# Leer y buscar texto

Casi todo en Linux es texto: configuraciones, registros, listas. Por eso hay
un montón de pequeñas herramientas para leer y buscar en archivos de texto. En
tu directorio personal hay un directorio llamado `dokument` con dos archivos
para practicar: `frukter.txt` (una lista de frutas) y `server.log` (el
registro de un servidor web inventado). Su contenido está en sueco, pero las
palabras que vas a buscar –`INFO`, `WARN` y `ERROR`– son las mismas que en los
registros reales.

## Mostrar un archivo – `cat` y `less`

`cat` imprime el archivo entero:

```sh
cat dokument/frukter.txt
```

Para archivos largos, `less` es mejor. Allí te desplazas con las flechas y la
barra espaciadora, buscas con `/palabra` y sales con `q`.

## El principio y el final – `head` y `tail`

`head` muestra las primeras líneas y `tail` las últimas. Por defecto son 10
líneas, pero puedes elegir otro número con `-n`:

```sh
head -n 5 dokument/server.log
tail -n 3 dokument/server.log
```

`tail -f` *sigue* un archivo y muestra las líneas nuevas a medida que se
escriben: perfecto para los registros. Se detiene con **Ctrl+C**.

## Contar – `wc`

`wc` (*word count*) cuenta líneas, palabras y bytes:

```sh
wc dokument/frukter.txt
```

A menudo solo quieres el número de líneas: `wc -l`.

## Buscar – `grep`

`grep` es uno de los comandos más útiles que existen. Muestra todas las líneas
que contienen un patrón:

```sh
grep INFO dokument/server.log
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
grep -n WARN dokument/server.log
```

El patrón es una *expresión regular*. Un par de ejemplos: `^` significa el
principio de la línea y `$` el final, así que `grep "^2026"` encuentra las
líneas que empiezan por 2026.

## Ordenar – `sort` y `uniq`

`sort` ordena las líneas alfabéticamente (`-n` para números, `-r` para orden
inverso). `uniq` elimina las líneas idénticas a la línea *inmediatamente
anterior*; por eso casi siempre se usa después de `sort`:

```sh
sort dokument/frukter.txt
```

## El manual – `man`

¿Has olvidado qué hace una opción? Cada comando tiene su página del manual:

```sh
man grep
```
