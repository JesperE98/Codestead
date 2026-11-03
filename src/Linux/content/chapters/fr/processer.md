# Processus et jobs

Chaque programme en cours d'exécution est un **processus**. En ce moment,
l'ordinateur simulé en fait tourner une bonne douzaine : les services du
système, votre shell – et autre chose, que vous découvrirez bientôt. Dans ce
chapitre, vous apprendrez à voir ce qui tourne, à arrêter les programmes qui
se comportent mal et à lancer des choses en arrière-plan.

## Qu'est-ce qu'un processus ?

Un processus est un programme en cours d'exécution, avec tout ce dont il a
besoin : de la mémoire, des fichiers ouverts et l'utilisateur sous lequel il
tourne. Chaque processus possède un **PID** (*process ID*) – un numéro qui
l'identifie – et un parent, le **PPID**, qui l'a lancé. Tout commence avec le
processus numéro 1, `init` (sur presque toutes les distributions, c'est
`systemd`), qui lance tous les autres.

```quiz
Qu'est-ce que le PPID d'un processus ?
- [ ] Le numéro du processeur sur lequel il tourne
- [x] Le PID du processus qui l'a lancé – son parent
- [ ] Sa priorité
---
Chaque processus a un parent. Remontez les parents assez loin et vous arrivez
au processus numéro 1.
```

## Mes processus – `ps`

`ps` (*process status*) sans option affiche les processus de votre propre
terminal :

```sh
ps
```

Vous verrez votre shell, `bash`, et `ps` lui-même – qui ne vit que le temps
de son exécution.

## Tous les processus – `ps aux`

Pour voir tout ce qui tourne sur l'ordinateur, on utilise habituellement
`ps aux` :

```sh
ps aux
```

| Colonne | Signifie |
|---|---|
| `USER` | L'utilisateur sous lequel tourne le processus |
| `PID` | Le numéro d'identification du processus |
| `%CPU` / `%MEM` | La part de processeur et de mémoire qu'il utilise |
| `STAT` | L'état : `R` en cours d'exécution, `S` endormi, `s` leader de session |
| `COMMAND` | La commande qui a lancé le processus |

La liste est longue, c'est pourquoi on la combine souvent avec `grep` ou
`sort` :

```sh
ps aux | grep sshd
ps aux --sort=-%cpu | head -5
```

La variante `ps -ef` affiche les mêmes processus, mais avec le PID du parent
dans une colonne à part. Si vous voulez juste le PID d'un processus dont vous
connaissez le nom, il y a `pgrep` :

```sh
pgrep -l sshd
```

```try
pgrep -l sshd
---
`-l` affiche le nom à côté du PID.
```

## Une vue en direct – `top` et `htop`

`top` affiche les processus triés selon le temps processeur qu'ils utilisent
et se rafraîchit chaque seconde – parfait pour trouver ce qui ralentit
l'ordinateur. En haut, vous voyez la charge (*load average*), le nombre de
processus et la mémoire.

```sh
top
```

Dans un vrai terminal, on quitte `top` avec `q`. Beaucoup de gens préfèrent
`htop`, qui a des couleurs et se pilote à la souris, mais il faut en général
l'installer d'abord.

## Arrêter des processus – `kill`

Le nom est dramatique, mais en réalité `kill` envoie un **signal** à un
processus. Le signal par défaut, `SIGTERM` (15), demande au processus de
s'arrêter proprement. S'il n'écoute pas, vous pouvez envoyer `SIGKILL` (9),
qui le force à s'arrêter immédiatement – mais il n'a alors aucune chance
d'enregistrer ou de faire le ménage.

```text
kill 1234        # demander au processus 1234 de se terminer (SIGTERM)
kill -9 1234     # le forcer (SIGKILL) – en dernier recours
```

Si vous connaissez le nom mais pas le PID, vous pouvez utiliser `pkill`
(correspond à un motif) ou `killall` (nom exact) :

```text
pkill firefox
killall firefox
```

Vous ne pouvez envoyer des signaux qu'à vos **propres** processus. Pour les
processus qui appartiennent à root ou à d'autres utilisateurs, il vous faut
`sudo`.

```quiz
Un programme ne répond plus. Quelle commande devriez-vous essayer **en premier** ?
- [x] `kill 1234` – elle envoie `SIGTERM` et laisse le programme s'arrêter proprement
- [ ] `kill -9 1234` – c'est toujours ce qui marche le mieux
- [ ] `sudo kill -9 1`
---
Commencez par le signal par défaut, `SIGTERM`. `SIGKILL` (`-9`) est le dernier
recours, car le programme n'a alors aucune chance d'enregistrer ou de faire le
ménage.
```

