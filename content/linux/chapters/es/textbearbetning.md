# Procesar texto con sed, tr y awk

Con `grep` puedes *encontrar* líneas. Pero a menudo quieres hacer algo más:
sustituir una palabra, eliminar ciertas líneas, extraer una columna o sumar
unos números. Para eso se usan tres herramientas clásicas:

| Herramienta | Trabaja con | Uso típico |
|---|---|---|
| `tr` | **caracteres** sueltos | pasar a mayúsculas, convertir `:` en saltos de línea |
| `sed` | **líneas** | sustituir una palabra, eliminar líneas |
| `awk` | **columnas** (campos) | extraer columnas, sumar, contar |

Las tres son *filtros*: leen texto, hacen algo con él y escriben el resultado
en stdout. Por eso encajan perfectamente en las pipes. Y el archivo original
**no** se modifica (con una excepción, `sed -i`, que veremos más adelante).

En `dokument` hay un nuevo archivo de práctica, un archivo CSV con las
puntuaciones de los alumnos (*namn* = nombre, *ämne* = asignatura, *poäng* =
puntos):

```sh
cat ~/dokument/betyg.csv
```

CSV significa *comma-separated values* (valores separados por comas): las
columnas están separadas por comas y la primera línea es una cabecera.

## Traducir caracteres – `tr`

`tr` (*translate*) sustituye cada carácter del primer conjunto por el carácter
que ocupa la misma posición en el segundo. `a-z` significa todas las letras de
la a a la z:

```sh
echo "hello from café" | tr a-z A-Z
```

```text
HELLO FROM CAFé
```

¿Te has fijado en la é? `tr` trabaja con *bytes* individuales, y letras como
la é, la ñ o las suecas å, ä y ö no forman parte de `a-z`. Conviene saberlo:
`awk` (más abajo) lo maneja mejor.

`tr` lee **solo** de stdin, nunca de archivos. Si quieres usar un archivo,
pásaselo con `<` o con una pipe:

```sh
tr a-z A-Z < ~/dokument/frukter.txt
```

Un truco clásico es convertir los dos puntos en saltos de línea (`\n`), de
modo que cada directorio de `PATH` quede en su propia línea:

```sh
echo $PATH | tr ':' '\n'
```

Con `-d` (*delete*) eliminas caracteres, y con `-s` (*squeeze*) reduces a uno
solo varios caracteres idénticos seguidos:

```sh
echo "070-123 45 67" | tr -d ' -'
echo "demasiados     espacios      seguidos" | tr -s ' '
```

En lugar de rangos puedes escribir *clases*, p. ej. `[:upper:]` (mayúsculas),
`[:lower:]` (minúsculas), `[:digit:]` (dígitos) y `[:space:]` (espacios en
blanco):

```sh
echo "Aula 101, planta 3" | tr -d '[:digit:]'
```

## El editor de flujo – `sed`

`sed` (*stream editor*) lee el texto línea a línea y ejecuta un pequeño
*script* sobre cada línea. El comando más común es `s`, de *substitute*
(sustituir).

### Sustituir texto – `s`

```sh
sed 's/ERROR/FEL/' ~/dokument/server.log
```

El script `s/ERROR/FEL/` significa: sustituye `ERROR` por `FEL` («error» en
sueco). Tiene la forma

```text
s/PATRÓN/REEMPLAZO/FLAGS
```

Sin flags, solo se sustituye la **primera** coincidencia de cada línea. Con
`g` (*global*) se sustituyen todas:

```sh
echo "gato gato gato" | sed 's/gato/perro/'
echo "gato gato gato" | sed 's/gato/perro/g'
```

La flag `i` hace que la búsqueda no distinga mayúsculas de minúsculas, igual
que `grep -i`:

```sh
sed 's/warn/WARNING/i' ~/dokument/server.log
```

El patrón es una *expresión regular*, igual que en `grep`. Aquí eliminamos la
fecha del principio de cada línea (`^` = principio de línea, `[0-9-]*` =
dígitos y guiones):

```sh
sed 's/^[0-9-]* //' ~/dokument/server.log
```

En el reemplazo, `&` significa «lo que haya coincidido»:

```sh
echo "Linux es divertido" | sed 's/Linux/**&**/'
```

