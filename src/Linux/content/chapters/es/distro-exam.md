# Examen: Distribuciones y paquetes

Responde las preguntas de abajo. Necesitas un 80 % para aprobar.

```quiz
¿Qué archivo te dice el nombre y la versión de la distribución en todas las
distribuciones modernas?
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
`uname -r` muestra la versión del núcleo Linux.
```

```quiz
¿Qué gestor de paquetes y formato de paquete van juntos?
- [x] `pacman` y `.pkg.tar.zst`
- [ ] `dnf` y `.deb`
- [ ] `apt` y `.rpm`
```

```quiz
¿Qué distribución es una *rolling release* sin versiones?
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
¿Cuál es la diferencia entre `apt update` y `apt upgrade`?
- [x] `update` descarga la lista de paquetes disponibles, `upgrade` instala las versiones nuevas
- [ ] `update` instala las versiones nuevas, `upgrade` descarga la lista
- [ ] No hay ninguna diferencia
```

```quiz
¿Qué comando instala el paquete `htop` en Arch?
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
¿Por qué es mala idea ejecutar `pacman -Sy` y después `pacman -S paquete`?
- [ ] Instala el paquete dos veces
- [x] Es una actualización parcial que puede romper el sistema
- [ ] `-Sy` desinstala todos los paquetes instalados
```

```quiz
dnf pregunta `Is this ok [y/N]` y tú solo pulsas Intro. ¿Qué pasa?
- [ ] Se instala el paquete
- [x] No se instala nada: No es la respuesta por defecto
```

```quiz
¿Cuáles de estas afirmaciones sobre el AUR son ciertas?
- [x] Contiene recetas de compilación (`PKGBUILD`), no paquetes ya hechos
- [x] Arch no revisa sus paquetes
- [ ] `sudo pacman -Syu` actualiza los paquetes del AUR
- [ ] `makepkg` debe ejecutarse con sudo
```

```quiz
¿Qué comando añade un repositorio COPR en Fedora?
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` y `makepkg -si`
```

```quiz
¿Cómo se actualizan los paquetes Snap?
- [ ] Con `flatpak update`
- [x] Automáticamente, en segundo plano
- [ ] Descargando un archivo nuevo del sitio web del desarrollador
```

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
Un archivo descargado nunca es ejecutable de entrada. Ejecuta primero
`chmod +x ~/{{downloads}}/{{calculator}}`.
```

```quiz
Quieres una versión más nueva de un programa de escritorio que no está en los
repositorios de la distribución. ¿Qué recomienda primero la regla general?
- [ ] Un repositorio adicional de alguien a quien no conoces
- [x] Un Flatpak
- [ ] Compilar el programa desde el código fuente como root
```