> **Trouvez-le et arrêtez-le !** Un processus sur cet ordinateur utilise
> presque 100 % du processeur. Utilisez `top` ou `ps aux --sort=-%cpu` pour
> découvrir comment il s'appelle et quel est son PID – puis arrêtez-le.

## Premier plan et arrière-plan

Quand vous lancez une commande, le shell attend qu'elle se termine ; elle
tourne au **premier plan** (*foreground*). Si vous ajoutez `&` à la fin, elle
tourne plutôt en **arrière-plan** (*background*), et vous récupérez
immédiatement votre invite :

```sh
sleep 300 &
```

Le shell répond avec le numéro du job entre crochets et le PID du processus,
par exemple `[1] 4200`. Les programmes lancés depuis le terminal s'appellent
des **jobs** (tâches) :

```sh
jobs
```

| Commande | Effet |
|---|---|
| `jobs` | Lister les jobs de ce terminal |
| `fg %1` | Ramener le job 1 au premier plan |
| `bg %1` | Laisser un job stoppé continuer en arrière-plan |
| `kill %1` | Terminer le job 1 |
| `Ctrl+C` | Interrompre le programme au premier plan |
| `Ctrl+Z` | Mettre en pause le programme au premier plan (reprendre avec `fg` ou `bg`) |

La variable `$!` contient le PID du dernier job lancé en arrière-plan. Quand
un job se termine, le shell vous le signale avec une ligne comme
`[1]+  Done   sleep 300`.

```quiz
Vous avez appuyé sur `Ctrl+Z` sur un programme au premier plan. Comment le
laisser continuer à tourner tout en gardant votre invite ?
- [ ] `fg %1`
- [x] `bg %1`
- [ ] `Ctrl+C`
---
`Ctrl+Z` met le programme en pause. `bg` laisse un job stoppé continuer en
arrière-plan, alors que `fg` le ramènerait au premier plan.
```

### Continuer après la déconnexion – `nohup`

Quand vous fermez le terminal ou la connexion ssh, les programmes que vous avez
lancés reçoivent le signal **SIGHUP** (*hang up*) et se terminent – les jobs en
arrière-plan aussi. `nohup` fait ignorer ce signal à une commande :

```sh
nohup ./long-job.sh &
```

La sortie qui se serait affichée dans le terminal atterrit plutôt dans le
fichier `nohup.out` :

```predict
$ nohup echo done
$ cat nohup.out
nohup: ignoring input and appending output to 'nohup.out'
done
```

Pour les programmes qui doivent toujours tourner, un **service** vaut mieux –
vous les découvrirez dans la partie sur l'administration système.

### Surveiller une commande – `watch`

`watch` relance une commande toutes les deux secondes et affiche le résultat
sur un écran vierge – pratique pour regarder un fichier grossir ou un disque se
remplir. Quittez avec `Ctrl+C`. Dans le simulateur, le résultat s'affiche une
seule fois.

```sh
watch -n 5 'ls -l /tmp'
```

## Comment va l'ordinateur ?

Deux petites commandes donnent un aperçu rapide :

```sh
uptime
free -h
```

`uptime` indique depuis combien de temps l'ordinateur tourne et la charge sur
les 1, 5 et 15 dernières minutes. `free -h` montre combien de mémoire est
utilisée. Regardez la colonne *available* : Linux utilise la mémoire libre
comme cache pour les fichiers, donc *free* paraît souvent faible alors qu'il
reste largement assez de mémoire.

```quiz
`free -h` montre peu de mémoire *free* mais beaucoup de mémoire *available*.
Qu'est-ce que cela signifie ?
- [ ] L'ordinateur est sur le point de manquer de mémoire
- [x] Linux utilise la mémoire libre comme cache pour les fichiers – regardez *available*
- [ ] Une partie de la mémoire est défectueuse
```

## Pareil partout

Les processus fonctionnent de la même façon sur toutes les distributions.
Sur Ubuntu, les outils viennent du paquet **procps**, et `killall` de
**psmisc**. Certaines distributions donnent aux paquets des noms un peu
différents, et les services lancés au démarrage diffèrent aussi – vous
pourrez comparer les distributions dans la partie consacrée aux
distributions.
