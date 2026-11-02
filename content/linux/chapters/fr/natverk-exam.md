# Examen : Réseau

Montrez ce que vous avez appris sur les adresses, les noms, les ports, le web
et SSH. Les questions couvrent toute la partie, et il faut 80 % de bonnes
réponses pour réussir.

```quiz
Lesquelles de ces adresses sont **privées** – utilisées uniquement à
l'intérieur des réseaux locaux ? (Choisissez toutes les bonnes réponses.)
- [x] `10.0.0.5`
- [x] `172.20.1.1`
- [x] `192.168.0.7`
- [ ] `8.8.8.8`
- [ ] `1.1.1.1`
```

```quiz
Un serveur web que vous développez tourne sur votre propre ordinateur. Où va
le trafic quand vous le testez à l'adresse `http://localhost:8080` ?
- [ ] Jusqu'au routeur et retour
- [x] Nulle part – le trafic vers localhost ne quitte jamais l'ordinateur
- [ ] Au serveur DNS, qui le renvoie
- [ ] À `192.168.1.1`
```

```try
ip route
---
La ligne `default` montre la passerelle vers laquelle tout le reste est
envoyé.
```

La ligne de `localhost` dans `/etc/hosts` est ce que trouve le système.
Qu'est-ce que ceci affiche ?

```predict
$ getent hosts localhost
127.0.0.1 localhost
```

Quel serveur DNS Ubuntu interroge-t-il, d'après `/etc/resolv.conf` ?

```predict
$ grep nameserver /etc/resolv.conf
nameserver 127.0.0.53
---
`127.0.0.53` est systemd-resolved, un intermédiaire local sur votre propre
ordinateur qui interroge à son tour le routeur.
```

```quiz
Vous lancez `ping 192.168.1.1` sans aucune option. Quand s'arrête-t-il ?
- [ ] Après 3 paquets
- [ ] Après un paquet
- [x] Quand vous appuyez sur Ctrl+C
- [ ] Quand la première réponse arrive
---
Avec `-c`, vous choisissez combien de paquets envoyer.
```

L'ordre dans lequel le système recherche les noms est défini dans
`/etc/nsswitch.conf`. Qu'est-ce que ceci affiche ?

```predict
$ grep hosts: /etc/nsswitch.conf
hosts: files dns
---
D'abord le fichier (`/etc/hosts`), puis le DNS.
```

```quiz
Vous avez ajouté `server.lan` à `/etc/hosts`. `ping server.lan` fonctionne,
mais `dig +short server.lan` n'affiche rien. Pourquoi ?
- [ ] La ligne dans `/etc/hosts` est fausse
- [x] `dig` interroge directement le DNS et ignore `/etc/hosts`
- [ ] `dig` a besoin de `sudo`
- [ ] `ping` n'utilise pas les noms
---
Pour voir ce que le *système* résout, utilisez `getent hosts server.lan`.
```

```quiz
`myserver` écoute sur le port 8080 et tourne en tant qu'utilisateur
ordinaire. Qu'est-ce qui changerait s'il écoutait sur le port 80 ?
- [ ] Rien
- [x] Seul root peut ouvrir des ports en dessous de 1024
- [ ] Le port 80 est réservé à SSH
- [ ] Le port 80 ne peut pas être utilisé sur localhost
```

```quiz
`curl -I http://linux.org` répond `301 Moved Permanently`. Comment
obtenez-vous la vraie page ?
- [ ] `curl -s http://linux.org`
- [x] `curl -L http://linux.org` – suivre la redirection
- [ ] `curl -o http://linux.org`
- [ ] C'est impossible – 301 signifie que la page a disparu
```

```quiz
Vous vous connectez à `server.lan` avec ssh, et ssh vous avertit bruyamment
que la clé d'hôte du serveur a changé. Qu'est-ce que cela peut signifier ?
- [ ] Votre mot de passe a expiré
- [x] Quelqu'un pourrait se faire passer pour le serveur
- [ ] Le serveur a un nouvel utilisateur
- [ ] Votre paire de clés est cassée
---
La clé d'hôte a été enregistrée dans `~/.ssh/known_hosts` lors de votre
première connexion.
```

```quiz
Vous voulez vous connecter au serveur avec une paire de clés plutôt qu'avec
un mot de passe. Quelle clé met-on sur le serveur ?
- [x] La clé publique, `id_ed25519.pub`
- [ ] La clé privée, `id_ed25519`
- [ ] Les deux
- [ ] Aucune – le serveur crée la sienne
---
`ssh-copy-id` ajoute la clé publique à `~/.ssh/authorized_keys` sur le
serveur. Ne montrez jamais la clé privée à personne !
```

```quiz
`ip a` montre une adresse, et vous pouvez pinguer d'autres ordinateurs de
`192.168.1.0/24`, mais rien sur Internet. `ip route` n'a pas de ligne
`default`. Qu'est-ce qui ne va pas ?
- [ ] Le DNS
- [x] Il n'y a pas de passerelle – rien ne sait où envoyer le trafic hors du réseau local
- [ ] La carte réseau est désactivée
- [ ] `/etc/hosts` est manquant
```
