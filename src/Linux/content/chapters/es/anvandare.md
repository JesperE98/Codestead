# Usuarios y grupos

Linux se diseñó desde el principio para que muchas personas compartieran el
mismo ordenador al mismo tiempo. Cada archivo tiene un propietario y cada
programa se ejecuta como un usuario concreto; por eso crear, modificar y
eliminar cuentas es una de las tareas más importantes de un administrador. En
este capítulo crearás el usuario `kim`, le darás a la cuenta una contraseña y
permisos de sudo, y aprenderás dónde se guarda todo.

## Usuarios y UID

Ya sabes cómo averiguar quién eres:

```sh
whoami
id
```

`id` muestra que no solo tienes un nombre, sino también un número:
`uid=1000`. Es el **UID** (*user ID*), y es el número, no el nombre, lo que
controla el kernel. El nombre solo está ahí para que los humanos no tengamos
que recordar números. Algunos números importantes:

| UID | Quién |
|---|---|
| `0` | **root**, el administrador. Quien tiene el UID 0 puede hacer cualquier cosa. |
| `1`–`999` | **Usuarios del sistema** para servicios y programas |
| `1000` en adelante | **Usuarios normales**: personas. El primero recibe el 1000. |

## La lista de usuarios – `/etc/passwd`

Todos los usuarios están en el archivo de texto `/etc/passwd`, una línea por
usuario:

```sh
cat /etc/passwd
```

Cada línea tiene siete campos separados por dos puntos. Mira tu propia línea:

```sh
grep {{user}} /etc/passwd
```

```text
{{user}}:x:1000:1000:{{userFull}},,,:/home/{{user}}:/bin/bash
  1    2  3    4      5           6           7
```

| Campo | Significado |
|---|---|
| 1 | El nombre de usuario |
| 2 | `x`: la contraseña está en `/etc/shadow` (ver más abajo) |
| 3 | UID |
| 4 | GID: el número del **grupo principal** del usuario |
| 5 | Comentario, normalmente el nombre completo |
| 6 | El directorio personal |
| 7 | El shell que se inicia cuando el usuario inicia sesión |

El comando `getent` hace la misma búsqueda. La diferencia es que también
encuentra usuarios que no están en el archivo, por ejemplo en un colegio o una
empresa donde las cuentas están en un servidor central:

```sh
getent passwd {{user}}
```

### Usuarios del sistema

La mayoría de las líneas de `/etc/passwd` no son personas. Servicios como el
servidor web y el sistema de logs se ejecutan como usuarios propios con los
mínimos permisos posibles: si alguien los ataca, no puede llegar a tus
archivos. Tienen el shell `nologin`, así que nadie puede iniciar sesión como
ellos. En Ubuntu, el usuario del servidor web se llama `www-data` (los
nombres de los usuarios del sistema varían entre distribuciones):

```sh
grep www-data /etc/passwd
```

Con `awk`, del capítulo de procesamiento de texto, puedes listar a todos los
que tienen UID 1000 o más, es decir, los usuarios normales:

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

También aparece `nobody` (UID 65534). Es un usuario especial que no es dueño de
«nada» y que se usa cuando un programa debe tener los mínimos permisos
posibles.

```predict
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
---
El campo 3 es el UID, y solo root tiene el UID 0. Es el número, no el nombre,
lo que le da a root sus poderes.
```

## Grupos y GID

Un **grupo** es una forma de dar los mismos permisos a varios usuarios, por
ejemplo sobre un directorio de proyecto compartido. Los grupos están en
`/etc/group`:

```sh
cat /etc/group
```

```text
sudo:x:27:{{user}}
 1   2  3   4
```

Los campos son el nombre del grupo, `x`, el número del grupo (**GID**) y una
lista de miembros separados por comas.

Cada usuario tiene **un grupo principal** (el campo GID de `/etc/passwd`) y
además puede ser miembro de cualquier número de **grupos secundarios**. Los
archivos nuevos que creas reciben tu grupo principal. En la mayoría de las
distribuciones, cada usuario recibe un grupo principal privado con el mismo
nombre: `{{user}}` está en el grupo `{{user}}`.

```sh
groups
id
```

```quiz
Tú (`{{user}}`) estás en los grupos `{{user}}` y `sudo`, y tu grupo principal es
`{{user}}`. ¿Qué grupo recibe un archivo nuevo que creas?
- [x] `{{user}}`
- [ ] `sudo`
- [ ] Los dos
- [ ] `root`
---
Los archivos nuevos reciben tu grupo **principal**: el campo GID de `/etc/passwd`.
Los grupos secundarios como `sudo` te dan permisos adicionales, pero no acaban
en tus archivos.
```

## Las contraseñas – `/etc/shadow`