**Otro delimitador.** Si el propio texto contiene barras, la cosa se complica:
`s/\/usr\/local/\/opt/`. Pero el carácter que va justo después de la `s`
decide cuál es el delimitador, así que puedes usar perfectamente `|` o `#`:

```sh
echo /usr/local/bin | sed 's|/usr/local|/opt|'
```

**Grupos.** Con `-E` (expresiones regulares extendidas) puedes capturar partes
de la coincidencia con paréntesis y usarlas en el reemplazo como `\1`, `\2` …
Aquí le damos la vuelta a la fecha:

```sh
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/dokument/server.log
```

### Elegir líneas – direcciones

Delante de un comando puedes escribir una *dirección* que elige a qué líneas
se aplica. El comando `d` (*delete*) elimina líneas y `p` (*print*) las
imprime:

```sh
sed '/INFO/d' ~/dokument/server.log
sed '1d' ~/dokument/betyg.csv
```

El primero elimina todas las líneas que contienen `INFO`; el segundo elimina
la línea 1, es decir, la cabecera.

Normalmente `sed` imprime *todas* las líneas. Con `-n` deja de hacerlo, y
entonces solo se imprime lo que pide `p`. Así se muestran las líneas 5 a 8:

```sh
sed -n '5,8p' ~/dokument/server.log
```

| Dirección | Significa |
|---|---|
| `5` | la línea 5 |
| `$` | la última línea |
| `/ERROR/` | las líneas que coinciden con el patrón |
| `2,4` | de la línea 2 a la 4 |
| `/WARN/,/ERROR/` | desde una línea con WARN hasta la siguiente línea con ERROR |
| `/INFO/!` | todas las líneas **excepto** las que coinciden |

Las direcciones funcionan con todos los comandos, `s` incluido. Aquí solo se
marcan las líneas de error:

```sh
sed '/ERROR/s/^/>>> /' ~/dokument/server.log
```

El comando `q` (*quit*) se detiene después de una línea determinada, así que
`sed 3q` hace lo mismo que `head -n 3`. Varios comandos se separan con `;` o
con varios `-e`:

```sh
sed -e '/INFO/d' -e 's/ERROR/FEL/' ~/dokument/server.log
```

### Editar el archivo directamente – `sed -i`

Hasta ahora todo se ha limitado a *imprimirse*. El archivo en sí no ha
cambiado; puedes comprobarlo con `cat`. Con `-i` (*in-place*), `sed` escribe
el resultado de vuelta en el archivo. Pruébalo con una copia:

```sh
cp ~/dokument/frukter.txt ~/frukter-kopia.txt
sed -i 's/kiwi/kiwifruit/' ~/frukter-kopia.txt
cat ~/frukter-kopia.txt
```

`sed -i` no se puede deshacer. Una buena forma de trabajar es ejecutar primero
el comando **sin** `-i` y mirar el resultado, y añadir `-i` cuando todo se vea
bien. Si escribes `-i.bak`, el original también se guarda como `archivo.bak`.

Los archivos de configuración de `/etc` pertenecen a root, así que allí
necesitas `sudo sed -i ...`. Es una forma habitual de cambiar una opción desde
un script sin abrir un editor de texto.

## Columnas – `awk`

`awk` es en realidad todo un pequeño lenguaje de programación, pero casi
siempre se usa para una cosa: trabajar con **columnas**. awk divide cada línea
en *campos*:

| Campo | Significa |
|---|---|
| `$1`, `$2` … | el primer, segundo … campo |
| `$0` | la línea entera |
| `NF` | el número de campos de la línea (*number of fields*) |
| `$NF` | el último campo |
| `NR` | el número de línea (*number of record*) |

Por defecto, los campos están separados por espacios (los que haya). En
`server.log`, el campo 3 es el nivel del registro:

```sh
awk '{print $3}' ~/dokument/server.log
```

El programa va entre `{ }` y se ejecuta para cada línea. Pon siempre el
programa de awk entre comillas **simples**; si no, la shell cree que `$3` es
una variable de la shell y la sustituye antes incluso de que awk arranque.

awk encaja perfectamente en una pipe. ¿Cuántas líneas hay de cada nivel?

```sh
awk '{print $3}' ~/dokument/server.log | sort | uniq -c
```

### Otros separadores – `-F`

