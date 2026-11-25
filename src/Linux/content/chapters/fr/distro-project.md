# Projet : L'ordinateur d'occasion

Votre ami Alex a acheté un ordinateur portable d'occasion et – après un peu de
persuasion – vous a laissé y installer {{distro}}. L'installation s'est bien
passée. Alex vient maintenant d'envoyer une liste de souhaits :

> 1. À jour, s'il te plaît. Je ne veux pas d'un ordinateur plein de failles.
> 2. La semaine prochaine, je commence un cours sur le langage de programmation Go.
> 3. Un truc qui montre ce qui ralentit l'ordinateur.
> 4. Un vrai éditeur. Tout le monde dit Vim.
> 5. Des films ! Il doit pouvoir lire des films.

Tout ce qu'il vous faut vient de *Distributions et paquets*. Rien de nouveau
ici ; le défi, c'est de trouver vous-même les bonnes commandes du gestionnaire
de paquets – et les bons noms de paquets.

## La mission

1. **Mettez l'ordinateur à jour.** Récupérez les dernières listes de paquets et
   mettez à jour tous les paquets installés.
2. **Trouvez Go.** Cherchez dans les listes de paquets comment s'appelle le
   paquet du langage Go dans votre distribution. Il ne s'appelle pas pareil
   partout !
3. **Installez la liste de souhaits.** Le visualiseur de processus `htop`, le
   langage de programmation Go et l'éditeur de texte Vim.
4. **Vérifiez.** Cherchez Go dans la liste des paquets *installés*.
5. **Supprimez Vim.** Alex a essayé Vim et n'a pas trouvé la sortie. « Enlève-moi
   ça ! » Désinstallez Vim.
6. **Des films.** Installez le lecteur multimédia VLC (`org.videolan.VLC`) en
   Flatpak depuis Flathub.
7. **Essai.** Avant de rendre l'ordinateur : demandez à Go d'afficher sa
   version, pour qu'Alex voie que le cours peut commencer.

Les étapes de la liste à côté de ce texte sont vérifiées automatiquement quand vous
lancez vos commandes. Elles comptent par famille – refaites le projet sur une
distribution d'une autre famille, et vous découvrirez un nouveau dialecte.

## Conseils en chemin

:::debian
- Sur {{distro}}, le gestionnaire de paquets est `apt`. Les commandes qui
  modifient le système se lancent avec `sudo`, et `apt update` ne fait que
  récupérer les listes – c'est `apt upgrade` qui installe les nouvelles versions.
:::
:::arch
- Sur {{distro}}, le gestionnaire de paquets est `pacman`. La majuscule est
  l'opération (`-S`, `-R`, `-Q`) et les minuscules sont des modificateurs.
  Mettez toujours à jour avec `-Syu`.
:::
:::redhat
- Sur {{distro}}, le gestionnaire de paquets est `dnf`. N'oubliez pas que
  `[y/N]` signifie qu'Entrée répond **non**.
:::
- Une recherche regarde à la fois les noms et les descriptions. Si le résultat
  est long, une recherche plus précise aide – ou `grep`.
- Les noms de paquets sont presque toujours les mêmes partout, mais pas
  toujours. Dans le doute : cherchez.
- Flatpak manque, ou ne connaît pas Flathub ? Installez le paquet `flatpak` et
  ajoutez Flathub avec `flatpak remote-add`, comme dans le chapitre sur les
  paquets universels.

## Envie d'aller plus loin ?

Une fois les étapes terminées, Alex aura bien sûr d'autres souhaits. Lancez
`htop` et regardez ce qui tourne. Consultez les informations du paquet Go et
trouvez sa taille. Demandez à Flatpak quelles permissions VLC possède. Et s'il
s'avère qu'Alex adore finalement le terminal : réinstallez Vim.
