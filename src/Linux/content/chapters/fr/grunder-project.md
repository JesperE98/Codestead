# Projet : Le détective des logs

Il est 7 h 45 et votre cheffe se tient devant votre bureau, une tasse de café à la main.
« Le serveur a fait des siennes hier. Personne ne sait pourquoi, et les clients commencent
à appeler. Vous pouvez découvrir ce qui s'est passé et écrire un court rapport avant midi ? »

Tout ce qu'il vous faut se trouve dans le fichier de log `~/{{documents}}/server.log` – et
dans les commandes apprises dans *Les bases*. Rien de nouveau ici ; le défi, c'est
d'assembler les pièces vous-même.

## La mission

1. **Ouvrez une enquête.** Créez le dossier `~/{{caseDir}}` avec le sous-dossier
   `{{evidence}}`. Toutes les preuves et le rapport y seront rangés.
2. **Mettez les preuves en sécurité.** Copiez le log dans `{{evidence}}`. Travaillez
   ensuite sur la copie – l'original doit rester intact.
3. **Isolez les erreurs.** Enregistrez toutes les lignes contenant `ERROR` dans un fichier
   à part, `~/{{caseDir}}/{{errorsFile}}`.
4. **Rédigez le rapport.** Le rapport `~/{{caseDir}}/{{caseReport}}` se construit ligne par ligne :
   - d'abord le **nombre d'avertissements** – les lignes avec `WARN`, en majuscules ou
     en minuscules,
   - puis **la première ligne d'erreur**, pour savoir quand les ennuis ont commencé,
   - enfin les **heures** de toutes les erreurs, une par ligne, la plus récente d'abord.
5. **Bouclez l'affaire.** Affichez tout le rapport et vérifiez que rien ne manque.

Les étapes de la liste à côté de ce texte sont vérifiées automatiquement quand vous
lancez vos commandes.

## Conseils en chemin

- Regardez d'abord le log avec `cat` ou `less`, pour savoir à quoi ressemblent les lignes.
- Pensez à la différence entre `>` et `>>` : l'un écrase le fichier, l'autre ajoute à la
  fin. Vous avez écrasé le rapport par erreur ? Pas de souci – recommencez à partir du
  nombre d'avertissements.
- Un pipe (`|`) transmet la sortie d'une commande à la suivante. Plusieurs étapes
  deviennent courtes si vous enchaînez deux ou trois commandes.
- Chaque ligne du log est faite de champs séparés par des espaces : date, heure, niveau
  et message.

## Envie d'aller plus loin ?

Une fois les étapes terminées, vous pouvez poursuivre l'enquête par vous-même. Quelle
page a renvoyé l'erreur `404` ? Combien de lignes ont le niveau `INFO` ? Ajoutez ce que
vous trouvez au rapport – un vrai détective ne laisse rien au hasard.
