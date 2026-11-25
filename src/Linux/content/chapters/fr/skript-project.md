# Projet : Le robot des rapports

Vous vous souvenez du jour où le serveur a fait des siennes ? Votre cheffe a adoré
votre rapport – un peu trop. « Génial. J'en veux un comme ça sur mon bureau tous les
matins. Tous les jours ouvrés. Avant sept heures. » Vous n'avez aucune intention de
vous lever à six heures pour taper des commandes `grep`. Heureusement, ce n'est pas
nécessaire : vous savez maintenant écrire des scripts. Il est temps de construire un
robot qui fera le travail à votre place.

Le robot lit le journal `~/{{documents}}/server.log` et écrit un court rapport :
combien de lignes il y a de chaque niveau, et quelles erreurs se sont produites.
Tout ce dont il a besoin se trouve dans *Scripts et automatisation* – le défi, c'est
de l'assembler vous-même.

## La mission

1. **Construisez le robot.** Créez le script `~/{{robotScript}}` avec une ligne
   shebang et une ligne qui affiche un titre. Rendez-le exécutable et lancez-le.
2. **Apprenez-lui à demander le journal.** Le robot reçoit le fichier journal en
   premier argument. Lancé sans argument, il doit expliquer comment l'utiliser et
   s'arrêter avec un code de retour différent de 0.
3. **… et à se plaindre des fichiers manquants.** Si le fichier passé en argument
   n'existe pas, le robot le dit et s'arrête avec un code de retour différent de 0.
   Essayez avec un nom de fichier qui n'existe pas.
4. **Comptez les niveaux.** Lancé sur `~/{{documents}}/server.log`, le robot affiche
   combien de lignes le journal contient de chaque niveau, comptées avec `awk`.
   Attention : `WARN` et `warn` sont le même niveau !
5. **Listez les erreurs.** Sous les chiffres, le rapport liste chaque erreur avec
   son heure et son message – mais **sans** la date, qui est de toute façon la même
   sur toutes les lignes. Retirez-la avec `sed`.
6. **Embauchez le robot.** Planifiez-le avec cron : il tourne sur le journal du
   serveur à 06:30 du lundi au vendredi, et sa sortie est ajoutée à
   `~/{{robotLog}}`. Gardez vos anciennes tâches.
7. **Répétition générale.** Lancez une fois à la main la commande de la tâche, pour
   que le rapport du jour arrive dans `~/{{robotLog}}`, et jetez un œil au fichier.

Les étapes de la liste à côté de ce texte sont vérifiées automatiquement quand vous
lancez vos commandes.

## Conseils en chemin

- Construisez le robot morceau par morceau et lancez-le après chaque modification.
  Le plus simple est de réécrire tout le script avec le here document – il remplace
  l'ancienne version.
- Essayez d'abord chaque ligne dans le terminal, avec le chemin du journal à la
  place de `"$1"`. Quand elle marche, mettez-la dans le script.
- `echo $?` juste après le robot affiche le code de retour avec lequel il s'est
  arrêté.
- `toupper()` d'`awk` transforme `warn` en `WARN`, et `sort | uniq -c` compte les
  lignes identiques.
- Chaque ligne du journal commence par la date et une espace – la commande `s` de
  `sed` peut remplacer ce morceau par rien.
- Les tâches cron ne tournent pas dans votre terminal : utilisez des chemins
  complets comme `~/{{robotScript}}`, et envoyez la sortie dans un fichier. Avec
  `>>`, le rapport de chaque matin s'ajoute à la fin au lieu d'écraser celui de la
  veille.

## Envie d'aller plus loin ?

Une fois les étapes terminées, le robot peut apprendre de nouveaux tours. Mettez la
date dans le titre avec `$(date)`. Faites de chaque partie du rapport une fonction.
Laissez le robot prendre plusieurs journaux à la fois avec `for file in "$@"`, ou
comptez combien de requêtes ont reçu la réponse `404`. Et si l'application est
encore ouverte à 06:30 un jour ouvré, `journalctl -u cron` montre que le robot est
vraiment allé au travail.