Con `-F` eliges el separador de campos. En `/etc/passwd` son los dos puntos;
el campo 1 es el nombre de usuario y el campo 7 la shell:

```sh
awk -F: '{print $1, $7}' /etc/passwd
```

La coma de `print` se convierte en un espacio en la salida. Sin coma, los
campos se pegan entre sí, y entonces puedes intercalar tu propio texto:

```sh
awk -F: '{print $1 " usa " $7}' /etc/passwd
```

Quizá recuerdes `cut -d: -f1`. La diferencia es que awk puede reordenar los
campos, intercalar texto y manejar varios espacios seguidos.

### Patrones – elegir líneas

Antes de las `{ }` puedes escribir un *patrón*. Entonces el programa solo se
ejecuta para las líneas que coinciden. El patrón puede ser una expresión
regular, como en `grep`:

```sh
awk '/ERROR/ {print $2}' ~/dokument/server.log
```

… o una condición. El texto va entre comillas dobles:

```sh
awk -F, '$2 == "matte" {print $1, $3}' ~/dokument/betyg.csv
```

(*Matte* significa «matemáticas» en sueco). Las comparaciones se escriben
`==`, `!=`, `<`, `<=`, `>` y `>=`, y las condiciones se combinan con `&&` (y),
`||` (o) y `!` (no). Aquí están todos los alumnos con al menos 90 puntos (sin
`{ }` se imprime la línea entera):

```sh
awk -F, '$3 >= 90' ~/dokument/betyg.csv
```

¿Te ha salido también la línea de cabecera? En ella, el campo 3 es la palabra
`poäng`, y cuando un valor no es un número, awk lo compara como *texto*, y
`"poäng"` va después de `"90"` en orden alfabético. La cabecera se salta con
`NR > 1`:

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/dokument/betyg.csv
```

### Contar – variables y `END`

awk tiene variables que no hace falta declarar: empiezan valiendo 0. El bloque
`END { }` se ejecuta una sola vez, **después** de la última línea. Juntos son
una forma sencilla de sumar una columna:

```sh
awk -F, 'NR > 1 {summa += $3} END {print summa}' ~/dokument/betyg.csv
```

`summa += $3` significa «suma el campo 3 a summa» (*summa* es «suma» en
sueco). Si a la vez cuentas las líneas (`antal++` incrementa en 1 *antal*, la
cantidad), puedes calcular la media:

```sh
awk -F, 'NR > 1 {summa += $3; antal++} END {print "Media:", summa / antal}' ~/dokument/betyg.csv
```

También existe `BEGIN { }`, que se ejecuta **antes** de la primera línea: muy
útil para títulos. Y con `printf` decides exactamente cómo es la salida:
`%-8s` es texto alineado a la izquierda en 8 caracteres y `%5d` un entero en 5
caracteres.

```sh
awk -F, 'BEGIN {print "Alumno   Puntos"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/dokument/betyg.csv
```

awk también tiene funciones, como `length()`, `toupper()` y `tolower()`. A
diferencia de `tr`, GNU awk maneja letras como la å, la ä y la ö:

```sh
awk '{print toupper($0)}' ~/dokument/frukter.txt
```

:::debian
En {{distro}}, `awk` es por defecto **mawk**, una variante pequeña y rápida. Si
quieres GNU awk, instala el paquete `gawk`. Con programas sencillos como estos
no notarás ninguna diferencia, pero mawk no convierte la å, la ä ni la ö con
`toupper()`.
:::

:::arch
En Arch Linux, `awk` es **GNU awk** (el paquete `gawk`).
:::

:::redhat
En {{distro}}, `awk` es **GNU awk** (el paquete `gawk`).
:::

El simulador solo conoce una parte del lenguaje awk: lo que se explica aquí y
un poco más (`if`, bucles y arrays). Consulta `man awk`.

## ¿Qué herramienta elijo?

| Quieres … | Usa |
|---|---|
| encontrar líneas que contengan algo | `grep` |
| sustituir o eliminar caracteres sueltos | `tr` |
| sustituir palabras o patrones, eliminar líneas | `sed` |
| extraer columnas, comparar números, sumar | `awk` |

La verdadera potencia está en combinarlas. ¿Qué niveles hay entre las líneas
que *no* son INFO, si no distinguimos entre mayúsculas y minúsculas?

```sh
grep -v INFO ~/dokument/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
