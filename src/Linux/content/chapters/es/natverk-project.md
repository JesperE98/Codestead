# Proyecto: ¡La web se ha caído!

Viernes, 16:47. Suena tu teléfono. Es tu jefa, sin aliento: «¡La web se ha
caído! Los clientes no ven nuestro horario, ¡y el mismo cliente ya ha llamado
tres veces!».

La web de la empresa es el pequeño servidor web `myserver` en el puerto 8080…
en *tu* ordenador. Sí, de verdad. Alguien lo puso ahí «temporalmente» hace años,
y desde entonces nadie se ha atrevido a moverlo.

¿Es la red? ¿El servidor web? ¿O el portátil de tu jefa? Averígualo de dentro
hacia fuera, apúntalo todo en un registro de incidencias y procura que la próxima
vez sea más fácil. Todo lo que necesitas está en *Redes*; el reto es juntar las
piezas por tu cuenta.

## La misión

1. **Empieza el registro.** Crea la carpeta `~/{{incidentDir}}` con el registro
   de incidencias `{{incidentLog}}`, y escribe en él la dirección IP del ordenador
   y la dirección de la puerta de enlace.
2. **El camino hacia fuera.** Demuestra que la red funciona hasta llegar a
   internet, resolución de nombres incluida: añade al registro un ping de tres
   paquetes a un nombre de internet.
3. **¿Hay alguien escuchando?** Averigua si hay algo escuchando en el puerto 8080.
   Si no lo hay, arranca el servidor web y vuelve a comprobarlo.
4. **¿Responde la web?** Añade al registro las cabeceras de respuesta de la
   página de inicio, `http://localhost:8080`. El código de estado debe ser 200.
5. **Una clave para el servidor.** La próxima vez quieres entrar en el servidor
   `server.lan` sin contraseña. Crea un par de claves y pon la clave pública en
   el servidor.
6. **Copia de seguridad.** Copia toda la carpeta `~/{{incidentDir}}` a tu
   directorio personal del servidor, para que el registro siga ahí aunque tu
   propio ordenador se rinda.
7. **Léelo a distancia.** Muestra con `ssh` el registro que está en el servidor,
   sin que nadie te pida una contraseña.

Los hitos de la lista junto a este texto se comprueban automáticamente cuando ejecutas
tus comandos.

## Consejos por el camino

- `>` crea (o sobrescribe) un archivo y `>>` añade al final: empieza el registro
  con `>` y después usa siempre `>>`.
- Ve de dentro hacia fuera: dirección, ruta, router, internet y, por último, un
  nombre. Sin `-c`, `ping` sigue hasta que lo pares.
- `ss -tulpn` muestra los puertos que escuchan. La columna *Process* está vacía
  para los procesos de otros usuarios; aquí lo que cuenta es el puerto.
- En Ubuntu `curl` no viene preinstalado: `sudo apt update` y
  `sudo apt install curl`. `-I` descarga solo las cabeceras.
- El nombre corto `srv` de `~/.ssh/config` funciona en todas partes, igual que
  `{{user}}@server.lan` y `{{user}}@192.168.1.10`.
- `rsync -av ORIGEN/ srv:DESTINO/`: la barra después del origen significa «lo
  que hay en el directorio».
- ¿`ssh` sigue pidiendo contraseña? Entonces la clave todavía no está en el
  servidor.

## ¿Quieres hacer más?

Cuando termines los hitos, puedes seguir. Apaga la tarjeta de red con
`sudo ip link set enp0s3 down`, mira dónde se rompe la cadena de dentro hacia
fuera y vuelve a encenderla con `up`. Descarga la página `/about.html` de la web
con `curl`. Añade una línea al registro y vuelve a ejecutar el mismo
`rsync -av`: solo se envía el cambio. Y devuélvele la llamada a tu jefa. (Dicen
las malas lenguas que su portátil estaba en modo avión.)
