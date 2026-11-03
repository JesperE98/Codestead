# La familia Arch: pacman y el AUR

Arch Linux y las distribuciones basadas en ella, como Manjaro y EndeavourOS,
forman la **familia Arch**. Usan el gestor de paquetes **pacman** y paquetes
en formato `.pkg.tar.zst`. Este capítulo se ejecuta siempre en una
distribución de la familia Arch; ahora mismo es **{{distro}}**.

## pacman en resumen

| Qué | Comando |
|---|---|
| Refrescar la lista de paquetes | `pacman -Sy` |
| Actualizar todo | `pacman -Syu` |
| Instalar | `pacman -S X` |
| Desinstalar | `pacman -R X` |
| Buscar | `pacman -Ss X` |
| Información del paquete | `pacman -Si X` |
| Listar los instalados | `pacman -Q` |

Los comandos que modifican el sistema requieren root, así que se ejecutan con
`sudo`.

pacman usa opciones cortas en las que la **letra mayúscula** es la operación y
las minúsculas son modificadores:

| Opción | Significa |
|---|---|
| `-S` | Sync: instalar desde los repositorios |
| `-R` | Remove: desinstalar |
| `-Q` | Query: consultar los paquetes instalados |
| `y` | Refrescar la base de datos de paquetes |
| `u` | Actualizar todos los paquetes |
| `s` | Buscar (con -S y -Q), o eliminar dependencias (con -R) |
| `i` | Información |

```quiz
¿Qué significa la `Q` mayúscula de `pacman -Q`?
- [ ] Quit: detener pacman
- [x] Query: consultar los paquetes instalados
- [ ] Quick: instalar sin preguntar
---
`-Q` consulta lo que está instalado, `-S` instala desde los repositorios y
`-R` desinstala.
```

Buscar no requiere root. Pruébalo:

```try
pacman -Ss htop
```

## Actualizar el sistema

```sh
sudo pacman -Syu
```

`-Syu` significa: sincronizar (`S`), refrescar la base de datos (`y`) y
actualizar todo (`u`). Arch es una *rolling release*, así que lo ejecutarás a
menudo.

> **¡Importante!** Nunca ejecutes solo `pacman -Sy` seguido de
> `pacman -S paquete`. El paquete nuevo podría necesitar bibliotecas más
> nuevas que las que tienes: es lo que se llama una *actualización parcial*
> (*partial upgrade*), y puede romper el sistema. Usa siempre `-Syu`.

```quiz
¿Por qué no deberías ejecutar `pacman -Sy` y después `pacman -S paquete`?
- [ ] Porque `-Sy` borra la base de datos de paquetes
- [x] El paquete nuevo puede necesitar bibliotecas más nuevas que las que tienes, lo que puede romper el sistema
- [ ] Porque pacman solo puede instalar un paquete al día
---
Actualiza siempre todo a la vez con `-Syu`.
```

## Instalar y desinstalar

```sh
sudo pacman -S htop
```

`pacman -R paquete` desinstala un paquete, y `pacman -Rs paquete` también
elimina las dependencias que ya no necesita nadie.

## El AUR

Los repositorios de la distribución contienen decenas de miles de paquetes,
pero no todo. Puede que un programa de nicho no esté, o que solo esté en una
versión antigua. En la familia Arch, la respuesta es el **AUR** (*Arch User
Repository*).

El AUR es distinto de los repositorios normales: no hay paquetes ya hechos,
solo **recetas de compilación**. Una receta se llama `PKGBUILD` y es un
pequeño script de bash que dice dónde está el código fuente y cómo se compila
el programa. Descargas la receta, compilas tú mismo el paquete y lo instalas
con pacman. El AUR es enorme –casi todo lo que existe para Linux está ahí–,
pero cualquiera puede subir una receta.

```quiz
¿Qué descargas del AUR?
- [ ] Un paquete `.pkg.tar.zst` ya hecho y revisado por Arch
- [x] Una receta de compilación (`PKGBUILD`) con la que compilas tú mismo el paquete
- [ ] Un Flatpak
```

