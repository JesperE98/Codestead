# Projet : Le repaire

Avec deux ou trois amis, vous avez fondé un club secret. Le club a un nom, une
poignée de main et un mot de passe – mais pas de repaire. Votre ordinateur, lui,
a toute la place qu'il faut. Les règles sont simples : seuls les membres
entrent, on frappe à la porte avec un script, il y a une entrée secrète,
quelqu'un monte la garde la nuit, et il y a toujours une sauvegarde au cas où le
repaire serait découvert.

Tout ce qu'il vous faut vient de *Le système* : permissions, variables, liens,
processus et archives. Rien de nouveau ici ; le défi, c'est d'assembler les
pièces vous-même.

## La mission

1. **Construisez le repaire.** Créez le répertoire `~/{{clubDir}}`. Vous seul
   pouvez le lire, y écrire et y entrer – le groupe et les autres n'ont rien
   (`rwx------`).
2. **Engagez un portier.** Écrivez le script `~/{{clubDir}}/{{knockScript}}`, qui
   affiche le mot de passe du club avec `echo`. Rendez-le exécutable et lancez-le.
3. **Balisez le chemin.** Créez la variable d'environnement `{{clubVar}}` avec le
   chemin complet du repaire, pour que `cd ${{clubVar}}` vous y emmène.
4. **Cachez une entrée secrète.** Créez un lien symbolique
   `~/{{documents}}/{{wardrobe}}` qui mène tout droit au repaire. Personne ne
   cherche un repaire au fond d'une armoire.
5. **Postez une sentinelle.** Lancez `sleep 3600` en arrière-plan, pour qu'elle
   monte la garde pendant une heure – et continue même si vous vous
   déconnectez. (Une sentinelle qui ne fait rien d'autre que dormir : très
   réaliste.)
6. **Faites une sauvegarde.** Mettez tout le repaire dans l'archive compressée
   `~/{{clubBackup}}`.
7. **Renvoyez la sentinelle chez elle.** Le matin est là – terminez le
   processus.

Les étapes de la liste à côté de ce texte sont vérifiées automatiquement quand vous
lancez vos commandes.

## Conseils en chemin

- `ls -ld ~/{{clubDir}}` montre les permissions du répertoire lui-même au lieu de
  son contenu. r = 4, w = 2 et x = 1.
- Le portier n'a besoin que d'une ligne. Mettez-la entre guillemets simples :
  elle arrivera dans le fichier exactement comme vous l'avez écrite. Un script du
  répertoire où vous êtes se lance avec `./` devant son nom.
- Pas d'espaces autour du `=` quand vous créez une variable, et n'oubliez pas
  `export` – sinon elle reste une simple variable du shell. Vérifiez avec
  `echo ${{clubVar}}`.
- `ln -s` prend d'abord la cible, puis le nom du lien. Essayez ensuite
  `cd ~/{{documents}}/{{wardrobe}}` et regardez où vous arrivez.
- `jobs` montre vos jobs en arrière-plan avec leurs numéros, et `ps` leurs PID.
- Créez l'archive depuis votre répertoire personnel : les chemins dans l'archive
  commenceront par `{{clubDir}}/`. `tar -tzf` montre ce qu'elle contient.

## Envie d'aller plus loin ?

Une fois les étapes terminées, le club peut grandir. Créez un alias qui vous
emmène au repaire en un seul mot. Mettez une liste des membres dans le repaire et
un lien physique vers elle dans votre répertoire personnel. Décompressez la
sauvegarde dans un nouveau répertoire et vérifiez que le portier connaît toujours
le mot de passe. Et que devient l'entrée secrète si le repaire déménage ?
