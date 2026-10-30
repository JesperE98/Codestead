# La familia Debian: apt y PPA

Debian, Ubuntu y las distribuciones basadas en ellas, como Linux Mint, forman
la **familia Debian**. Todas usan el gestor de paquetes **apt** y paquetes en
formato `.deb`. Este capítulo se ejecuta siempre en una distribución de la
familia Debian; ahora mismo es **{{distro}}**. Puedes cambiar entre Ubuntu y
Debian en el menú de la parte superior.

## apt en resumen

| Qué | Comando |
|---|---|
| Refrescar la lista de paquetes | `apt update` |
| Actualizar todo | `apt upgrade` |
| Instalar | `apt install X` |
| Desinstalar | `apt remove X` |
| Buscar | `apt search X` |
| Información del paquete | `apt show X` |
| Listar los instalados | `apt list --installed` |

Los comandos que modifican el sistema requieren root, así que se ejecutan con
`sudo`.

```quiz
¿Cuáles de estos comandos modifican el sistema y, por tanto, necesitan `sudo`?
- [x] `apt install htop`
- [ ] `apt search htop`
- [x] `apt remove htop`
- [ ] `apt show htop`
---
Buscar y mostrar información solo leen las listas de paquetes. Instalar y
desinstalar modifican el sistema.
```

## update y upgrade son cosas distintas

Esto confunde a casi todo el mundo al principio:

- `apt update` descarga la **lista** de paquetes y versiones disponibles. No
  instala nada.
- `apt upgrade` **instala** las versiones nuevas de lo que ya tienes.

Así que ejecuta siempre `update` primero. La forma más habitual de actualizar
el sistema es:

```sh
sudo apt update && sudo apt upgrade
```

Antes de ejecutar `apt update` (por ejemplo, en un servidor recién instalado),
la lista de paquetes está vacía y apt no encuentra ningún paquete.

```quiz
¿Qué hace `sudo apt update`?
- [x] Descarga la lista de paquetes y versiones disponibles
- [ ] Instala las versiones nuevas de los paquetes que ya tienes
- [ ] Actualiza el propio apt a la última versión
---
`apt update` solo refresca la lista. Es `apt upgrade` el que instala las
versiones nuevas.
```

## Instalar y desinstalar

```sh
sudo apt install htop
```

`apt remove` desinstala un programa, pero deja sus archivos de configuración.
`apt purge` también los elimina. Cuando apt pregunta
`Do you want to continue? [Y/n]`, la `Y` mayúscula significa que con solo
pulsar Enter respondes que sí. Con la opción `-y`, apt responde que sí
automáticamente.

Buscar no requiere root. Pruébalo:

```try
apt search htop
```

### ¿apt o apt-get?

`apt` es la variante moderna y fácil de usar, con barra de progreso y colores.
`apt-get` y `apt-cache` son más antiguos, pero su salida es más estable, por
eso se siguen usando en scripts.

### Por debajo: dpkg y .deb

Los paquetes son archivos `.deb`, y en realidad es el programa `dpkg` el que
los desempaqueta. apt se encarga de todo lo demás: la descarga, las
dependencias y las actualizaciones.

## Repositorios adicionales: cómodos, pero bajo tu propia responsabilidad

Los repositorios de la distribución contienen decenas de miles de paquetes,
pero no todo. Puede que un programa de nicho no esté, o que solo esté en una
versión antigua. Por eso existen los **repositorios adicionales**, donde
desarrolladores y usuarios comparten sus propios paquetes.

Los paquetes de los repositorios propios de la distribución se prueban juntos,
están firmados y los revisan los desarrolladores de la distribución. Un
repositorio adicional, en cambio, lo puede crear cualquiera. Tenlo en cuenta
antes de añadir uno:

- **Los paquetes se instalan como root.** Un paquete puede hacerle cualquier
  cosa al ordenador. Confías en quien lo ha creado tanto como en la
  distribución.
- **Puede haber choques.** Un paquete de un repositorio adicional puede
  sustituir bibliotecas del propio sistema o necesitar otras versiones de las
  que tienes.
