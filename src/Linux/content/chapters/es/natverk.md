# Redes

Casi todo lo que hace un ordenador con Linux implica hablar con otros
ordenadores: descargar actualizaciones, mostrar páginas web, iniciar sesión en
servidores. Cuando algo falla, la terminal tiene las mejores herramientas para
averiguar por qué. En este capítulo aprenderás a encontrar tu propia
dirección, probar conexiones, resolver nombres, ver qué servicios están en
marcha, descargar cosas de la web e iniciar sesión en otro ordenador con SSH.

El ordenador simulado está en una pequeña red doméstica:

| Ordenador | Dirección | Qué es |
|---|---|---|
| Tu ordenador (`ubuntu`) | `192.168.1.42` | Donde estás ahora |
| El router (puerta de enlace) | `192.168.1.1` | La conexión hacia internet |
| El servidor | `192.168.1.10` | Otro ordenador con Linux en el que puedes iniciar sesión |

Detrás del router hay un «internet» con, entre otros, `example.com`,
`linux.org` y `archlinux.org`.

## Direcciones IP

Cada ordenador de una red tiene una **dirección IP**. Una dirección IPv4 son
cuatro números entre 0 y 255, por ejemplo `192.168.1.42`. Las direcciones que
empiezan por `192.168.`, `10.` o `172.16.`–`172.31.` son **privadas**: solo se
usan dentro de redes locales y nunca se ven en internet.

El comando para mostrar las direcciones del ordenador es `ip` (del paquete
*iproute2*). `ip addr` se puede abreviar como `ip a`:

```sh
ip a
```

Verás dos **interfaces** (tarjetas de red):

- `lo`: *loopback*, una tarjeta de mentira que el ordenador usa para hablar
  consigo mismo.
- `enp0s3`: la tarjeta de red de verdad. Antes las tarjetas se llamaban
  `eth0`, y las inalámbricas suelen llamarse algo como `wlan0` o `wlp2s0`.

La línea `inet 192.168.1.42/24` es tu dirección IPv4. `link/ether` es la
**dirección MAC** de la tarjeta, que viene grabada en el hardware, y
`state UP` significa que la tarjeta está activa. Para un resumen más corto
tienes `-br` (*brief*), y `hostname -I` muestra solo las direcciones:

```sh
ip -br a
hostname -I
```

```try
ip -br a
---
Una línea por interfaz: el nombre, el estado (`UP`) y las direcciones.
```

En muchas guías todavía verás el comando antiguo `ifconfig` (del paquete
*net-tools*), pero en las distribuciones modernas no viene instalado por
defecto. `ip` hace todo lo que hacía y más.

## localhost: el propio ordenador

La dirección `127.0.0.1` tiene el nombre **localhost** y siempre significa
«este ordenador». Los programas de un mismo ordenador suelen hablar entre sí a
través de localhost: por ejemplo, un servidor web que estás desarrollando y el
navegador con el que lo pruebas. El tráfico hacia localhost nunca sale del
ordenador.

## Máscara de red y puerta de enlace

El `/24` detrás de la dirección es la **máscara de red**. Indica que los
primeros 24 bits (los tres primeros números, `192.168.1`) son la dirección de
la red. Todos los ordenadores cuya dirección empieza por `192.168.1.` están en
la misma red local y se pueden alcanzar directamente. Todo lo demás se envía a
la **puerta de enlace** (*gateway*), es decir, al router, que lo reenvía a
internet. Puedes verlo en la tabla de rutas:

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

La primera línea, **default**, es la ruta por defecto: «todo lo que no
aparezca en otra parte va a 192.168.1.1». La segunda línea dice que toda la
red `192.168.1.0/24` se alcanza directamente a través de `enp0s3`.
`proto dhcp` significa que el ordenador obtuvo su configuración
automáticamente del router mediante **DHCP**.

```quiz
Tu ordenador tiene la dirección `192.168.1.42/24`. ¿Qué direcciones puede
alcanzar directamente, sin pasar por la puerta de enlace?
- [x] `192.168.1.10`
- [x] `192.168.1.1`
- [ ] `192.168.2.10`
- [ ] `1.1.1.1`
---
Con `/24`, los tres primeros números son la dirección de la red. Todo lo que
empieza por `192.168.1.` está en la misma red local; todo lo demás va por la
ruta por defecto a la puerta de enlace.
```

