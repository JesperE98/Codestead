# Copiar archivos por SSH

En el capítulo de redes ejecutaste comandos en el servidor `192.168.1.10` con
`ssh`. Aquí le das al servidor un nombre corto, copias archivos hacia él y
desde él con `scp`, y mantienes directorios enteros sincronizados con `rsync`.

## Nombres cortos – `~/.ssh/config`

Escribir `ssh {{user}}@192.168.1.10` cada vez acaba cansando. En el archivo
`~/.ssh/config` puedes darle a un servidor un nombre corto:

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` es el nombre corto, `HostName` la dirección real (o el nombre real) y
`User` el nombre de usuario en el servidor. Si el servidor escucha en otro
puerto que no sea el 22, añade una línea como `Port 2222`. A partir de ahí
basta con esto:

```sh
ssh srv hostname
```

El simulador todavía no tiene editor de texto, así que escribe el archivo con
`echo`. La sangría solo está para que se lea mejor:

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

ssh es estricto con este archivo. Si otros pueden escribir en él, ssh se niega
con *Bad owner or permissions*, y una palabra mal escrita lo detiene en el
acto:

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
ssh lee todo el archivo antes de conectarse, así que una sola palabra
equivocada detiene todas las conexiones, y el mensaje de error dice en qué
línea está.
```

Los nombres también funcionan con `scp` y `rsync`.

```quiz
En `~/.ssh/config`, ¿qué línea indica adónde debe conectarse ssh de verdad?
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` es el nombre corto que escribes tú, `HostName` la dirección real y
`User` el usuario con el que inicias sesión.
```

## Copiar – `scp`

`scp` (*secure copy*) funciona como `cp`, pero uno de los lados puede estar en
otro ordenador. Se escribe `HOST:PATH`:

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- El origen va primero y el destino al final, igual que con `cp`.
- Una ruta después de los dos puntos se cuenta desde tu directorio personal en
  el servidor, y `srv:` a secas significa el directorio personal.
- Los directorios necesitan `-r`.
- El puerto se indica con una `-P` mayúscula (con `ssh` es una `-p`
  minúscula).

Para cada archivo, `scp` muestra una línea con el nombre, `100%`, el tamaño y
la velocidad.

```quiz
Escribes `scp report.txt srv`, sin dos puntos. ¿Qué ocurre?
- [ ] El archivo se copia a tu directorio personal en el servidor
- [x] Obtienes una copia local llamada `srv`
- [ ] scp te pregunta a qué ordenador te refieres
---
Sin los dos puntos, `srv` es solo un nombre de archivo, y `scp` copia en local
como `cp`. ¡Es fácil olvidar los dos puntos!
```

## Mantener sincronizado – `rsync`

Para muchos archivos, o para algo que copias una y otra vez (¡copias de
seguridad!), `rsync` es mejor. Solo copia lo que falta o ha cambiado:

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{grades}}
{{fruits}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

`-a` (*archive*) copia los directorios de forma recursiva y conserva los
permisos y las fechas, y `-v` lista lo que se copia. Ejecuta el mismo comando
otra vez y la lista sale vacía: no ha cambiado nada. rsync compara el tamaño y
la fecha de modificación de cada archivo; sin `-a`, las copias reciben fechas
nuevas y todo se envía cada vez.

### La barra al final

Una barra al final del origen es importante:

| Comando | Resultado |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...`: el propio directorio |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...`: solo lo que hay dentro |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
Sin la barra, se copió el propio directorio dentro de `/tmp/x`.
```

### Por SSH y `--delete`

Con un servidor como destino, rsync va por ssh:

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

`--delete` también elimina en el destino los archivos que ya no existen en el
origen, de modo que el destino se convierte en una copia exacta. Una ruta
equivocada puede entonces borrar mucho, así que prueba primero con `-n`
(*dry run*). No ocurre nada: rsync solo muestra lo que haría, y la última
línea termina con `(DRY RUN)`:

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
¿Qué hace `-n` en `rsync -avn --delete a/ b/`?
- [ ] Copia solo los archivos nuevos
- [x] Muestra lo que pasaría sin hacer nada
- [ ] Se salta los archivos que se eliminarían
---
`-n` es un ensayo. Revisa primero la lista y luego ejecuta el mismo comando sin
`-n`.
```

## ¿scp o rsync?

| | `scp` | `rsync` |
|---|---|---|
| Bueno para | Unos pocos archivos, una vez | Copias de seguridad y copias repetidas |
| Envía | Todo, cada vez | Solo lo que ha cambiado |
| También en local | Funciona, pero `cp` es más sencillo | Sí |
| Espejo con `--delete` | No | Sí |

`scp` viene con el cliente de ssh. `rsync` tiene que estar instalado en los dos
ordenadores: viene de serie en Ubuntu, Debian y Fedora, mientras que en Arch
instalas el paquete `rsync`.

En el simulador, el servidor olvida sus archivos cuando cierras la aplicación.
