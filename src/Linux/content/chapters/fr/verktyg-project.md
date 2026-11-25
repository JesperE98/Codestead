# Projet : Emballez vos dotfiles

Grande nouvelle : la semaine prochaine, vous recevez un ordinateur tout neuf.
Formidable – sauf que tout ce que vous avez réglé sur celui-ci reste derrière. Vos
alias, votre nom dans git, tous ces petits réglages. Ils vivent dans de petits
fichiers cachés de votre répertoire personnel, des fichiers dont le nom commence par
un point. C'est pour cela qu'on les appelle des *dotfiles*, et les programmeurs du
monde entier gardent les leurs dans un dépôt git : sur un nouvel ordinateur, ils le
clonent, et une minute plus tard ils se sentent chez eux.

Il est temps d'emballer les vôtres. Tout ce qu'il vous faut se trouve dans *Autres
outils* – git, et ce que vous avez appris sur les shells et leurs fichiers de
configuration. Le défi, c'est de l'assembler vous-même.

## La mission

1. **Trouvez un carton de déménagement.** Créez le répertoire `~/{{dotfilesDir}}` et
   transformez-le en dépôt git.
2. **Emballez ce que vous avez.** Copiez vos réglages bash `~/.bashrc` et vos
   réglages git `~/.gitconfig` dans le dépôt. Gardez le point dans le nom ou
   retirez-le – les deux sont courants.
3. **Ajoutez quelque chose à vous.** Écrivez le fichier `{{aliasFile}}` dans le
   dépôt, avec au moins deux alias qui vous seraient utiles.
4. **Fermez le carton.** Faites un commit qui contient les deux copies et
   `{{aliasFile}}`.
5. **Gardez le secret dehors.** Votre mot de passe Wi-Fi va vivre dans
   `~/{{dotfilesDir}}/{{secretFile}}` – mais il ne doit jamais se retrouver dans
   l'historique. Les dépôts de dotfiles sont souvent publics ! Créez le fichier,
   faites en sorte que git l'ignore et committez ce qu'il faut pour cela.
6. **Expérimentez sur une branche.** Créez la branche `{{aliasBranch}}`, ajoutez au
   moins un alias de plus à `{{aliasFile}}` et committez-le sur la branche.
7. **Déballez et servez-vous-en.** Les nouveaux alias fonctionnent, alors fusionnez
   `{{aliasBranch}}` dans la branche principale. Chargez ensuite `{{aliasFile}}`
   dans votre shell avec `source` et lancez un de vos alias.

Les étapes de la liste à côté de ce texte sont vérifiées automatiquement quand vous
lancez vos commandes.

## Conseils en chemin

- `ls -a` affiche les fichiers cachés – ceux dont le nom commence par un point.
- Lancez souvent `git status`. Il vous dit ce qui est nouveau, ce qui a changé et
  ce qui ira dans le prochain commit.
- Un alias s'écrit `alias ll='ls -la'`, sans espace autour du `=`. Pour écrire la
  ligne avec `echo`, mettez des guillemets doubles à l'extérieur et des simples à
  l'intérieur.
- git répond *Please tell me who you are* ? Réglez d'abord `user.name` et
  `user.email` avec `git config --global`.
- `.gitignore` ne s'applique qu'aux fichiers que git ne suit pas encore. Vous avez
  committé le mot de passe par erreur ? `git rm --cached` le retire du dépôt mais le
  laisse sur le disque. L'ancien commit le contient pourtant toujours – dans la vraie
  vie, vous changeriez le mot de passe.
- `source` lit le fichier dans le shell où vous êtes. zsh comprend les mêmes lignes
  d'alias que bash, le fichier marche donc dans les deux.

## Envie d'aller plus loin ?

Une fois les étapes terminées, il reste de quoi emballer. Ajoutez la ligne
`source ~/{{dotfilesDir}}/{{aliasFile}}` à la fin de `~/.bashrc`, pour que chaque
nouveau terminal ait vos alias. Copiez aussi `~/.zshrc` ou le fichier de fish
`~/.config/fish/config.fish`, si vous les avez. Et jouez le nouvel ordinateur :
`git clone ~/{{dotfilesDir}} ~/nouvel-ordinateur` – tout y est ? Et
`{{secretFile}}` manque-t-il vraiment ? Pour finir, admirez votre travail avec
`git log --oneline --graph --all`.