```predict
$ ip route | grep default | awk '{print $3}'
192.168.1.1
---
La tercera palabra de la línea `default` es la dirección de la puerta de enlace.
```

## ping: ¿se puede alcanzar?

`ping` envía pequeños paquetes de prueba y mide cuánto tardan las respuestas.
Con `-c` (*count*) eliges cuántos paquetes; si no, ping sigue hasta que pulses
**Ctrl+C**:

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` es el tiempo de respuesta. Dentro de la red doméstica, menos de un
  milisegundo; hacia internet, a menudo 10–50 ms.
- `0% packet loss`: no se ha perdido ningún paquete. Si se pierden paquetes,
  suele indicar una red en mal estado (o una mala conexión wifi).
- `Destination Host Unreachable` significa que ningún ordenador de la red
  local tiene esa dirección.

Prueba también a hacer ping al propio ordenador y a un ordenador de internet:

```sh
ping -c 2 localhost
ping -c 3 example.com
```

¡Ojo! Muchos servidores y cortafuegos no responden al ping a propósito. Así que
no recibir respuesta no siempre significa que el ordenador esté apagado.

## Nombres y DNS

Las personas recordamos nombres; los ordenadores usan direcciones. **DNS**
(*Domain Name System*) es la guía telefónica de internet, que traduce
`example.com` a una dirección IP. El servidor DNS al que pregunta el ordenador
está indicado en `/etc/resolv.conf`:

```sh
cat /etc/resolv.conf
```

En Ubuntu la línea importante es `nameserver 127.0.0.53`: es
**systemd-resolved**, un intermediario local en tu propio ordenador que a su
vez le pregunta al router. Algunas otras
distribuciones ponen directamente el router, `192.168.1.1`.

Para consultar el DNS tú mismo se usan `dig`, `host` o `nslookup`. No vienen
instalados de serie. En Ubuntu vienen en el paquete `dnsutils` (otras familias
llaman al paquete de otra forma):

```sh
sudo apt update
sudo apt install dnsutils
```

`dig` muestra la respuesta completa del servidor DNS. Lo importante está bajo
`ANSWER SECTION`. Con `+short` obtienes solo la dirección:

```sh
dig example.com
dig +short example.com
```

`host` y `nslookup` hacen lo mismo con una salida más corta. `nslookup` existe
también en Windows y macOS. `host` puede hacer además una **búsqueda inversa**
(*reverse lookup*): de dirección a nombre:

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

Puedes preguntar a un servidor DNS concreto con `@`, por ejemplo `1.1.1.1` de
Cloudflare o `8.8.8.8` de Google:

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts: la lista de nombres del propio ordenador

Antes de preguntar al DNS, el ordenador mira en el archivo `/etc/hosts`. Ahí
pone, entre otras cosas, que `localhost` es `127.0.0.1`:

```sh
cat /etc/hosts
```

El servidor de la red doméstica tiene la dirección `192.168.1.10`, pero el
nombre `server.lan` no está en ningún DNS:

```sh
ping -c 1 server.lan
```

La solución es añadir una línea a `/etc/hosts`. El archivo pertenece a root,
así que necesitas `sudo`. Pero cuidado: esto **no** funciona:

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

`sudo` solo se aplica a `echo`. Es tu propio shell (que se ejecuta como tú, no
como root) el que abre el archivo para `>>`. El truco es `tee -a`, que añade al
final de un archivo lo que recibe por la pipe, y `tee` sí se puede ejecutar
con sudo:

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

Ahora el nombre funciona para todos los programas del ordenador. Pero `dig`
pregunta directamente al DNS e ignora `/etc/hosts`, así que sigue sin
encontrar nada. Para ver lo que resuelve el *sistema*, usa `getent`:

```sh
dig +short server.lan
getent hosts server.lan
```

`dig` no imprime nada, pero `getent` responde con la dirección seguida del
nombre:

```text
192.168.1.10    server.lan
```

El orden (primero el archivo, luego el DNS) lo determina la línea
`hosts: files dns` de `/etc/nsswitch.conf`.

```quiz
¿Por qué `sudo echo '192.168.1.10 server.lan' >> /etc/hosts` da
*Permission denied*?
- [ ] `echo` no se puede ejecutar con sudo
- [x] Es tu propio shell, no root, el que abre el archivo para `>>`: sudo solo se aplica a `echo`
- [ ] `/etc/hosts` no se puede modificar, ni siquiera como root
- [ ] `>>` solo funciona con archivos de tu directorio personal
---
Por eso se usa `echo ... | sudo tee -a /etc/hosts`: así es `tee`, que se
ejecuta como root, el que abre el archivo.
```

## Puertos y servicios

Una dirección IP señala un ordenador. Un **puerto** (un número entre 1 y
65535) señala un programa dentro de ese ordenador, como la dirección de un
edificio y el número de piso. De un programa que espera conexiones se dice que
**escucha** en un puerto. Algunos conocidos:

| Puerto | Servicio |
|---|---|
| 22 | SSH: iniciar sesión en otros ordenadores |
| 53 | DNS |
| 80 | HTTP: web |
| 443 | HTTPS: web cifrada |
| 8080 | A menudo servidores web durante el desarrollo |

Solo root puede abrir puertos por debajo de 1024. `ss` (*socket statistics*)
muestra qué puertos están escuchando:

```sh
ss -tulpn
```

Las opciones se suelen recordar como una retahíla: **t**cp, **u**dp,
**l**istening, **p**rocess, **n**umeric. `0.0.0.0:22` significa que `sshd`
escucha en el puerto 22 en todas las direcciones del ordenador, y `[::]:22` es
lo mismo para IPv6. La columna *Process* está vacía para los procesos de otros
usuarios; con `sudo` los ves todos:

```sh
sudo ss -tulpn
```

Si el servidor de prácticas `myserver` del capítulo de procesos está en
marcha, lo verás aquí en el puerto 8080. El comando antiguo `netstat -tulpn`
(de *net-tools*) hace lo mismo.

## Descargar de la web: curl y wget

`curl` descarga lo que haya en una dirección (una **URL**) y lo muestra en la
terminal. Pruébalo con myserver en tu propio ordenador:

En Ubuntu `curl` no viene preinstalado (pero `wget` sí):

```sh
sudo apt install curl
```

```sh
curl http://localhost:8080
```

¿Te sale `Couldn't connect to server`? Entonces no hay nada escuchando en ese
puerto; quizá detuviste myserver en el capítulo de procesos. Vuelve a
iniciarlo:

