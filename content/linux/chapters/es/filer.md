# Archivos y directorios

Ahora que ya sabes moverte, es hora de crear, copiar, mover y eliminar cosas.

## Crear directorios – `mkdir`

```sh
mkdir bilder2
```

Si quieres crear varios niveles a la vez, necesitas `-p` (*parents*, padres).
Sin esta opción, `mkdir` se queja si el directorio padre no existe:

```sh
mkdir -p resa/2026/juni
```

## Crear archivos vacíos – `touch`

`touch` crea un archivo vacío si no existe (y, si existe, solo actualiza su
fecha de modificación):

```sh
touch inkopslista.txt
```

```quiz
¿Qué hace `touch anteckningar.txt` si el archivo ya existe?
- [ ] Vacía el archivo
- [ ] Se queja de que el archivo ya existe
- [x] Solo actualiza la fecha del archivo: el contenido no cambia
```

## Copiar – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

Si el destino es un directorio, la copia acaba dentro de él con el mismo
nombre. Para copiar un directorio entero necesitas `-r` (*recursive*,
recursivo):

```sh
cp -r dokument dokument-backup
```

```predict
$ mkdir kopior
$ cp anteckningar.txt kopior
$ ls kopior
anteckningar.txt
---
`kopior` es un directorio, así que la copia acaba dentro de él con el mismo nombre.
```

## Mover y renombrar – `mv`

En Linux, *mover* y *renombrar* son lo mismo. `mv` hace las dos cosas:

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
```

```quiz
No existe ningún archivo llamado `b.txt`. ¿Qué hace `mv a.txt b.txt`?
- [ ] Copia `a.txt` a `b.txt`
- [x] Renombra `a.txt` a `b.txt`
- [ ] Falla, porque `b.txt` no existe
---
Mover y renombrar son lo mismo. Después solo queda `b.txt`.
```

## Eliminar – `rm` y `rmdir`

```sh
rm anteckningar-kopia.txt
```

`rmdir` elimina directorios *vacíos*. Para eliminar un directorio con todo lo
que contiene, usa `rm -r`:

```sh
rm -r dokument-backup
```

> **¡Cuidado!** En la terminal no hay papelera de reciclaje. Lo que eliminas
> con `rm` desaparece para siempre. El comando `rm -rf` (*recursive, force*)
> no hace preguntas y nunca se queja: comprueba siempre la ruta dos veces
> antes de pulsar Enter.

```quiz
¿Qué comando elimina el directorio `gammalt` *solo* si está vacío?
- [ ] `rm gammalt`
- [x] `rmdir gammalt`
- [ ] `rm -r gammalt`
---
`rmdir` se niega a eliminar un directorio que todavía contiene algo.
`rm -r` elimina el directorio y todo lo que hay dentro.
```

## Comodines

La shell puede expandir patrones en varios nombres de archivo antes de que se
ejecute el comando:

| Patrón | Coincide con |
|---|---|
| `*` | Cualquier cosa (cero o más caracteres) |
| `?` | Exactamente un carácter |
| `[abc]` | Uno de los caracteres a, b o c |

El directorio `dokument` de tu directorio personal contiene tres archivos:
`betyg.csv`, `frukter.txt` y `server.log`. Esto muestra solo los que terminan
en `.txt`:

```sh
ls dokument/*.txt
```

Aquí `ls` nunca llega a ver el asterisco: la shell ya ha sustituido
`dokument/*.txt` por todos los nombres de archivo que coinciden.

```predict
$ ls dokument/?????.*
dokument/betyg.csv
---
Cada `?` es exactamente un carácter, así que el nombre antes del punto debe
tener cinco caracteres. Solo `betyg` los tiene: `frukter` y `server` son más largos.
```

## Espacios en los nombres de archivo

La shell divide la línea de comandos por los espacios. Si un archivo tiene un
espacio en el nombre, tienes que usar comillas (o una `\` antes del espacio):

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

Por eso mucha gente prefiere guiones o guiones bajos en los nombres de
archivo.