Fíjate en la `x` del campo 2 de `/etc/passwd`. Antiguamente, la contraseña
(cifrada) estaba justo ahí. El problema es que `/etc/passwd` **tiene** que ser
legible por todo el mundo: de ahí saca `ls -l` los nombres de los
propietarios. Así que cualquiera podía copiar las contraseñas cifradas e
intentar descifrarlas con toda la calma. Por eso se trasladaron a
`/etc/shadow`, que solo root puede leer:

```sh
ls -l /etc/passwd /etc/shadow
sudo cat /etc/shadow
```

```text
kim:$y$j9T$Tm9...$Kx2...:20756:0:99999:7:::
```

El campo 2 no es la contraseña en sí, sino un **hash**: una «huella» que no se
puede revertir. Cuando inicias sesión, se calcula el hash de lo que has
escrito y se compara con el guardado. `$y$` significa que se usa el método
*yescrypt*. Un `!` o un `*` en su lugar significa que no hay contraseña o que
la cuenta está **bloqueada**. Los demás campos indican cuándo se cambió la
contraseña por última vez y cuándo caduca. `chage` los muestra en texto
legible:

```sh
chage -l {{user}}
```

```try
chage -l {{user}}
---
`Password expires: never`: la contraseña de {{user}} no tiene que cambiarse nunca.
```

## Crear un usuario – `useradd`

Crear usuarios requiere root. El comando más común existe en todas las
distribuciones:

```sh
sudo useradd -m -s /bin/bash kim
```

| Opción | Significado |
|---|---|
| `-m` | Crear el directorio personal `/home/kim` |
| `-s /bin/bash` | El shell del usuario |
| `-c "Kim García"` | El comentario (nombre completo) |
| `-G grupo1,grupo2` | Grupos secundarios desde el principio |

`useradd` busca el siguiente UID libre a partir de 1000: `kim` recibe el 1001.
Los límites están en `/etc/login.defs`. También se crea un grupo `kim`, y los
archivos de `/etc/skel` (*skeleton*, esqueleto) se copian en el nuevo
directorio personal. Pon algo ahí y todos los usuarios nuevos lo recibirán:

```sh
ls -a /etc/skel
```

En Ubuntu, `useradd` es tacaño: sin `-m` **no** se crea ningún directorio
personal, y sin `-s` el shell es `/bin/sh`. Otras distribuciones tienen otros
valores por defecto, así que acostúmbrate a escribir `-m` y `-s`: así el mismo
comando funciona en todas partes.

Por eso Ubuntu tiene además el script más amable `adduser`, propio de la
familia Debian. Crea el directorio personal, elige bash y pregunta por la
contraseña y el nombre:

```sh
sudo adduser lisa
```

Responde a las preguntas; en la mayoría puedes pulsar Intro. `adduser` también
puede añadir un usuario existente a un grupo: `sudo adduser lisa sudo`.

`useradd`, `passwd` y los demás comandos de este capítulo siempre están
instalados. En Ubuntu vienen en el paquete `passwd`; otras familias llaman al
paquete de otra forma.

## Establecer una contraseña – `passwd`

Una cuenta nueva no tiene contraseña (`!` en `/etc/shadow`), así que nadie
puede iniciar sesión con ella. Pon una con `passwd`:

```sh
sudo passwd kim
```

Escribes la contraseña dos veces. **Lo que escribes no se muestra**: ni
asteriscos ni nada. Es a propósito: alguien que mire por encima de tu hombro
no debería ver ni siquiera lo larga que es la contraseña. Escríbela y pulsa
Intro.

`passwd` sin nombre cambia tu propia contraseña. Solo root puede cambiar las
contraseñas de otros usuarios; pruébalo sin sudo:

```sh
passwd root
```

## Grupos – `groupadd`, `usermod -aG` y `gpasswd`

Crea un grupo y añade un miembro:

```sh
sudo groupadd {{devGroup}}
sudo usermod -aG {{devGroup}} kim
groups kim
```

`-aG` significa *append to Groups* (añadir a los grupos). **¡No olvides la
`-a`!** Con solo `-G`, la lista de grupos secundarios pasa a ser exactamente lo
que escribes, y el usuario sale de todos los demás grupos, como el grupo de
sudo. Una forma habitual de dejarse a uno mismo fuera.

```quiz
`kim` está en los grupos secundarios `sudo` y `{{devGroup}}`. Un administrador
ejecuta `sudo usermod -G backup kim`. ¿En qué grupos secundarios está kim
después?
- [ ] `sudo`, `{{devGroup}}` y `backup`
- [x] Solo en `backup`
- [ ] `sudo` y `{{devGroup}}`: el comando falla sin `-a`
- [ ] En ninguno
---
Sin `-a`, la lista pasa a ser exactamente lo que escribes. Con
`sudo usermod -aG backup kim`, kim habría conservado los demás grupos.
```

`gpasswd` hace lo mismo y además puede quitar miembros:

```sh
sudo gpasswd -a kim {{devGroup}}
sudo gpasswd -d kim {{devGroup}}
```

