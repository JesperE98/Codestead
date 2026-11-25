# Projet : Une nouvelle recrue lundi

Vendredi, quinze heures trente. Votre cheffe passe la tête par la porte :
« Au fait – {{newUser}} rejoint l'équipe support lundi. Vous pouvez tout
préparer ? Le compte, le dossier de l'équipe, la lecture de la première semaine.
Et faites en sorte que l'intranet marche cette fois – la dernière recrue a passé
toute sa première matinée à fixer *Couldn't connect to server*. »

Tout ce qu'il vous faut se trouve dans *Administration système* – utilisateurs
et groupes, disques et services – avec un peu d'aide des parties précédentes.
Rien n'est nouveau ici ; le défi, c'est d'assembler les pièces vous-même, pour
que lundi matin se passe sans accroc.

## La mission

1. **Un compte.** Créez l'utilisateur `{{newUser}}` avec un répertoire personnel
   et `/bin/bash` comme shell, et donnez un mot de passe au compte.
2. **L'équipe.** Créez le groupe `{{teamGroup}}` et ajoutez-y à la fois
   `{{newUser}}` et vous-même. `{{newUser}}` n'a pas les droits sudo – pas encore,
   ce sera après la période d'essai.
3. **Le dossier partagé.** Créez `/srv/{{teamGroup}}`, qui appartient au groupe
   `{{teamGroup}}`. Le groupe peut lire le dossier, y écrire et y entrer ; tous les
   autres ne peuvent rien du tout.
4. **Testez le compte.** Devenez `{{newUser}}`, créez un fichier dans le dossier
   partagé pour montrer que les droits fonctionnent, et revenez à votre propre
   compte.
5. **Le kit de bienvenue.** La lecture de la première semaine, `{{report}}`, est
   sur la clé USB (`/dev/sdb1`). Mettez-en une copie dans le répertoire personnel
   de `{{newUser}}` – appartenant à `{{newUser}}`, pas à root – et démontez la clé
   quand vous avez fini.
6. **L'intranet.** L'intranet de l'équipe est le service `myserver`. Faites en
   sorte qu'il tourne maintenant **et** qu'il démarre tout seul à chaque
   démarrage de l'ordinateur.
7. **Répétition générale.** Redémarrez l'ordinateur et montrez dans le journal
   que l'intranet a démarré tout seul lors de ce démarrage.

Les étapes de la liste à côté de ce texte sont vérifiées automatiquement quand vous
lancez vos commandes.

## Conseils en chemin

- Presque tout ici modifie le système, donc la plupart des commandes ont besoin
  de `sudo`.
- `usermod -aG` – n'oubliez pas le `-a`, sinon l'utilisateur est retiré de tous
  ses autres groupes. `id {{newUser}}` montre dans quels groupes est un compte.
- `ls -ld` montre le propriétaire, le groupe et les droits d'un répertoire.
  Comptez les droits en octal : *rwx* vaut 7 et rien vaut 0.
- Un fichier que vous copiez avec `sudo` appartient à root. Copiez-le plutôt *en
  tant que* nouvelle recrue – avec `su -` ou `sudo -u` – et il appartient à la
  bonne personne dès le départ.
- Une copie appartenant à root s'y trouve déjà ? `{{newUser}}` peut la supprimer –
  elle est dans son propre répertoire personnel – et copier à nouveau.
- `umount` répond *target is busy* ? Votre propre shell se trouve dans le
  répertoire : d'abord `cd ~`.
- `start` et `enable` sont deux choses différentes. `systemctl is-active` et
  `systemctl is-enabled` montrent où vous en êtes.
- Après un redémarrage, `journalctl -b` ne montre que le démarrage en cours.

## Envie d'aller plus loin ?

Une fois les étapes terminées, vous pouvez continuer. Les fichiers de la
nouvelle recrue vont-ils tenir ? `df -h` et `du -sh` le savent. Verrouillez le
compte avec `usermod -L` jusqu'à lundi matin, vérifiez avec `passwd -S` et
déverrouillez-le avec `usermod -U`. Et regardez votre travail du côté du
système : les lignes de `{{newUser}}` dans `/etc/passwd` et `/etc/group`, et
`systemctl status myserver`.
