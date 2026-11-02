# Examen: Scripts y automatización

Responde las preguntas sobre scripts de shell; necesitas un 80 % para aprobar.

```quiz
¿Qué hace la primera línea `#!/bin/bash` de un script?
- [ ] Es un comentario que la shell se salta
- [x] Le dice al sistema qué programa debe ejecutar el archivo
- [ ] Hace que el archivo sea ejecutable
---
Se llama *shebang*. Sigues necesitando `chmod +x` para que el archivo sea
ejecutable.
```

```quiz
`{{nameVar}} = Kim` da el error `command not found`. ¿Por qué?
- [x] Los espacios alrededor de `=` hacen que la shell trate `{{nameVar}}` como un comando
- [ ] Los nombres de variable deben escribirse en mayúsculas
- [ ] Hay que escribir `${{nameVar}} = Kim`
```

```predict
$ cantidad=$(ls ~/{{documents}} | wc -l)
$ echo "$cantidad archivos"
3 archivos
```

```predict
$ a=5
$ (( a += 10 ))
$ echo $a
15
```

```quiz
¿Qué contiene `"$@"` en un script?
- [ ] El número de argumentos
- [ ] El nombre del script
- [x] Todos los argumentos, cada uno por separado
```

```quiz
¿Qué prueba es verdadera cuando el número de `n` es mayor que 10?
- [ ] `[ $n > 10 ]`
- [x] `[ $n -gt 10 ]`
- [ ] `[ $n = 10 ]`
---
Los números se comparan con `-eq`, `-lt`, `-gt` y demás; `=` y `<` comparan
texto.
```

```predict
$ [ -d ~/{{missing}} ] && echo yes || echo no
no
```

```predict
$ archivo=informe.txt
$ case $archivo in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
A text file
```

```predict
$ plus() { echo $(( $1 + $2 )); }
$ plus 4 5
9
```

```predict
$ for i in 1 2 3 4 5; do if [ $i -eq 3 ]; then continue; fi; echo $i; done
1
2
4
5
---
`continue` salta directamente a la siguiente vuelta, así que `3` nunca se
muestra.
```

```quiz
¿Qué hace `local` en una función?
- [x] Crea una variable que solo existe dentro de la función
- [ ] Hace que la función vaya más rápido
- [ ] Termina la función con un código de salida
```

```quiz
¿Por qué un script termina con `exit 1` cuando algo sale mal?
- [ ] Para reiniciar el script
- [x] Para que quien llamó al script vea por el código de salida que falló
- [ ] Para mostrar el número 1
```

```quiz
Empiezas un here document con `cat > {{helloScript}} << '{{heredocEnd}}'`. ¿Cuándo termina?
- [ ] Cuando pulsas Intro en una línea vacía
- [x] En la línea `{{heredocEnd}}`
- [ ] Después de diez líneas
```

```try
for i in $(seq 1 3); do echo "Round $i"; done
```
