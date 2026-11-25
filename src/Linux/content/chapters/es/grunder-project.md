# Proyecto: El detective de logs

Son las 7:45 y tu jefa está junto a tu escritorio con una taza de café en la mano.
«Ayer el servidor dio problemas. Nadie sabe por qué y los clientes ya empiezan a llamar.
¿Puedes averiguar qué pasó y escribir un informe corto antes de comer?».

Todo lo que necesitas está en el archivo de log `~/{{documents}}/server.log` y en los
comandos que aprendiste en *Lo básico*. Aquí no hay nada nuevo; el reto es juntar las
piezas por tu cuenta.

## La misión

1. **Abre una investigación.** Crea la carpeta `~/{{caseDir}}` con la subcarpeta
   `{{evidence}}`. Todas las pruebas y el informe van ahí.
2. **Asegura las pruebas.** Copia el log a `{{evidence}}`. Después trabaja con la
   copia: el original debe quedar intacto.
3. **Separa los errores.** Guarda todas las líneas con `ERROR` en un archivo aparte,
   `~/{{caseDir}}/{{errorsFile}}`.
4. **Escribe el informe.** El informe `~/{{caseDir}}/{{caseReport}}` se construye línea a línea:
   - primero el **número de advertencias**: líneas con `WARN`, esté escrito en mayúsculas
     o en minúsculas,
   - después **la primera línea de error**, para que se vea cuándo empezaron los problemas,
   - por último las **horas** de todos los errores, una por línea, la más reciente primero.
5. **Cierra el caso.** Muestra el informe completo y comprueba que no falta nada.

Los hitos de la lista junto a este texto se comprueban automáticamente cuando ejecutas
tus comandos.

## Consejos por el camino

- Mira primero el log con `cat` o `less` para saber cómo son las líneas.
- Recuerda la diferencia entre `>` y `>>`: uno sobrescribe el archivo y el otro añade al
  final. ¿Sobrescribiste el informe sin querer? No pasa nada: vuelve a empezar desde el
  número de advertencias.
- Un pipe (`|`) pasa la salida de un comando al siguiente. Varios hitos se quedan en una
  línea corta si conectas dos o tres comandos.
- Cada línea del log está formada por campos separados por espacios: fecha, hora, nivel y
  mensaje.

## ¿Quieres hacer más?

Cuando termines los hitos, puedes seguir investigando por tu cuenta. ¿Qué página dio el
error `404`? ¿Cuántas líneas tienen el nivel `INFO`? Añade lo que encuentres al informe:
un buen detective no deja cabos sueltos.
