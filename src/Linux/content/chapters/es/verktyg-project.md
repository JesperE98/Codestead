# Proyecto: Empaqueta tus dotfiles

Gran noticia: la semana que viene te dan un ordenador nuevecito. Estupendo, salvo
que todo lo que has configurado en este se queda atrás. Tus alias, tu nombre en git,
todos esos pequeños ajustes. Viven en pequeños archivos ocultos de tu directorio
personal, archivos cuyo nombre empieza por un punto. Por eso se llaman *dotfiles*, y
programadores de todo el mundo guardan los suyos en un repositorio git: en un
ordenador nuevo lo clonan y, un minuto después, se sienten en casa.

Es hora de empaquetar los tuyos. Todo lo que necesitas está en *Más herramientas*:
git y lo que aprendiste sobre los shells y sus archivos de configuración. El reto es
montarlo tú solo.

## La misión

1. **Consigue una caja de mudanza.** Crea el directorio `~/{{dotfilesDir}}` y
   conviértelo en un repositorio git.
2. **Empaqueta lo que tienes.** Copia tu configuración de bash `~/.bashrc` y tu
   configuración de git `~/.gitconfig` al repositorio. Conserva el punto en el
   nombre o quítalo: las dos cosas son habituales.
3. **Añade algo tuyo.** Escribe el archivo `{{aliasFile}}` en el repositorio, con al
   menos dos alias que te resulten útiles.
4. **Cierra la caja.** Haz un commit que contenga las dos copias y `{{aliasFile}}`.
5. **Deja el secreto fuera.** Tu contraseña del wifi va a vivir en
   `~/{{dotfilesDir}}/{{secretFile}}`, pero nunca debe acabar en el historial. ¡Los
   repositorios de dotfiles suelen ser públicos! Crea el archivo, haz que git lo
   ignore y haz commit de lo que haga falta para ello.
6. **Experimenta en una rama.** Crea la rama `{{aliasBranch}}`, añade al menos un
   alias más a `{{aliasFile}}` y haz commit en la rama.
7. **Desempaqueta y úsalo.** Los alias nuevos funcionan, así que fusiona
   `{{aliasBranch}}` con la rama principal. Después carga `{{aliasFile}}` en tu
   shell con `source` y ejecuta uno de tus alias.

Los hitos de la lista que hay junto a este texto se comprueban automáticamente
mientras ejecutas tus comandos.

## Consejos por el camino

- `ls -a` muestra los archivos ocultos, los que empiezan por un punto.
- Ejecuta `git status` a menudo. Te dice qué es nuevo, qué ha cambiado y qué irá en
  el próximo commit.
- Un alias se escribe `alias ll='ls -la'`, sin espacios alrededor del `=`. Para
  escribir la línea con `echo`, pon comillas dobles por fuera y simples por dentro.
- ¿git dice *Please tell me who you are*? Configura primero `user.name` y
  `user.email` con `git config --global`.
- `.gitignore` solo se aplica a archivos que git todavía no sigue. ¿Hiciste commit
  de la contraseña por error? `git rm --cached` la saca del repositorio pero la deja
  en el disco. Aun así, el commit antiguo la sigue teniendo: en la vida real
  cambiarías la contraseña.
- `source` lee el archivo en el shell en el que estás. zsh entiende las mismas
  líneas de alias que bash, así que el archivo funciona en los dos.

## ¿Quieres hacer más?

Cuando termines los hitos, aún queda por empaquetar. Añade la línea
`source ~/{{dotfilesDir}}/{{aliasFile}}` al final de `~/.bashrc`, para que cada
terminal nueva tenga tus alias. Copia también `~/.zshrc` o el archivo de fish
`~/.config/fish/config.fish`, si los tienes. Y haz de ordenador nuevo:
`git clone ~/{{dotfilesDir}} ~/ordenador-nuevo`: ¿está todo? ¿Y de verdad falta
`{{secretFile}}`? Por último, admira tu obra con `git log --oneline --graph --all`.