En un ordenador real, la pertenencia a un grupo nuevo solo tiene efecto la
próxima vez que el usuario inicia sesión. El simulador es más amable: aquí se
aplica al instante.

Los grupos se usan para directorios compartidos. Haz que el grupo sea el
propietario y dale permiso de escritura con `chgrp` y `chmod`:

```sh
sudo mkdir /srv/proyecto
sudo chgrp {{devGroup}} /srv/proyecto
sudo chmod 775 /srv/proyecto
ls -ld /srv/proyecto
```

## Dar permisos de sudo – el grupo `sudo`

Quién puede usar `sudo` se decide en `/etc/sudoers`:

```sh
sudo cat /etc/sudoers
```

La línea `%sudo ALL=(ALL:ALL) ALL` significa que todos los del grupo **sudo**
pueden ejecutar cualquier comando como root. Así que dar a alguien permisos de
sudo no es más que añadirlo al grupo correcto; en Ubuntu, el grupo `sudo`:

```sh
sudo usermod -aG sudo kim
```

El grupo tiene nombres distintos en cada familia: en Arch y Fedora se llama
`wheel`, un antiguo nombre de Unix para «los que mandan» (*big wheel*, «pez
gordo»).

No edites nunca `/etc/sudoers` directamente con un editor normal: una errata
puede hacer que nadie pueda volver a usar sudo. Usa `visudo`, que comprueba el
archivo antes de guardarlo. Normalmente, con los grupos tienes de sobra.

## Cambiar de usuario – `su` y `sudo -u`

Hay dos formas de convertirse en otra persona:

| Comando | ¿La contraseña de quién? | Qué pasa |
|---|---|---|
| `su - kim` | **la de kim** | Tienes la sesión iniciada como kim hasta que escribas `exit` |
| `sudo -u kim comando` | **la tuya** (necesitas permisos de sudo) | Un único comando se ejecuta como kim |
| `sudo -iu kim` | la tuya | Un shell de inicio de sesión como kim |

```sh
sudo -u kim whoami
```

Con `su` cambias de verdad. El guion (`-`) hace que sea un inicio de sesión:
acabas en el directorio personal de kim con la configuración de kim. El prompt
muestra quién eres, y `exit` te devuelve:

```sh
su - kim
```

`su` sin nombre significa root. En Ubuntu, root no tiene contraseña, así que
`su -` no funciona allí: usa `sudo -i`.

```quiz
Quieres ejecutar un solo comando como `kim`, pero no sabes la contraseña de
kim. Sí tienes permisos de sudo. ¿Qué funciona?
- [ ] `su - kim`
- [x] `sudo -u kim comando`
- [ ] `su kim comando`
- [ ] Nada: necesitas la contraseña de kim
---
`su` pide la contraseña del usuario en el que te conviertes. `sudo` pide **tu
propia** contraseña y comprueba en `/etc/sudoers` que puedes hacerlo.
```

## Bloquear y eliminar cuentas

Una cuenta que no se va a usar durante un tiempo se puede **bloquear**.
`usermod -L` pone un `!` delante del hash en `/etc/shadow`, de modo que ya no
coincide ninguna contraseña. `-U` la desbloquea:

```sh
sudo usermod -L kim
sudo passwd -S kim
sudo usermod -U kim
```

`passwd -S` muestra el estado: `P` (tiene contraseña), `L` (bloqueada) o `NP`
(sin contraseña). Con `chage -E` se puede hacer que una cuenta caduque en una
fecha concreta: práctico para trabajadores de verano y sustitutos.

Antes de eliminar a alguien, puede venir bien ver quién tiene la sesión
iniciada y cuándo la tuvo alguien por última vez:

```sh
who
last
```

Después, `userdel` elimina el usuario. Con `-r` se va también el directorio
personal; sin `-r`, los archivos se quedan:

```sh
sudo useradd -m {{tempUser}}
sudo userdel -r {{tempUser}}
```

Ubuntu tiene además `deluser`, el equivalente de `adduser`:
`sudo deluser --remove-home {{tempUser}}`. `sudo deluser kim sudo` saca a kim del
grupo sudo.

`userdel` se niega a eliminar a un usuario que tiene la sesión iniciada:
prueba `sudo userdel {{user}}`.

## Resumen

| Comando | Hace |
|---|---|
| `id`, `groups` | Mostrar UID, GID y grupos |
| `useradd -m -s /bin/bash nombre` | Crear un usuario |
| `passwd nombre` | Establecer una contraseña |
| `usermod -aG grupo nombre` | Añadir a un grupo |
| `groupadd grupo` | Crear un grupo |
| `usermod -L` / `-U` | Bloquear / desbloquear |
| `userdel -r nombre` | Eliminar el usuario y su directorio personal |
| `su - nombre`, `sudo -u nombre` | Cambiar de usuario |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` | Donde se guarda todo |
