# Proyecto: El portátil de segunda mano

Tu amigo Alex se ha comprado un portátil de segunda mano y, después de un poco
de persuasión, te ha dejado instalarle {{distro}}. La instalación ha ido bien.
Ahora Alex te ha mandado una lista de deseos:

> 1. Actualizado, por favor. No quiero un ordenador lleno de agujeros.
> 2. La semana que viene empiezo un curso del lenguaje de programación Go.
> 3. Algo que muestre qué hace que el ordenador vaya lento.
> 4. Un editor de verdad. Todo el mundo dice Vim.
> 5. ¡Películas! Tiene que poder reproducir películas.

Todo lo que necesitas lo tienes de *Distribuciones y paquetes*. Aquí no hay nada
nuevo; el reto es encontrar por tu cuenta los comandos correctos del gestor de
paquetes y los nombres correctos de los paquetes.

## La misión

1. **Pon el ordenador al día.** Descarga las listas de paquetes más recientes y
   actualiza todos los paquetes instalados.
2. **Encuentra Go.** Busca en las listas de paquetes cómo se llama en tu
   distribución el paquete del lenguaje Go. ¡No se llama igual en todas partes!
3. **Instala la lista de deseos.** El visor de procesos `htop`, el lenguaje de
   programación Go y el editor de texto Vim.
4. **Compruébalo.** Busca Go en la lista de paquetes *instalados*.
5. **Quita Vim.** Alex probó Vim y no encontró la salida. «¡Quítamelo!»
   Desinstala Vim.
6. **Películas.** Instala el reproductor multimedia VLC (`org.videolan.VLC`) como
   Flatpak desde Flathub.
7. **Prueba final.** Antes de devolver el portátil: haz que Go muestre su
   versión, para que Alex vea que el curso puede empezar.

Los hitos de la lista junto a este texto se comprueban automáticamente cuando ejecutas
tus comandos. Cuentan por familia: repite el proyecto en una distribución de otra
familia y conocerás un dialecto nuevo.

## Consejos por el camino

:::debian
- En {{distro}} el gestor de paquetes es `apt`. Los comandos que cambian el
  sistema se ejecutan con `sudo`, y `apt update` solo descarga las listas;
  `apt upgrade` instala las versiones nuevas.
:::
:::arch
- En {{distro}} el gestor de paquetes es `pacman`. La letra mayúscula es la
  operación (`-S`, `-R`, `-Q`) y las minúsculas son modificadores. Actualiza
  siempre con `-Syu`.
:::
:::redhat
- En {{distro}} el gestor de paquetes es `dnf`. Recuerda que `[y/N]` significa
  que Intro responde **no**.
:::
- Una búsqueda mira tanto los nombres como las descripciones. Si el resultado es
  largo, ayuda una búsqueda más precisa, o `grep`.
- Los nombres de los paquetes suelen ser iguales en todas partes, pero no
  siempre. Si dudas: busca.
- ¿Falta Flatpak o no conoce Flathub? Instala el paquete `flatpak` y añade
  Flathub con `flatpak remote-add`, como hiciste en el capítulo de los paquetes
  universales.

## ¿Quieres hacer más?

Cuando termines los hitos, Alex tendrá más deseos, claro. Arranca `htop` y mira
qué se está ejecutando. Consulta la información del paquete de Go y averigua
cuánto ocupa. Pregúntale a Flatpak qué permisos tiene VLC. Y si resulta que a
Alex le encanta la terminal después de todo: vuelve a instalar Vim.
