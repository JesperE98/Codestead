# Projet : Le site web est en panne !

Vendredi, 16 h 47. Votre téléphone sonne. C'est votre cheffe, à bout de souffle :
« Le site web est en panne ! Les clients ne voient plus nos horaires d'ouverture,
et le même client a déjà appelé trois fois ! »

Le site web de l'entreprise, c'est le petit serveur web `myserver` sur le port
8080 – sur *votre* ordinateur. Oui, vraiment. Quelqu'un l'a installé là
« provisoirement » il y a des années, et depuis, personne n'a osé le déplacer.

Est-ce le réseau ? Le serveur web ? Ou l'ordinateur portable de la cheffe ?
Trouvez-le de l'intérieur vers l'extérieur, notez tout dans un journal d'incident
– et faites en sorte que la prochaine fois soit plus simple. Tout ce qu'il vous
faut se trouve dans *Réseau* ; le défi, c'est d'assembler les pièces vous-même.

## La mission

1. **Commencez le journal.** Créez le dossier `~/{{incidentDir}}` avec le journal
   d'incident `{{incidentLog}}`, et notez-y l'adresse IP de l'ordinateur et
   l'adresse de la passerelle.
2. **La sortie.** Montrez que le réseau fonctionne jusqu'à Internet, résolution
   de noms comprise : ajoutez au journal un ping de trois paquets vers un nom sur
   Internet.
3. **Quelqu'un écoute ?** Découvrez si quelque chose écoute sur le port 8080. Si
   rien n'écoute, démarrez le serveur web et vérifiez à nouveau.
4. **Le site répond ?** Ajoutez au journal les en-têtes de réponse de la page
   d'accueil, `http://localhost:8080`. Le code d'état doit être 200.
5. **Une clé pour le serveur.** La prochaine fois, vous voulez entrer sur le
   serveur `server.lan` sans mot de passe. Créez une paire de clés et mettez la
   clé publique sur le serveur.
6. **Sauvegardez.** Copiez tout le dossier `~/{{incidentDir}}` dans votre
   répertoire personnel sur le serveur, pour que le journal survive même si
   votre propre ordinateur rend l'âme.
7. **Lisez à distance.** Affichez avec `ssh` le journal qui se trouve sur le
   serveur – sans que personne ne demande de mot de passe.

Les étapes de la liste à côté de ce texte sont vérifiées automatiquement quand vous
lancez vos commandes.

## Conseils en chemin

- `>` crée (ou écrase) un fichier et `>>` ajoute à sa fin : commencez le journal
  avec `>`, puis tenez-vous-en à `>>`.
- Procédez de l'intérieur vers l'extérieur : adresse, route, routeur, Internet
  et enfin un nom. Sans `-c`, `ping` continue jusqu'à ce que vous l'arrêtiez.
- `ss -tulpn` montre les ports en écoute. La colonne *Process* est vide pour les
  processus d'autres utilisateurs – ici, c'est le port qui compte.
- Sur Ubuntu, `curl` n'est pas préinstallé : `sudo apt update` et
  `sudo apt install curl`. `-I` ne récupère que les en-têtes.
- Le nom court `srv` de `~/.ssh/config` marche partout – tout comme
  `{{user}}@server.lan` et `{{user}}@192.168.1.10`.
- `rsync -av SOURCE/ srv:DESTINATION/` – la barre oblique après la source
  signifie « ce que contient le répertoire ».
- `ssh` demande encore un mot de passe ? Alors la clé n'est pas encore sur le
  serveur.

## Envie d'aller plus loin ?

Une fois les étapes terminées, vous pouvez continuer. Coupez la carte réseau avec
`sudo ip link set enp0s3 down`, regardez où la chaîne de l'intérieur vers
l'extérieur casse, et rallumez-la avec `up`. Récupérez la page `/about.html` du
site avec `curl`. Ajoutez une ligne au journal et relancez le même `rsync -av` –
seule la modification est envoyée. Et rappelez la cheffe. (La rumeur dit que son
portable était en mode avion.)
