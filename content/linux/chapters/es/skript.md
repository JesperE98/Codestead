# Scripts de shell

Todo lo que has escrito en la terminal hasta ahora también se puede guardar en
un archivo y ejecutarse una y otra vez. Un archivo así se llama **script**.
Los scripts te permiten automatizar las tareas aburridas: copias de seguridad,
renombrar cien archivos o revisar los registros cada mañana. Además, bash es
un lenguaje de programación de verdad, con variables, condiciones, bucles y
funciones.

## Un primer script

Un script es un archivo de texto normal. En un ordenador real lo escribirías
en un editor de texto como `nano` o `vim`. Otra forma, que funciona tanto aquí
como en los servidores, es un **here document**: todo lo que hay entre
`<< 'SLUT'` y la línea `SLUT` se pasa al comando. (*Slut* simplemente
significa «fin» en sueco; puedes elegir la palabra que quieras, y `EOF` es una
opción habitual).

Escribe la primera línea y pulsa Enter. El prompt cambia a `> `: la shell está
esperando el resto. Escribe las líneas de una en una y termina con `SLUT`:

```sh
cat > hej.sh << 'SLUT'
#!/bin/bash
echo "¡Hola desde un script!"
echo "Hoy es $(date)"
SLUT
```

La primera línea, `#!/bin/bash`, se llama *shebang* e indica al sistema qué
programa debe ejecutar el archivo. Haz que el script sea ejecutable y
ejecútalo:

```sh
chmod +x hej.sh
./hej.sh
```

Las líneas que empiezan por `#` (salvo la línea del shebang) son
**comentarios**, que la shell ignora. ¡Úsalos para explicar qué hace el
código!

## Variables

Una variable se crea con `nombre=valor`. **No** puede haber espacios alrededor
del signo igual; si los hay, la shell cree que `nombre` es un comando.

```sh
stad=Göteborg
echo "Vivo en $stad"
```

(*Stad* significa «ciudad»). Pon siempre las variables entre **comillas
dobles** cuando las uses. Sin comillas, el valor se divide por los espacios,
lo que provoca errores extraños cuando un nombre de archivo contiene un
espacio. Si quieres escribir texto justo después del nombre de la variable,
usa llaves: `"${stad}_2026"`; sin ellas, bash buscaría una variable llamada
`stad_2026`.

## Sustitución de comandos – `$(...)`

`$(comando)` se sustituye por lo que imprima el comando. Así se guarda el
resultado de un comando en una variable:

```sh
idag=$(date)
filer=$(ls ~ | wc -l)
echo "Hay $filer elementos en tu directorio personal"
```

## Aritmética – `$(( ))`

Bash hace aritmética con enteros dentro de `$(( ))`. Dentro de los paréntesis
no hace falta poner `$` delante de las variables:

```sh
a=7
echo $(( a * 6 ))
echo $(( 17 / 5 )) resto $(( 17 % 5 ))
```

Para modificar una variable, escribe `(( a++ ))` o `(( a += 10 ))`.

## Argumentos

Cuando ejecutas `./skript.sh uno dos`, el script puede leer los argumentos:

| Variable | Contiene |
|---|---|
| `$0` | El nombre del script |
| `$1`, `$2` ... | El primer, segundo ... argumento |
| `$#` | El número de argumentos |
| `"$@"` | Todos los argumentos, cada uno por separado |
| `$?` | El código de salida del comando anterior |

## Condiciones – `if`

`if` ejecuta un comando y mira su **código de salida**: 0 significa verdadero,
cualquier otro valor, falso. Casi siempre se usa el comando `[` (también
llamado `test`):

```sh
if [ -f ~/.bashrc ]; then echo "El archivo existe"; else echo "El archivo no existe"; fi
```

¡Los espacios dentro de `[ ]` son obligatorios! Escrito en varias líneas, como
en un script, tiene este aspecto:

```text
if [ "$respuesta" = "sí" ]; then
    echo "¡Genial!"
elif [ "$respuesta" = "no" ]; then
    echo "Qué pena."
else
    echo "Responde sí o no."
fi
```

Las comprobaciones más habituales:

