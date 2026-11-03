# Resumen: Redes

En esta parte te has orientado en una pequeña red doméstica desde la terminal:
tu propia dirección, el camino hacia internet, los nombres y el DNS, los
puertos, la web y otros ordenadores por SSH.

## Redes

Cada ordenador de una red tiene una **dirección IP**, y las direcciones que
empiezan por `192.168.`, `10.` o `172.16.`–`172.31.` son **privadas**. `ip a`
muestra las interfaces y las direcciones del ordenador: `lo` es la tarjeta de
loopback, y `127.0.0.1` (**localhost**) siempre significa el propio
ordenador. La **máscara de red** (`/24`) dice qué direcciones están en la red
local; todo lo demás va por la ruta por defecto a la **puerta de enlace**, que
muestra `ip route`. `ping` comprueba si se puede llegar a un ordenador.

El **DNS** traduce nombres a direcciones. Antes de preguntar al DNS, el
ordenador mira en `/etc/hosts`, y `getent hosts` muestra lo que resuelve el
sistema, mientras que `dig` pregunta directamente al DNS. En Ubuntu
`/etc/resolv.conf` apunta a `127.0.0.53`, systemd-resolved, y `dig`, `host` y
`nslookup` vienen en el paquete `dnsutils`.

Un **puerto** señala un programa dentro de un ordenador, y `ss -tulpn` muestra
qué puertos están escuchando. `curl` descarga una URL y la muestra, `wget`
descarga a un archivo; en Ubuntu `wget` viene preinstalado y `curl` se instala
con apt. Con **SSH** ejecutas comandos en otro ordenador, de forma cifrada; la
primera vez confirmas la clave de host del servidor, y con un par de claves ya
no necesitas contraseña.

En `~/.ssh/config` das nombres cortos a los servidores con `Host`, `HostName`
y `User`. `scp` copia como `cp`, pero uno de los lados se escribe
`HOST:PATH`, relativo al directorio personal de allí. `rsync -av` solo copia
lo que ha cambiado; una barra al final del origen significa «lo que hay en el
directorio», y `--delete` convierte el destino en una copia exacta: pruébalo
primero con `-n`.

Cuando «internet no funciona», ve de dentro hacia fuera: dirección, ruta,
router, una dirección en internet y, por último, un nombre. Si las direcciones
funcionan pero los nombres no, es el DNS.

## Comandos

| Comando | Qué hace |
|---|---|
| `ip a`, `ip -br a`, `hostname -I` | Muestra las direcciones IP |
| `ip route` | Muestra la tabla de rutas y la puerta de enlace |
| `ping -c 3 HOST` | Comprueba si se puede llegar a un ordenador |
| `sudo ip link set CARD down` / `up` | Apaga / enciende una tarjeta de red |
| `cat /etc/resolv.conf` | A qué servidor DNS se pregunta |
| `dig +short NAME`, `dig @SERVER NAME` | Busca un nombre en el DNS |
| `host NAME`, `nslookup NAME` | Busca un nombre (con `host`, también de dirección a nombre) |
| `getent hosts NAME` | Busca como lo hace el sistema (con `/etc/hosts`) |
| `sudo tee -a /etc/hosts` | Añade a `/etc/hosts` lo que llega por una pipe, como root |
| `ss -tulpn` | Muestra los puertos que escuchan |
| `curl URL` | Descarga y muestra |
| `curl -I URL`, `curl -L URL` | Solo las cabeceras, seguir redirecciones |
| `curl -o FILE URL`, `wget URL`, `wget -O FILE URL` | Descarga a un archivo |
| `ssh USER@HOST COMMAND` | Ejecuta un comando en otro ordenador |
| `ssh-keygen`, `ssh-copy-id USER@HOST` | Crea un par de claves y pone la clave pública en el servidor |
| `ssh srv` con `Host srv` en `~/.ssh/config` | Inicia sesión con un nombre corto |
| `scp FILE HOST:` · `scp HOST:FILE .` · `scp -r` | Copia a · desde otro ordenador · directorios enteros |
| `rsync -av SOURCE/ TARGET` | Copia solo lo que ha cambiado |
| `rsync -avn --delete SOURCE/ TARGET` | Prueba un espejo sin hacer nada |
