# Examen: Más herramientas

Catorce preguntas sobre git y otras shells. Necesitas un 80 % de respuestas
correctas para aprobar. Las preguntas con comandos empiezan en una terminal
nueva, así que primero instalan el programa que necesitan: `> /dev/null 2>&1`
descarta la salida de esas líneas.

```quiz
Has modificado `index.html` y has creado el archivo nuevo `kontakt.html`.
Ejecutas `git commit -am "Contact page"`. ¿Qué entra en el commit?
- [x] Solo el cambio de `index.html`
- [ ] Solo `kontakt.html`
- [ ] Los dos archivos
---
`-a` añade todos los archivos modificados que git ya sigue, pero nunca
archivos nuevos. `kontakt.html` hay que añadirlo antes con `git add`.
```

```quiz
Has ejecutado `git add` con un cambio en `style.css`. ¿Qué comando muestra ese
cambio?
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` compara el árbol de trabajo con el índice, así que no muestra nada
una vez que el cambio está en el índice. `--staged` muestra lo que espera para
entrar en un commit.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "Elev Elevsson"
$ git config --global user.email "elev@example.com"
$ cd ~/projekt-webb && git init > /dev/null 2>&1
$ git add . && git commit -m "Första versionen" > /dev/null
$ git switch -c ny-design > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "Lila rubriker" > /dev/null
$ git switch main > /dev/null 2>&1
$ git merge ny-design > /dev/null
$ git log --oneline | wc -l
2
---
`main` no había cambiado desde que se creó la rama, así que la fusión fue un
*fast-forward*: git solo movió `main` hacia delante hasta el commit de
`ny-design`. No se creó ningún commit de fusión.
```

```quiz
¿Qué es técnicamente una rama en git?
- [ ] Una copia completa de todos los archivos del proyecto
- [x] Una etiqueta que apunta a un commit y avanza cuando haces commits nuevos
- [ ] Un repositorio aparte con su propio directorio `.git`
---
Por eso las ramas son baratas en git: úsalas a menudo.
```

```quiz
`git merge` se detuvo con un conflicto en `index.html`. Has arreglado el
archivo y has quitado las líneas de marca. ¿Qué haces ahora?
- [ ] Ejecutar `git merge` otra vez
- [x] `git add index.html` y luego `git commit`
- [ ] `git restore index.html`
---
`git add` le dice a git que el conflicto está resuelto, y `git commit` termina
la fusión. `git restore` descartaría tu arreglo.
```

```quiz
El archivo `fel.log` se incluyó en un commit por error. Añades `*.log` a
`.gitignore`, pero git sigue siguiendo el archivo. ¿Cómo lo quitas del
repositorio pero lo conservas en el disco?
- [ ] `rm fel.log`
- [x] `git rm --cached fel.log`
- [ ] `git restore fel.log`
---
`.gitignore` solo se aplica a archivos que git aún no sigue. `--cached` quita
el archivo de git pero lo deja en el disco.
```

```quiz
¿Qué comando descarga commits nuevos del remoto **sin** fusionarlos con los
tuyos?
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` descarga y fusiona; `git fetch` solo descarga.
```

```quiz
¿Cuáles de estos cambios se pierden para siempre? Elige todas las correctas.
- [x] Cambios en un archivo que nunca entraron en un commit, descartados con `git restore`
- [x] Cambios que nunca entraron en un commit, descartados con `git reset --hard`
- [ ] Un commit que hiciste ayer, antes de ejecutar `git reset --hard`
---
Todo lo que entró en un commit en algún momento casi siempre se puede
rescatar: `git reflog` muestra por dónde has pasado.
```

```quiz
Has iniciado zsh desde bash. ¿Qué comando muestra la shell que estás
ejecutando ahora mismo?
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` es tu shell de inicio de sesión, que sigue siendo `/bin/bash`.
`/etc/shells` lista las shells que se pueden usar como shells de inicio de
sesión.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` maneja decimales.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
En fish, el estado de salida del último comando se llama `$status`; `false`
siempre falla.
```

```quiz
¿Cómo conviertes `EDITOR` en una variable de entorno con el valor `nano` en fish?
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` exporta la variable; `-e` la borra.
```

```quiz
¿Qué archivo lee zsh cuando arranca?
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep elev /etc/passwd
---
El último campo de la línea es tu shell de inicio de sesión: la que cambia
`chsh -s`.
```
