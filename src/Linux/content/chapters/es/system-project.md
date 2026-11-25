# Proyecto: La guarida

Tú y un par de amigos habéis fundado un club secreto. El club tiene un nombre,
un saludo secreto y una contraseña, pero no tiene guarida. Eso sí, tu ordenador
tiene sitio de sobra. Las reglas son sencillas: solo entran los miembros, se
llama a la puerta con un script, hay una entrada secreta, alguien hace guardia
por la noche y siempre hay una copia de seguridad por si algún día descubren la
guarida.

Todo lo que necesitas lo tienes de *El sistema*: permisos, variables, enlaces,
procesos y archivos comprimidos. Aquí no hay nada nuevo; el reto es juntar las
piezas por tu cuenta.

## La misión

1. **Construye la guarida.** Crea el directorio `~/{{clubDir}}`. Solo tú puedes
   leerlo, escribir en él y entrar; el grupo y los demás no reciben nada
   (`rwx------`).
2. **Contrata a un portero.** Escribe el script `~/{{clubDir}}/{{knockScript}}`,
   que muestra la contraseña del club con `echo`. Hazlo ejecutable y ejecútalo.
3. **Marca el camino.** Crea la variable de entorno `{{clubVar}}` con la ruta
   completa de la guarida, para que `cd ${{clubVar}}` te lleve hasta allí.
4. **Esconde una entrada secreta.** Crea un enlace simbólico
   `~/{{documents}}/{{wardrobe}}` que lleve directamente a la guarida. Nadie busca
   una guarida al fondo de un armario.
5. **Pon un vigilante nocturno.** Ejecuta `sleep 3600` en segundo plano, para que
   haga guardia durante una hora y siga aunque cierres la sesión. (Un vigilante
   que no hace otra cosa que dormir: muy realista.)
6. **Haz una copia de seguridad.** Empaqueta toda la guarida en el archivo
   comprimido `~/{{clubBackup}}`.
7. **Manda al vigilante a casa.** Ya es de día: termina el proceso.

Los hitos de la lista junto a este texto se comprueban automáticamente cuando ejecutas
tus comandos.

## Consejos por el camino

- `ls -ld ~/{{clubDir}}` muestra los permisos del propio directorio en lugar de
  su contenido. r = 4, w = 2 y x = 1.
- El portero solo necesita una línea. Ponla entre comillas simples y llegará al
  archivo tal cual la escribiste. Un script del directorio en el que estás se
  ejecuta con `./` delante del nombre.
- Nada de espacios alrededor del `=` al crear una variable, y no olvides
  `export`: si no, se queda en una simple variable de la shell. Compruébalo con
  `echo ${{clubVar}}`.
- `ln -s` recibe primero el destino y después el nombre del enlace. Luego prueba
  `cd ~/{{documents}}/{{wardrobe}}` y mira dónde acabas.
- `jobs` muestra tus trabajos en segundo plano con sus números, y `ps` muestra
  sus PID.
- Empaqueta desde tu directorio personal, así las rutas del archivo empiezan por
  `{{clubDir}}/`. `tar -tzf` muestra lo que ha entrado.

## ¿Quieres hacer más?

Cuando termines los hitos, el club puede crecer. Crea un alias que te lleve a la
guarida con una sola palabra. Pon una lista de miembros en la guarida y un enlace
duro a ella en tu directorio personal. Descomprime la copia de seguridad en un
directorio nuevo y comprueba que el portero todavía se sabe la contraseña. ¿Y qué
le pasa a la entrada secreta si la guarida se muda?