- **Puede dejar de actualizarse.** Si quien mantiene el repositorio pierde el
  interés, ya no recibirás actualizaciones de seguridad del programa.

Una buena regla práctica: busca primero en los repositorios de la
distribución, después un Flatpak (en el capítulo sobre paquetes universales)
y, solo después, en un repositorio adicional de alguien de confianza.

## PPA

Un **PPA** (*Personal Package Archive*) es un pequeño repositorio en
Launchpad, el servicio de Canonical para Ubuntu. El desarrollador sube el
código fuente y Launchpad compila paquetes `.deb` para distintas versiones de
Ubuntu. Un PPA se escribe `ppa:usuario/nombre`. Los PPA no los revisa la
distribución.

En el resto de este capítulo instalas un programa inventado, `moonphase`
(muestra la fase de la luna en la terminal), desde un PPA.

### La herramienta add-apt-repository

Los PPA se añaden con `add-apt-repository`, que está en el paquete
`software-properties-common`. Viene preinstalado en Ubuntu, pero no en Debian:

```sh
sudo apt update
sudo apt install software-properties-common
```

### Añadir el PPA

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

Verás qué se añade y una descripción del PPA. Pulsa Enter para continuar (con
`-y` te saltas la pregunta). Pasan dos cosas:

1. Se crea un archivo en `/etc/apt/sources.list.d/`. Indica dónde está el
   repositorio y contiene la clave con la que se firman los paquetes.
2. `add-apt-repository` ejecuta `apt update` por ti; si no, apt no sabría
   nada de los paquetes nuevos. Si añades una fuente a mano (creando un
   archivo), tienes que ejecutar tú mismo `sudo apt update` después.

```quiz
Añades un repositorio a mano, creando un archivo en
`/etc/apt/sources.list.d/`. ¿Qué tienes que hacer antes de que apt pueda
instalar paquetes desde él?
- [ ] Nada: apt lee el archivo por sí solo la próxima vez que instales algo
- [x] Ejecutar `sudo apt update`
- [ ] Reiniciar el ordenador
---
`add-apt-repository` ejecuta `apt update` por ti. Cuando creas el archivo tú
mismo, también tienes que hacerlo tú.
```

Mira el archivo:

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

Fíjate en `Suites: noble`: los paquetes están compilados para Ubuntu 24.04.

### Instalar y ejecutar

Ahora el paquete se instala como cualquier otro:

```sh
sudo apt install moonphase
moonphase
```

### ¿De dónde viene el paquete?

`apt policy` muestra en qué repositorios está un paquete y cuál gana:

```sh
apt policy moonphase
```

`***` marca la versión instalada. El número `500` es la prioridad del
repositorio y `100` significa «lo que ya está instalado». Si el mismo paquete
está en varios repositorios, apt elige la versión más alta, así que un PPA
puede sustituir uno de los paquetes propios de la distribución por su propia
versión.

```quiz
El mismo paquete está tanto en el repositorio de la distribución como en un
PPA que has añadido. ¿Qué versión elige apt?
- [ ] Siempre la del repositorio de la distribución
- [ ] La del repositorio que se añadió en último lugar
- [x] La versión más alta
---
Por eso un PPA puede sustituir uno de los paquetes propios de la distribución.
```

### ¿PPA en Debian?

Los PPA se compilan para Ubuntu, no para Debian. En Debian puede que
funcionen, pero los paquetes pueden necesitar otras versiones de bibliotecas
que las que tiene Debian. A una mezcla de paquetes de Debian y Ubuntu se la
llama en broma *FrankenDebian*, y es una forma habitual de romper el sistema.
En Debian es mejor usar los *backports*, un Flatpak o el repositorio propio
del desarrollador para Debian.

### Actualizaciones y eliminar un PPA

Los paquetes de un PPA se actualizan junto con todo lo demás, con
`sudo apt update && sudo apt upgrade`. Para eliminar el PPA:

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

El programa se queda, pero ya no recibe actualizaciones. Para quitarlo del
todo, ejecuta también `sudo apt remove moonphase`.

Cada repositorio que añades es un remitente más en el que confías. Mantén la
lista corta y elimina lo que ya no uses.
