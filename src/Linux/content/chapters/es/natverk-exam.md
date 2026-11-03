# Examen: Redes

Demuestra lo que has aprendido sobre direcciones, nombres, puertos, la web y
SSH. Las preguntas abarcan toda la parte, y necesitas un 80 % de aciertos para
aprobar.

```quiz
¿Cuáles de estas direcciones son **privadas**, es decir, solo se usan dentro de
redes locales? (Elige todas las correctas).
- [x] `10.0.0.5`
- [x] `172.20.1.1`
- [x] `192.168.0.7`
- [ ] `8.8.8.8`
- [ ] `1.1.1.1`
```

```quiz
Un servidor web que estás desarrollando se ejecuta en tu propio ordenador.
¿Adónde va el tráfico cuando lo pruebas en `http://localhost:8080`?
- [ ] Sale al router y vuelve
- [x] A ninguna parte: el tráfico a localhost nunca sale del ordenador
- [ ] Al servidor DNS, que lo devuelve
- [ ] A `192.168.1.1`
```

```try
ip route
---
La línea `default` muestra la puerta de enlace a la que se envía todo lo
demás.
```

La línea de `localhost` en `/etc/hosts` es lo que encuentra el sistema. ¿Qué
muestra esto?

```predict
$ getent hosts localhost
127.0.0.1 localhost
```

¿A qué servidor DNS pregunta Ubuntu, según `/etc/resolv.conf`?

```predict
$ grep nameserver /etc/resolv.conf
nameserver 127.0.0.53
---
`127.0.0.53` es systemd-resolved, un intermediario local en tu propio
ordenador que a su vez pregunta al router.
```

```quiz
Ejecutas `ping 192.168.1.1` sin ninguna opción. ¿Cuándo se detiene?
- [ ] Después de 3 paquetes
- [ ] Después de un paquete
- [x] Cuando pulsas Ctrl+C
- [ ] Cuando llega la primera respuesta
---
Con `-c` eliges cuántos paquetes enviar.
```

El orden en que el sistema busca los nombres se fija en
`/etc/nsswitch.conf`. ¿Qué muestra esto?

```predict
$ grep hosts: /etc/nsswitch.conf
hosts: files dns
---
Primero el archivo (`/etc/hosts`), luego el DNS.
```

```quiz
Has añadido `server.lan` a `/etc/hosts`. `ping server.lan` funciona, pero
`dig +short server.lan` no muestra nada. ¿Por qué?
- [ ] La línea de `/etc/hosts` está mal
- [x] `dig` pregunta directamente al DNS e ignora `/etc/hosts`
- [ ] `dig` necesita `sudo`
- [ ] `ping` no usa nombres
---
Para ver lo que resuelve el *sistema*, usa `getent hosts server.lan`.
```

```quiz
`myserver` escucha en el puerto 8080 y se ejecuta como un usuario normal.
¿Qué cambiaría si escuchara en el puerto 80?
- [ ] Nada
- [x] Solo root puede abrir puertos por debajo de 1024
- [ ] El puerto 80 es solo para SSH
- [ ] El puerto 80 no se puede usar en localhost
```

```quiz
`curl -I http://linux.org` responde `301 Moved Permanently`. ¿Cómo obtienes
la página de verdad?
- [ ] `curl -s http://linux.org`
- [x] `curl -L http://linux.org`: siguiendo la redirección
- [ ] `curl -o http://linux.org`
- [ ] No se puede: 301 significa que la página ya no existe
```

```quiz
Te conectas a `server.lan` con ssh, y ssh avisa a gritos de que la clave de
host del servidor ha cambiado. ¿Qué podría significar?
- [ ] Tu contraseña ha caducado
- [x] Alguien podría estar haciéndose pasar por el servidor
- [ ] El servidor tiene un usuario nuevo
- [ ] Tu par de claves está roto
---
La clave de host se guardó en `~/.ssh/known_hosts` la primera vez que te
conectaste.
```

```quiz
Quieres iniciar sesión en el servidor con un par de claves en lugar de una
contraseña. ¿Qué clave se pone en el servidor?
- [x] La clave pública, `id_ed25519.pub`
- [ ] La clave privada, `id_ed25519`
- [ ] Las dos
- [ ] Ninguna: el servidor crea la suya propia
---
`ssh-copy-id` añade la clave pública a `~/.ssh/authorized_keys` en el
servidor. ¡No le enseñes nunca la clave privada a nadie!
```

```quiz
`ip a` muestra una dirección, y puedes hacer ping a otros ordenadores de
`192.168.1.0/24`, pero no a nada de internet. `ip route` no tiene ninguna
línea `default`. ¿Qué falla?
- [ ] El DNS
- [x] No hay puerta de enlace: nada sabe adónde enviar el tráfico fuera de la red local
- [ ] La tarjeta de red está apagada
- [ ] Falta `/etc/hosts`
```

```quiz
Quieres que `/tmp/x` contenga los archivos que hay en `{{documents}}`, no un directorio `{{documents}}`. ¿Qué comando es el correcto?
- [ ] `rsync -a {{documents}} /tmp/x`
- [x] `rsync -a {{documents}}/ /tmp/x`
- [ ] `scp {{documents}} /tmp/x`
---
La barra al final del origen significa «lo que hay en el directorio».
```