```sh
myserver
```

Con `-I`, curl muestra solo las **cabeceras** (*headers*) de la respuesta,
cuya primera línea es un **código de estado**:

```sh
curl -I https://example.com
```

| Código | Significa |
|---|---|
| 200 | OK |
| 301, 302 | La página se ha movido: mira `Location:` |
| 403 | Prohibido |
| 404 | No encontrado |
| 500 | Error del servidor |

Muchos sitios web redirigen de `http://` a `https://`. En ese caso solo
obtienes un breve «301 Moved Permanently». Con `-L`, curl sigue la
redirección:

```sh
curl -I http://linux.org
curl -L http://linux.org
```

Como curl escribe en la terminal, funciona de maravilla en una pipe. `-s`
(*silent*) desactiva el indicador de progreso:

```sh
curl -s https://example.com | grep title
```

Para guardar en un archivo, usa `-o ARCHIVO` (o `-O`, que toma el nombre del
archivo de la dirección):

```sh
cd ~
curl -o {{exampleHtml}} https://example.com
```

`wget` está hecho para descargar archivos. Siempre guarda en un archivo,
muestra el progreso y sigue las redirecciones por sí solo:

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

Para elegir tú el nombre del archivo, usa la `-O` mayúscula:
`wget -O file.html URL`.

## SSH: iniciar sesión en otro ordenador

**SSH** (*Secure Shell*) es la forma habitual de controlar un ordenador con
Linux a distancia, y todo lo que se envía va cifrado. El servidor ejecuta el
servicio `sshd` en el puerto 22, y tú te conectas con el cliente `ssh`:

```sh
ssh {{user}}@server.lan hostname
```

`{{user}}@server.lan` significa «el usuario {{user}} en el ordenador server.lan».
El comando que va después del host (`hostname`) se ejecuta en el servidor y
la respuesta se muestra aquí: pone `server`, no `ubuntu`.

La primera vez que te conectas a un ordenador, ssh te pregunta si confías en
él:

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Escribe `yes` (la palabra entera). La **clave de host** del servidor se guarda
entonces en `~/.ssh/known_hosts`. Si la clave cambia más adelante, ssh avisa a
lo grande: podría significar que alguien se está haciendo pasar por el
servidor.

