# Moverse por el sistema de archivos

Linux no tiene letras de unidad como `C:`. Todo –discos duros, memorias USB e
incluso el hardware– vive en **un único árbol** de directorios que empieza en
la **raíz**, que se escribe `/`.

## Los directorios más importantes

| Directorio | Contenido |
|---|---|
| `/` | La raíz: la parte más alta del árbol |
| `/home` | Los directorios personales de los usuarios, p. ej. `/home/elev` |
| `/root` | El directorio personal del administrador, root |
| `/etc` | Configuración del sistema (archivos de configuración) |
| `/usr/bin` | Programas (comandos) como `ls` y `cat` |
| `/var/log` | Archivos de registro (logs) |
| `/tmp` | Archivos temporales en los que cualquiera puede escribir |
| `/dev` | Dispositivos, p. ej. discos |
| `/proc` | Información sobre los procesos y el kernel |
| `/boot` | Archivos necesarios para arrancar el ordenador |

Esta estructura se llama *Filesystem Hierarchy Standard* (FHS), y es casi
idéntica en todas las distribuciones.

## ¿Dónde estoy? – `pwd`

`pwd` (*print working directory*) muestra el directorio en el que te
encuentras:

```sh
pwd
```

## ¿Qué hay aquí? – `ls`

`ls` muestra el contenido de un directorio. Sin argumentos muestra el
directorio en el que estás, pero también puedes indicar otro:

```sh
ls /etc
```

La opción `-l` da un formato largo con más información:

```sh
ls -l
```

Los archivos cuyo nombre empieza por un punto están **ocultos** y no se
muestran por defecto. Suelen ser archivos de configuración, como `.bashrc`. La
opción `-a` (*all*, todos) los muestra:

```sh
ls -a
```

Las opciones se pueden combinar: `ls -la` es lo mismo que `ls -l -a`.

## Cambiar de directorio – `cd`

`cd` (*change directory*) te lleva a otro directorio:

```sh
cd /var/log
```

Hay dos tipos de rutas:

- Una ruta **absoluta** empieza por `/` y parte de la raíz, p. ej.
  `/var/log`. Funciona estés donde estés.
- Una ruta **relativa** parte del directorio en el que estás. Si estás en `/`,
  puedes llegar a `/var/log` simplemente con `cd var/log`.

Conviene conocer algunos nombres especiales:

| Nombre | Significa |
|---|---|
| `.` | El directorio en el que estás |
| `..` | El directorio de arriba (el padre) |
| `~` | Tu directorio personal |
| `-` | (solo con `cd`) el último directorio en el que estuviste |

`cd` sin argumentos siempre te lleva a casa.

```sh
cd ..
```

## Autocompletado con Tab

Rara vez necesitas escribir los nombres completos. Escribe el principio, por
ejemplo `cd /va`, y pulsa **Tab**: la shell completa el resto. Si hay varias
posibilidades, se muestran al pulsar Tab. ¡Los usuarios experimentados de
Linux pulsan Tab todo el rato!