### Bajo tu propia responsabilidad

Los paquetes de los repositorios propios de la distribución se prueban juntos,
están firmados y los revisan los desarrolladores de la distribución. Los
paquetes del AUR no los revisa Arch. Tenlo en cuenta:

- **Los paquetes se instalan como root.** Un paquete puede hacerle cualquier
  cosa al ordenador. Confías en quien ha escrito la receta tanto como en la
  distribución.
- **Puede haber choques.** Un paquete puede sustituir bibliotecas del propio
  sistema o necesitar otras versiones de las que tienes.
- **Puede dejar de actualizarse.** Si quien mantiene la receta pierde el
  interés, ya no recibirás actualizaciones de seguridad del programa.

Una buena regla práctica: busca primero en los repositorios de la
distribución, después un Flatpak (en el capítulo sobre paquetes universales)
y, solo después, en el AUR.

En el resto de este capítulo instalas un programa inventado, `moonphase`
(muestra la fase de la luna en la terminal), desde el AUR.

### Preparativos

Para descargar recetas y compilar paquetes necesitas `git` y `base-devel` (un
compilador, `make`, `fakeroot` y más):

```sh
sudo pacman -S --needed git base-devel
```

`--needed` se salta lo que ya está instalado.

### Descargar la receta

Cada paquete del AUR es un repositorio git propio:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> Si escribes mal el nombre del paquete, git dice *"You appear to have cloned
> an empty repository"* y el directorio queda vacío. ¡El AUR te deja clonar
> cualquier cosa!

### Lee el PKGBUILD, siempre

```sh
less PKGBUILD
```

`PKGBUILD` es un script que se ejecuta en tu ordenador. Comprueba al menos:

- que `source=` descarga desde el sitio web real del programa,
- que `build()` y `package()` solo compilan y copian archivos, y que no, por
  ejemplo, descargan y ejecutan otra cosa (`curl … | sh`),
- que el paquete parece mantenido (fechas, comentarios en aur.archlinux.org).

### Compilar e instalar

```sh
makepkg -si
```

`makepkg` lee `PKGBUILD`, descarga el código fuente, lo compila y lo empaqueta
en un archivo `.pkg.tar.zst`. `-s` instala las dependencias que falten e `-i`
instala el paquete con pacman cuando termina. **No** ejecutes makepkg con
sudo: se niega a ejecutarse como root y usa sudo por su cuenta cuando hace
falta.

```sh
ls
moonphase
```

### Paquetes «foreign»

pacman no sabe nada del AUR. Los paquetes que no vienen de los repositorios se
llaman *foreign* (ajenos) y se listan con:

```sh
pacman -Qm
```

Eso también significa que `sudo pacman -Syu` **no** actualiza los paquetes del
AUR. Tienes que descargar tú la receta nueva (`git pull`) y volver a
compilar, o dejar que lo haga un AUR helper.

```quiz
Has instalado `moonphase` desde el AUR y ejecutas `sudo pacman -Syu`. ¿Se
actualiza `moonphase`?
- [ ] Sí: pacman actualiza todos los paquetes instalados
- [x] No: pacman no sabe nada del AUR
---
Descarga la receta nueva con `git pull` y vuelve a compilar, o usa un AUR helper.
```

### El AUR helper yay

Un AUR helper hace todo esto por ti: busca, descarga, muestra el `PKGBUILD`,
compila e instala. El más habitual es **yay** (otro es *paru*). El propio yay
solo existe en el AUR, así que se instala a mano una vez. El paquete `yay-bin`
viene precompilado y es el más rápido:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

Después, yay se usa de forma muy parecida a pacman, pero sin sudo:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (o simplemente `yay`) actualiza tanto los paquetes de los
repositorios como tus paquetes del AUR. ¡Que sea cómodo no significa que
puedas dejar de leer las recetas!

En el AUR no hay ningún repositorio que eliminar: cada paquete es su propia
receta. Elimina lo que ya no uses.