El comando pueden ser varios comandos entre comillas:

```sh
ssh {{user}}@server.lan 'whoami; uptime; ls'
ssh {{user}}@server.lan cat {{welcomeFile}}
```

Sin ningún comando, ssh inicia sesión y obtienes un shell en el otro
ordenador, del que sales con `exit`. Eso no está soportado en el simulador:
ahí siempre escribes el comando justo después del host.

### Claves en lugar de contraseñas

En lugar de una contraseña, puedes iniciar sesión con un **par de claves**. La
clave privada se queda contigo, y la pública se coloca en el servidor:

```sh
ssh-keygen
ssh-copy-id {{user}}@server.lan
```

Pulsa Intro en las preguntas de `ssh-keygen` para usar el archivo por defecto
`~/.ssh/id_ed25519` sin frase de contraseña. `ssh-copy-id` añade la clave
pública (`id_ed25519.pub`) a `~/.ssh/authorized_keys` en el servidor. A partir
de ahí, ssh ya no te pide contraseña. ¡No le enseñes nunca la clave privada a
nadie!

Copiar archivos por SSH con `scp` y `rsync`, y dar nombres cortos a los
servidores en `~/.ssh/config`, lo verás en el próximo capítulo.

## Cuando la red no funciona

«Internet no funciona» puede tener muchas causas. Recorre los pasos en orden,
de dentro hacia fuera: el primer paso que falle muestra dónde está el
problema:

| Paso | Comando | Si falla |
|---|---|---|
| 1. ¿Tengo dirección? | `ip a` | La tarjeta está desactivada (`state DOWN`) o no ha obtenido dirección |
| 2. ¿Hay camino hacia fuera? | `ip route` | No hay línea `default`: no hay puerta de enlace |
| 3. ¿Llego al router? | `ping -c 3 192.168.1.1` | Problema en la red local (cable, wifi) |
| 4. ¿Llego a internet? | `ping -c 3 1.1.1.1` | Problema en el router o en el proveedor |
| 5. ¿Funciona el DNS? | `ping -c 3 example.com` | Fallan las búsquedas de nombres: revisa `/etc/resolv.conf` |

El paso 4 hace ping directamente a una dirección, sin ningún nombre. Si el
paso 4 funciona pero el 5 no, casi siempre es el DNS lo que está roto: uno de
los problemas más habituales.

```quiz
`ping -c 3 1.1.1.1` funciona, pero `ping -c 3 example.com` responde
*Name or service not known*. ¿Dónde está probablemente el problema?
- [ ] La tarjeta de red está desactivada
- [ ] No hay ruta por defecto
- [x] En el DNS: las búsquedas de nombres no funcionan
- [ ] example.com no responde al ping
---
Si llegas a una dirección de internet, la tarjeta, la ruta y el router
funcionan. Lo que queda es traducir el nombre: revisa
`/etc/resolv.conf`.
```

¡Pruébalo tú mismo! Desactiva la tarjeta de red, recorre los pasos y luego
vuelve a activarla:

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## Los paquetes

Las herramientas de red están en distintos paquetes. En Ubuntu se llaman:

| Herramienta | Paquete en Ubuntu |
|---|---|
| `ip`, `ss` | `iproute2` |
| `ping` | `iputils-ping` |
| `dig`, `host`, `nslookup` | `dnsutils` |
| `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` |

Como de costumbre, otras familias llaman de otra forma a algunos de los
paquetes: de esas diferencias trata la parte sobre distribuciones y paquetes.

`traceroute` muestra cada router por el que pasan los paquetes por el camino.
¡Instálalo y prueba `traceroute example.com`!

## Resumen

| Comando | Hace |
|---|---|
| `ip a` | Mostrar las direcciones IP |
| `ip route` | Mostrar la tabla de rutas y la puerta de enlace |
| `ping -c 3 HOST` | Comprobar si se puede alcanzar un ordenador |
| `dig +short NOMBRE` | Buscar un nombre en el DNS |
| `getent hosts NOMBRE` | Buscar como lo hace el sistema (con `/etc/hosts`) |
| `ss -tulpn` | Mostrar los puertos a la escucha |
| `curl URL` | Descargar y mostrar |
| `curl -o ARCHIVO URL`, `wget URL` | Descargar a un archivo |
| `ssh USUARIO@HOST COMANDO` | Ejecutar un comando en otro ordenador |
