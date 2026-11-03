# La familia Red Hat: dnf y COPR

Fedora, Red Hat Enterprise Linux (RHEL) y los clones de RHEL como Rocky Linux
forman la **familia Red Hat**. Usan el gestor de paquetes **dnf** y paquetes
en formato `.rpm`. Este capítulo se ejecuta siempre en una distribución de la
familia Red Hat; ahora mismo es **{{distro}}**.

## dnf en resumen

| Qué | Comando |
|---|---|
| Refrescar la lista de paquetes | `dnf check-update` |
| Actualizar todo | `dnf upgrade` |
| Instalar | `dnf install X` |
| Desinstalar | `dnf remove X` |
| Buscar | `dnf search X` |
| Información del paquete | `dnf info X` |
| Listar los instalados | `dnf list --installed` |

Los comandos que modifican el sistema requieren root, así que se ejecutan con
`sudo`.

## Metadatos automáticos

dnf obtiene por sí solo la información nueva de los paquetes cuando la
necesita, así que no hay un paso aparte como `apt update` en la familia
Debian. Si quieres ver qué actualizaciones hay disponibles, ejecuta:

```sh
dnf check-update
```

`dnf check-update` no requiere root. El código de salida es `100` si hay
actualizaciones, algo útil en scripts. En el simulador hay actualizaciones
pendientes. ¿Qué imprime esto?

```predict
$ dnf check-update > /dev/null; echo $?
100
---
`> /dev/null` oculta la lista, y `$?` es el código de salida del último
comando: `100` significa que hay actualizaciones.
```

## Instalar y desinstalar

```sh
sudo dnf install htop
```

Fíjate en la pregunta `Is this ok [y/N]`. La `N` mayúscula significa que **No**
es la respuesta por defecto: si solo pulsas Enter, la instalación se cancela.
Escribe `y` y pulsa Enter, o usa `-y`.

```quiz
dnf pregunta `Is this ok [y/N]` y tú solo pulsas Enter. ¿Qué ocurre?
- [ ] Se instala el paquete
- [x] Se cancela la instalación
- [ ] dnf vuelve a preguntar
---
La letra mayúscula es la respuesta por defecto. En la familia Debian, apt
pregunta `[Y/n]`, así que allí Enter significa que sí.
```

`dnf remove paquete` vuelve a desinstalar un paquete.

## Actualizar el sistema

```sh
sudo dnf upgrade
```

## Por debajo: rpm

Los paquetes son archivos `.rpm` y la herramienta de bajo nivel se llama
`rpm`. dnf sustituyó al antiguo `yum`, y Fedora 41 trajo la nueva versión
**dnf5**, que es bastante más rápida. En RHEL, Rocky y AlmaLinux el comando
también se llama `dnf`.

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

## COPR

**COPR** (*Cool Other Package Repo*) es el servicio de compilación de Fedora.
Cualquiera con una cuenta de Fedora puede compilar paquetes `.rpm` allí, y cada
proyecto se convierte en un repositorio propio llamado `usuario/proyecto`. Los
repositorios COPR no los revisa la distribución.

En el resto de este capítulo instalas un programa inventado, `moonphase`
(muestra la fase de la luna en la terminal), desde COPR.

### Los repositorios que tienes ahora

```sh
dnf repolist
```

```try
dnf repolist
---
Estos son los repositorios propios de Fedora.
```

### Activar un repositorio COPR

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf te recuerda que el repositorio no forma parte de Fedora y que la calidad
puede variar. La respuesta por defecto es **No**, así que responde `y`. Se crea
un archivo nuevo en `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

```quiz
Cualquiera con una cuenta de Fedora puede compilar paquetes en COPR. ¿Quién los revisa?
- [ ] Los desarrolladores de Fedora, antes de que se publiquen
- [ ] Red Hat
- [x] Nadie: tienes que confiar en quien mantiene el repositorio
```

### Instalar y ejecutar

dnf obtiene por su cuenta la información del repositorio nuevo, así que el
paquete se puede instalar enseguida:

```sh
sudo dnf install moonphase
moonphase
```

### ¿De dónde viene el paquete?

```sh
dnf info moonphase
```

La línea `From repository` muestra que el paquete viene de COPR. Los paquetes
de COPR se actualizan como siempre, con `sudo dnf upgrade`.

### Desactivar o eliminar

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` deja el archivo en su sitio pero desactiva el repositorio; `remove`
lo elimina por completo. El programa se queda, pero ya no recibe
actualizaciones.

```quiz
¿Qué diferencia hay entre `dnf copr disable` y `dnf copr remove`?
- [x] `disable` desactiva el repositorio pero deja el archivo; `remove` lo elimina
- [ ] `disable` también desinstala los paquetes; `remove` no
- [ ] No hay ninguna diferencia
```

### RPM Fusion

Otro repositorio adicional habitual en Fedora es **RPM Fusion**. Tiene cosas
que Fedora no puede o no quiere incluir, como ciertos códecs multimedia y
drivers. Es un proyecto grande y compartido, no el repositorio de un solo
usuario como en COPR.

Cada repositorio que añades es un remitente más en el que confías. Mantén la
lista corta y elimina lo que ya no uses.