| Comprobación | Verdadera si |
|---|---|
| `-f ARCHIVO` | el archivo existe (y es un archivo normal) |
| `-d DIR` | el directorio existe |
| `-z "$x"` | la variable está vacía |
| `"$a" = "$b"` | las cadenas son iguales (`!=` distintas) |
| `$a -eq $b` | los números son iguales |
| `$a -lt $b` | menor que (`-le`, `-gt`, `-ge`, `-ne`) |
| `! CONDICIÓN` | la condición *no* es verdadera |

Fíjate en que los números se comparan con `-eq`, `-lt`, etc., mientras que
`=` y `<` comparan texto. Bash también tiene `[[ ... ]]`, que es un poco más
listo: ahí puedes escribir `&&` y `||` y comparar con patrones como
`[[ $file == *.txt ]]`.

Para condiciones cortas, a menudo basta con `&&` y `||`:

```sh
[ -d ~/bilder ] && echo "El directorio de imágenes existe"
```

## Bucles

Un **bucle for** hace lo mismo con cada elemento de una lista:

```sh
for frukt in äpple banan kiwi; do echo "Me gusta: $frukt"; done
```

La lista puede venir de comodines o de un comando:

```sh
for fil in ~/dokument/*; do echo "Archivo: $fil"; done
for i in $(seq 1 3); do echo "Vuelta $i"; done
```

Un **bucle while** continúa mientras la condición sea verdadera:

```sh
i=1; while [ $i -le 3 ]; do echo $i; (( i++ )); done
```

La forma más habitual de recorrer un archivo línea a línea es `while read`,
pasándole el archivo con `<` después de `done`:

```sh
while read rad; do echo "> $rad"; done < ~/dokument/frukter.txt
```

`break` sale de un bucle, y `continue` salta directamente a la siguiente
vuelta.

> **¡Cuidado con los bucles infinitos!** Un bucle cuya condición nunca se
> vuelve falsa sigue para siempre. En una terminal real lo detienes con
> **Ctrl+C**. El simulador lo detiene por sí solo después de 20 000 pasos.

## Elegir con `case`

Cuando una variable puede tener muchos valores distintos, `case` es más claro
que una larga cadena de `elif`:

```sh
fil=semester.jpg
case $fil in *.jpg|*.png) echo "Una imagen";; *.txt) echo "Un archivo de texto";; *) echo "Tipo desconocido";; esac
```

Cada alternativa termina con `;;`, y `*)` atrapa todo lo demás.

## Funciones

Una **función** es un fragmento de código con nombre que puedes llamar como si
fuera un comando más. Recibe los argumentos igual que un script: `$1`, `$2` y
`$#`:

```sh
halsa() { echo "Hola, $1. ¡Bienvenido!"; }
halsa Kim
```

Las variables que solo deben existir dentro de la función se crean con
`local`, y `return` termina la función con un código de salida.

## Preguntar al usuario – `read`

`read` lee una línea del teclado y la guarda en una variable:

```sh
read -p "¿Cómo te llamas? " namn; echo "¡Hola, $namn!"
```

## Un ejemplo completo

Aquí tienes un script que usa casi todo lo que hemos visto en este capítulo.
Hace una copia de seguridad de los archivos que le pases como argumentos:

```text
#!/bin/bash
# backup.sh – copia cada archivo a archivo.bak

if [ $# -eq 0 ]; then
    echo "Uso: $0 ARCHIVO..."
    exit 1
fi

for file in "$@"; do
    if [ -f "$file" ]; then
        cp "$file" "$file.bak"
        echo "Copiado $file"
    else
        echo "No se encuentra $file" >&2
    fi
done
```

`exit 1` termina el script con el código de salida 1, para que quien llamó al
script pueda ver que algo salió mal.

## Consejos para escribir buenos scripts

- Empieza con `#!/bin/bash` y escribe comentarios.
- Pon las variables entre comillas: `"$file"`, no `$file`.
- Mucha gente empieza sus scripts con `set -euo pipefail`, para que el script
  se detenga en el primer error en lugar de seguir a ciegas.
- El programa **ShellCheck** encuentra errores habituales en los scripts de
  bash; puedes instalarlo con el gestor de paquetes en todas las
  distribuciones importantes.
