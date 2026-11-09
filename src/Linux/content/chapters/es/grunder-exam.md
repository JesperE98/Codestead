# Examen: Lo básico

Responde las preguntas de abajo para demostrar lo que has aprendido en esta
parte.

```quiz
¿Cuál de estas rutas es **absoluta**?
- [ ] `var/log`
- [ ] `../etc`
- [x] `/usr/bin`
- [ ] `{{documents}}`
---
Una ruta absoluta empieza por `/`, en la raíz. Las demás parten del directorio
en el que estás.
```

```predict
$ cd /var/log
$ cd ../..
$ pwd
/
---
Cada `..` sube un nivel: de `/var/log` a `/var`, y luego a `/`.
```

```quiz
¿Qué hace `cd -`?
- [ ] Sube un nivel
- [ ] Va a tu directorio personal
- [x] Vuelve al último directorio en el que estuviste
```

```quiz
Quieres copiar el directorio entero `{{pictures}}`, con todo su contenido, a `{{pictures}}-copia`. ¿Qué comando funciona?
- [ ] `cp {{pictures}} {{pictures}}-copia`
- [x] `cp -r {{pictures}} {{pictures}}-copia`
- [ ] `mv {{pictures}} {{pictures}}-copia`
---
Un directorio se copia con `-r` (*recursive*). `mv` lo movería en lugar de
copiarlo.
```

```predict
$ mkdir -p a/b/c
$ ls a/b
c
---
`-p` crea `a`, `a/b` y `a/b/c` de una vez, así que `a/b` contiene `c`.
```

```quiz
Escribes `touch mi archivo.txt`, sin comillas. ¿Qué pasa?
- [ ] Se crea un archivo llamado `mi archivo.txt`
- [x] Se crean dos archivos: `mi` y `archivo.txt`
- [ ] Nada, porque el nombre contiene un espacio
---
La shell divide la línea por los espacios, así que `touch` recibe dos
argumentos. Escribe `touch "mi archivo.txt"` para obtener un solo archivo.
```

```quiz
¿Qué líneas muestra `grep -i error {{documents}}/server.log`?
- [ ] Solo las líneas con `error` en minúsculas
- [ ] Solo las líneas con `ERROR` en mayúsculas
- [x] Las líneas con `error` en cualquier combinación de mayúsculas y minúsculas
```

```quiz
Quieres vigilar un archivo de registro y ver las líneas nuevas a medida que se escriben. ¿Qué comando encaja?
- [ ] `head -n 10 {{documents}}/server.log`
- [x] `tail -f {{documents}}/server.log`
- [ ] `wc -l {{documents}}/server.log`
---
`tail -f` *sigue* el archivo. Detenlo con **Ctrl+C**.
```

```quiz
¿Qué muestra `wc` cuando le das un archivo y ninguna opción?
- [ ] Solo el número de líneas
- [x] El número de líneas, palabras y bytes
- [ ] Las 10 primeras líneas del archivo
```

```predict
$ echo a > x.txt
$ echo b >> x.txt
$ echo c > x.txt
$ cat x.txt
c
---
`>>` añadió `b`, pero el último `>` sobrescribió el archivo entero.
```

```quiz
¿Cuándo se ejecuta `b` en `a || b`?
- [ ] Siempre, después de `a`
- [ ] Solo si `a` tuvo éxito
- [x] Solo si `a` falló
```

```try
grep ERROR ~/{{documents}}/server.log | tee errores.txt | wc -l
---
`tee` guardó las líneas de error en `errores.txt` y se las pasó a `wc -l`, que
las contó.
```

```predict
$ echo "a,b,c" | cut -d, -f2
b
---
`-d,` hace que la coma sea el separador, y `-f2` se queda con el campo 2.
```
